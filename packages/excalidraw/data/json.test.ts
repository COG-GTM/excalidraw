import { vi } from "vitest";

import { EXPORT_DATA_TYPES, MIME_TYPES, VERSIONS } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import { API } from "../tests/helpers/api";
import { getDefaultAppState } from "../appState";

import { fileOpen, fileSave } from "./filesystem";
import {
  isValidExcalidrawData,
  isValidLibrary,
  loadFromJSON,
  saveAsJSON,
  saveLibraryAsJSON,
  serializeAsJSON,
  serializeLibraryAsJSON,
} from "./json";

import type { BinaryFileData, BinaryFiles, LibraryItem } from "../types";

vi.mock("./filesystem", async (importOriginal) => {
  const module = await importOriginal<typeof import("./filesystem")>();
  return {
    ...module,
    fileOpen: vi.fn(),
    fileSave: vi.fn(async () => null),
  };
});

const makeFile = (id: string): BinaryFileData => ({
  id: id as FileId,
  mimeType: MIME_TYPES.png,
  dataURL: "data:image/png;base64,AAAA" as BinaryFileData["dataURL"],
  created: 1,
});

// jsdom's Blob has no `text()`
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

const getBlobArg = async (call: unknown[]) =>
  JSON.parse(await readBlob((await call[0]) as Blob));

describe("serializeAsJSON", () => {
  const imageA = API.createElement({
    type: "image",
    fileId: "fileA" as FileId,
  });
  const imageDeleted = API.createElement({
    type: "image",
    fileId: "fileB" as FileId,
    isDeleted: true,
  });
  const imageMissingFile = API.createElement({
    type: "image",
    fileId: "fileMissing" as FileId,
  });
  const rect = API.createElement({ type: "rectangle" });

  const files: BinaryFiles = {
    fileA: makeFile("fileA"),
    fileB: makeFile("fileB"),
    fileUnused: makeFile("fileUnused"),
  };

  it("serializes local exports with metadata and only referenced files", () => {
    const data = JSON.parse(
      serializeAsJSON(
        [imageA, imageDeleted, imageMissingFile, rect],
        { ...getDefaultAppState(), viewBackgroundColor: "#123456" },
        files,
        "local",
      ),
    );

    expect(data.type).toBe(EXPORT_DATA_TYPES.excalidraw);
    expect(data.version).toBe(VERSIONS.excalidraw);
    expect(typeof data.source).toBe("string");
    expect(data.elements.map((el: any) => el.id)).toEqual([
      imageA.id,
      imageDeleted.id,
      imageMissingFile.id,
      rect.id,
    ]);
    expect(Object.keys(data.files)).toEqual(["fileA"]);
    expect(data.appState.viewBackgroundColor).toBe("#123456");
    // non-exportable appState is stripped
    expect(data.appState).not.toHaveProperty("selectedElementIds");
  });

  it("omits files and keeps only server appState for database exports", () => {
    const data = JSON.parse(
      serializeAsJSON(
        [imageA],
        { ...getDefaultAppState(), viewBackgroundColor: "#abcdef" },
        files,
        "database",
      ),
    );
    expect(data).not.toHaveProperty("files");
    expect(data.appState).toEqual({
      gridSize: expect.any(Number),
      gridStep: expect.any(Number),
      gridModeEnabled: false,
      viewBackgroundColor: "#abcdef",
      lockedMultiSelections: {},
    });
  });

  it("is pretty-printed with 2 spaces", () => {
    const json = serializeAsJSON([], {}, {}, "local");
    expect(json.split("\n")[1]).toMatch(/^ {2}"type"/);
  });
});

describe("isValidExcalidrawData", () => {
  it("accepts excalidraw data with optional elements and appState", () => {
    expect(isValidExcalidrawData({ type: EXPORT_DATA_TYPES.excalidraw })).toBe(
      true,
    );
    expect(
      isValidExcalidrawData({
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [],
        appState: {},
      }),
    ).toBe(true);
    expect(
      isValidExcalidrawData({
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [],
      }),
    ).toBe(true);
  });

  it("rejects wrong type, non-array elements or non-object appState", () => {
    expect(isValidExcalidrawData(undefined)).toBe(false);
    expect(isValidExcalidrawData({ type: "something-else" })).toBe(false);
    expect(
      isValidExcalidrawData({
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: {},
      }),
    ).toBe(false);
    expect(
      isValidExcalidrawData({
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [],
        appState: "dark",
      }),
    ).toBe(false);
  });
});

describe("isValidLibrary", () => {
  it("accepts library versions 1 and 2 only", () => {
    const type = EXPORT_DATA_TYPES.excalidrawLibrary;
    expect(isValidLibrary({ type, version: 1 })).toBe(true);
    expect(isValidLibrary({ type, version: 2 })).toBe(true);
    expect(isValidLibrary({ type, version: 3 })).toBe(false);
    expect(
      isValidLibrary({ type: EXPORT_DATA_TYPES.excalidraw, version: 2 }),
    ).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isValidLibrary(null)).toBeFalsy();
    expect(isValidLibrary("library")).toBe(false);
    expect(isValidLibrary(undefined)).toBe(false);
  });
});

describe("serializeLibraryAsJSON", () => {
  it("wraps items in a versioned library envelope", () => {
    const item: LibraryItem = {
      id: "item1",
      status: "published",
      created: 1,
      elements: [API.createElement({ type: "rectangle" })],
    };
    const data = JSON.parse(serializeLibraryAsJSON([item]));
    expect(data.type).toBe(EXPORT_DATA_TYPES.excalidrawLibrary);
    expect(data.version).toBe(VERSIONS.excalidrawLibrary);
    expect(data.libraryItems).toHaveLength(1);
    expect(data.libraryItems[0].id).toBe("item1");
    expect(isValidLibrary(data)).toBe(true);
  });
});

describe("saveAsJSON / saveLibraryAsJSON / loadFromJSON", () => {
  beforeEach(() => {
    vi.mocked(fileSave).mockClear();
    vi.mocked(fileOpen).mockReset();
  });

  it("saves the serialized scene with the .excalidraw extension", async () => {
    const rect = API.createElement({ type: "rectangle" });
    const fileHandle = { name: "drawing.excalidraw" } as FileSystemFileHandle;
    vi.mocked(fileSave).mockResolvedValueOnce(fileHandle);

    const result = await saveAsJSON({
      data: Promise.resolve({
        elements: [rect],
        appState: getDefaultAppState() as any,
        files: {},
      }),
      filename: "drawing",
      fileHandle,
    });

    expect(result).toEqual({ fileHandle });
    const call = vi.mocked(fileSave).mock.calls[0];
    expect(call[1]).toEqual({
      name: "drawing",
      extension: "excalidraw",
      description: "Excalidraw file",
      fileHandle,
    });
    const blob = await call[0];
    expect(blob.type).toBe(MIME_TYPES.excalidraw);
    const saved = await getBlobArg(call);
    expect(saved.elements[0].id).toBe(rect.id);
  });

  it("does not overwrite an image file handle when saving as JSON", async () => {
    await saveAsJSON({
      data: { elements: [], appState: getDefaultAppState() as any, files: {} },
      filename: "drawing",
      fileHandle: { name: "drawing.png" } as FileSystemFileHandle,
    });
    expect(vi.mocked(fileSave).mock.calls[0][1].fileHandle).toBeNull();
  });

  it("saves library items as .excalidrawlib", async () => {
    await saveLibraryAsJSON([]);
    const call = vi.mocked(fileSave).mock.calls[0];
    expect(call[1]).toEqual({
      name: "library",
      extension: "excalidrawlib",
      description: "Excalidraw library file",
    });
    expect(((await call[0]) as Blob).type).toBe(MIME_TYPES.excalidrawlib);
    expect(await getBlobArg(call)).toMatchObject({
      type: EXPORT_DATA_TYPES.excalidrawLibrary,
      libraryItems: [],
    });
  });

  it("loads a scene from the file picked via fileOpen", async () => {
    const rect = API.createElement({ type: "rectangle" });
    const file = new File(
      [serializeAsJSON([rect], getDefaultAppState(), {}, "local")],
      "scene.excalidraw",
      { type: MIME_TYPES.excalidraw },
    );
    vi.mocked(fileOpen).mockResolvedValueOnce(file as any);

    const { elements, appState } = await loadFromJSON(
      getDefaultAppState() as any,
      null,
    );
    expect(vi.mocked(fileOpen)).toHaveBeenCalledWith({
      description: "Excalidraw files",
    });
    expect(elements.map((el) => el.id)).toEqual([rect.id]);
    expect(appState.fileHandle).toBeNull();
  });
});
