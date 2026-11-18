import { EXPORT_DATA_TYPES, MIME_TYPES, VERSIONS } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import { API } from "../tests/helpers/api";

import {
  isValidExcalidrawData,
  isValidLibrary,
  loadFromJSON,
  saveAsJSON,
  saveLibraryAsJSON,
  serializeAsJSON,
  serializeLibraryAsJSON,
} from "./json";

import type { BinaryFileData, BinaryFiles } from "../types";

const { fileSave, fileOpen } = vi.hoisted(() => ({
  fileSave: vi.fn(),
  fileOpen: vi.fn(),
}));

vi.mock("./filesystem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./filesystem")>()),
  fileSave,
  fileOpen,
}));

const readAsText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

const file = (id: string): BinaryFileData => ({
  id: id as FileId,
  mimeType: MIME_TYPES.png,
  dataURL: "data:image/png;base64,AA==" as BinaryFileData["dataURL"],
  created: 1,
});

describe("serializeAsJSON", () => {
  const image = API.createElement({ type: "image", fileId: "used" as FileId });
  const deletedImage = API.createElement({
    type: "image",
    fileId: "deleted" as FileId,
    isDeleted: true,
  });
  const files: BinaryFiles = {
    used: file("used"),
    deleted: file("deleted"),
    orphan: file("orphan"),
  };

  it("keeps only files referenced by non-deleted elements for local export", () => {
    const data = JSON.parse(
      serializeAsJSON(
        [image, deletedImage],
        { viewBackgroundColor: "#fff", selectedElementIds: { a: true } },
        files,
        "local",
      ),
    );

    expect(data.type).toBe(EXPORT_DATA_TYPES.excalidraw);
    expect(data.version).toBe(VERSIONS.excalidraw);
    expect(typeof data.source).toBe("string");
    expect(data.elements.map((el: any) => el.id)).toEqual([
      image.id,
      deletedImage.id,
    ]);
    expect(Object.keys(data.files)).toEqual(["used"]);
    expect(data.appState.viewBackgroundColor).toBe("#fff");
    // non-exportable appState is stripped
    expect(data.appState.selectedElementIds).toBeUndefined();
  });

  it("strips files and non-database appState for database export", () => {
    const data = JSON.parse(
      serializeAsJSON(
        [image],
        { viewBackgroundColor: "#fff", selectedElementIds: { a: true } },
        files,
        "database",
      ),
    );
    expect(data.files).toBeUndefined();
    expect(data.appState.viewBackgroundColor).toBe("#fff");
    expect(data.appState.selectedElementIds).toBeUndefined();
  });
});

describe("validators", () => {
  it("isValidExcalidrawData", () => {
    expect(isValidExcalidrawData({ type: "excalidraw" })).toBe(true);
    expect(isValidExcalidrawData({ type: "excalidraw", elements: [] })).toBe(
      true,
    );
    expect(
      isValidExcalidrawData({ type: "excalidraw", elements: [], appState: {} }),
    ).toBe(true);
    expect(
      isValidExcalidrawData({
        type: "excalidraw",
        elements: [],
        appState: "x",
      }),
    ).toBe(false);
    expect(isValidExcalidrawData({ type: "excalidraw", elements: {} })).toBe(
      false,
    );
    expect(isValidExcalidrawData({ type: "excalidrawlib" })).toBe(false);
    expect(isValidExcalidrawData(undefined)).toBe(false);
  });

  it("isValidLibrary", () => {
    expect(isValidLibrary({ type: "excalidrawlib", version: 1 })).toBe(true);
    expect(isValidLibrary({ type: "excalidrawlib", version: 2 })).toBe(true);
    expect(isValidLibrary({ type: "excalidrawlib", version: 3 })).toBe(false);
    expect(isValidLibrary({ type: "excalidraw", version: 2 })).toBe(false);
    expect(isValidLibrary(null)).toBeFalsy();
    expect(isValidLibrary("excalidrawlib")).toBe(false);
  });
});

describe("saving and loading", () => {
  beforeEach(() => {
    fileSave.mockReset();
    fileOpen.mockReset();
  });

  it("serializeLibraryAsJSON wraps the items", () => {
    const data = JSON.parse(serializeLibraryAsJSON([]));
    expect(data).toMatchObject({
      type: EXPORT_DATA_TYPES.excalidrawLibrary,
      version: VERSIONS.excalidrawLibrary,
      libraryItems: [],
    });
  });

  it("saveAsJSON saves a serialized blob and returns the new handle", async () => {
    const handle = { name: "saved.excalidraw" };
    fileSave.mockImplementation(async (blob: Promise<Blob>) => {
      const resolved = await blob;
      expect(resolved.type).toBe(MIME_TYPES.excalidraw);
      const data = JSON.parse(await readAsText(resolved));
      expect(data.elements).toHaveLength(1);
      return handle;
    });

    const rectangle = API.createElement({ type: "rectangle" });
    const existingHandle = { name: "old.excalidraw" } as any;
    const result = await saveAsJSON({
      data: Promise.resolve({
        elements: [rectangle],
        appState: { viewBackgroundColor: "#fff" } as any,
        files: {},
      }),
      filename: "drawing",
      fileHandle: existingHandle,
    });

    expect(result).toEqual({ fileHandle: handle });
    expect(fileSave).toHaveBeenCalledWith(expect.any(Promise), {
      name: "drawing",
      extension: "excalidraw",
      description: "Excalidraw file",
      fileHandle: existingHandle,
    });
  });

  it("saveAsJSON does not overwrite image file handles", async () => {
    fileSave.mockResolvedValue(null);
    await saveAsJSON({
      data: { elements: [], appState: {} as any, files: {} },
      filename: "drawing",
      fileHandle: { name: "drawing.png" } as any,
    });
    expect(fileSave.mock.calls[0][1].fileHandle).toBeNull();
  });

  it("saveLibraryAsJSON saves an excalidrawlib blob", async () => {
    fileSave.mockResolvedValue(null);
    await saveLibraryAsJSON([]);
    const [blob, opts] = fileSave.mock.calls[0];
    expect(blob.type).toBe(MIME_TYPES.excalidrawlib);
    expect(opts).toEqual({
      name: "library",
      extension: "excalidrawlib",
      description: "Excalidraw library file",
    });
  });

  it("loadFromJSON opens a file and restores the scene", async () => {
    const rectangle = API.createElement({ type: "rectangle", id: "rect" });
    fileOpen.mockResolvedValue(
      new File(
        [serializeAsJSON([rectangle], {}, {}, "local")],
        "scene.excalidraw",
        { type: MIME_TYPES.json },
      ),
    );
    const result = await loadFromJSON(null as any, null);
    expect(fileOpen).toHaveBeenCalledWith({
      description: "Excalidraw files",
    });
    expect(result.elements.map((el) => el.id)).toEqual(["rect"]);
  });
});
