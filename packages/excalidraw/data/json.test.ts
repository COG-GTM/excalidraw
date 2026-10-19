import {
  EXPORT_DATA_TYPES,
  getExportSource,
  MIME_TYPES,
  VERSIONS,
} from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import {
  cleanAppStateForExport,
  clearAppStateForDatabase,
  getDefaultAppState,
} from "../appState";
import { API } from "../tests/helpers/api";

import {
  isValidExcalidrawData,
  isValidLibrary,
  serializeAsJSON,
  serializeLibraryAsJSON,
} from "./json";

import type { BinaryFileData, BinaryFiles, DataURL } from "../types";

const createFile = (id: string): BinaryFileData => ({
  id: id as FileId,
  mimeType: MIME_TYPES.png,
  dataURL: `data:image/png;base64,${id}` as DataURL,
  created: 1,
});

describe("serializeAsJSON", () => {
  const liveImage = API.createElement({
    type: "image",
    id: "live",
    fileId: "file-live" as FileId,
  });
  const deletedImage = API.createElement({
    type: "image",
    id: "deleted",
    fileId: "file-deleted" as FileId,
    isDeleted: true,
  });
  const rectangle = API.createElement({ type: "rectangle", id: "rect" });
  const elements = [liveImage, deletedImage, rectangle];

  const files: BinaryFiles = {
    "file-live": createFile("file-live"),
    "file-deleted": createFile("file-deleted"),
    "file-orphan": createFile("file-orphan"),
  };

  const appState = {
    ...getDefaultAppState(),
    viewBackgroundColor: "#123456",
    gridSize: 30,
    name: "my scene",
    scrollX: 100,
    scrollY: 200,
    selectedElementIds: { live: true as const },
    zenModeEnabled: true,
  };

  it("serializes the export envelope", () => {
    for (const type of ["local", "database"] as const) {
      const data = JSON.parse(serializeAsJSON(elements, appState, files, type));
      expect(data.type).toBe(EXPORT_DATA_TYPES.excalidraw);
      expect(data.version).toBe(VERSIONS.excalidraw);
      expect(data.source).toBe(getExportSource());
      expect(data.elements).toEqual(JSON.parse(JSON.stringify(elements)));
    }
  });

  it("local: keeps only files referenced by non-deleted elements", () => {
    const data = JSON.parse(
      serializeAsJSON(elements, appState, files, "local"),
    );
    expect(Object.keys(data.files)).toEqual(["file-live"]);
    expect(data.files["file-live"]).toEqual(files["file-live"]);
  });

  it("local: skips elements whose fileId is missing from files", () => {
    const data = JSON.parse(
      serializeAsJSON(
        [
          API.createElement({
            type: "image",
            fileId: "file-missing" as FileId,
          }),
        ],
        appState,
        files,
        "local",
      ),
    );
    expect(data.files).toEqual({});
  });

  it("local: uses cleanAppStateForExport", () => {
    const data = JSON.parse(
      serializeAsJSON(elements, appState, files, "local"),
    );
    expect(data.appState).toEqual(
      JSON.parse(JSON.stringify(cleanAppStateForExport(appState))),
    );
    expect(data.appState.viewBackgroundColor).toBe("#123456");
    expect(data.appState.gridSize).toBe(30);
    for (const key of [
      "name",
      "scrollX",
      "scrollY",
      "selectedElementIds",
      "zenModeEnabled",
    ]) {
      expect(data.appState).not.toHaveProperty(key);
    }
  });

  it("database: omits files entirely", () => {
    const data = JSON.parse(
      serializeAsJSON(elements, appState, files, "database"),
    );
    expect(data).not.toHaveProperty("files");
  });

  it("database: uses clearAppStateForDatabase", () => {
    const data = JSON.parse(
      serializeAsJSON(elements, appState, files, "database"),
    );
    expect(data.appState).toEqual(
      JSON.parse(JSON.stringify(clearAppStateForDatabase(appState))),
    );
    expect(data.appState.viewBackgroundColor).toBe("#123456");
    for (const key of [
      "name",
      "scrollX",
      "scrollY",
      "selectedElementIds",
      "zenModeEnabled",
    ]) {
      expect(data.appState).not.toHaveProperty(key);
    }
  });
});

describe("isValidExcalidrawData", () => {
  it.each([
    [{ type: EXPORT_DATA_TYPES.excalidraw }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, elements: [] }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, elements: [], appState: {} }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, elements: [], appState: null }],
  ])("accepts %j", (data) => {
    expect(isValidExcalidrawData(data)).toBe(true);
  });

  it.each([
    [undefined],
    [{}],
    [{ type: EXPORT_DATA_TYPES.excalidrawLibrary, elements: [] }],
    [{ type: "something-else", elements: [] }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, elements: {} }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, elements: "x" }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, elements: [], appState: "x" }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, elements: [], appState: 1 }],
  ])("rejects %j", (data) => {
    expect(isValidExcalidrawData(data)).toBe(false);
  });
});

describe("isValidLibrary", () => {
  it.each([1, 2])("accepts version %s", (version) => {
    expect(
      isValidLibrary({ type: EXPORT_DATA_TYPES.excalidrawLibrary, version }),
    ).toBe(true);
  });

  it.each([
    [{ type: EXPORT_DATA_TYPES.excalidrawLibrary, version: 3 }],
    [{ type: EXPORT_DATA_TYPES.excalidrawLibrary, version: null }],
    [{ type: EXPORT_DATA_TYPES.excalidrawLibrary, version: "2" }],
    [{ type: EXPORT_DATA_TYPES.excalidrawLibrary }],
    [{ version: 2 }],
    [{ type: EXPORT_DATA_TYPES.excalidraw, version: 2 }],
  ])("rejects %j", (data) => {
    expect(isValidLibrary(data)).toBe(false);
  });

  it.each([[null], [undefined], ["excalidrawlib"], [2]])(
    "rejects non-object %j",
    (data) => {
      expect(isValidLibrary(data)).toBeFalsy();
    },
  );
});

describe("serializeLibraryAsJSON", () => {
  it("round-trips into a valid library", () => {
    const libraryItems = [
      {
        id: "item-1",
        status: "unpublished" as const,
        elements: [API.createElement({ type: "rectangle", id: "r1" })],
        created: 1,
      },
    ];
    const data = JSON.parse(serializeLibraryAsJSON(libraryItems));
    expect(isValidLibrary(data)).toBe(true);
    expect(data.type).toBe(EXPORT_DATA_TYPES.excalidrawLibrary);
    expect(data.version).toBe(VERSIONS.excalidrawLibrary);
    expect(data.source).toBe(getExportSource());
    expect(data.libraryItems).toEqual(JSON.parse(JSON.stringify(libraryItems)));
  });
});
