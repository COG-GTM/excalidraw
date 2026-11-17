import { vi } from "vitest";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { API } from "../tests/helpers/api";
import { getDefaultAppState } from "../appState";
import { CanvasError, ImageSceneDataError } from "../errors";

import {
  ImageURLToFile,
  SVGStringToFile,
  blobToArrayBuffer,
  canvasToBlob,
  createFile,
  dataURLToFile,
  dataURLToString,
  getDataURL,
  getDataURL_sync,
  getFileHandle,
  getFileHandleType,
  getMimeType,
  isImageFileHandle,
  isImageFileHandleType,
  isSupportedImageFile,
  isSupportedImageFileType,
  loadFromBlob,
  loadLibraryFromBlob,
  loadSceneOrLibraryFromBlob,
  normalizeFile,
  parseLibraryJSON,
  resizeImageFile,
} from "./blob";
import { serializeAsJSON, serializeLibraryAsJSON } from "./json";

import type { DataURL } from "../types";

const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13];
const JPG_BYTES = [255, 216, 255, 224, 0, 16];
const GIF_BYTES = [71, 73, 70, 56, 57, 97, 1, 0];
const WEBP_BYTES = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56];

const handle = (name: string) => ({ name } as FileSystemFileHandle);

const sceneBlob = (type: string = MIME_TYPES.json) =>
  new Blob(
    [
      serializeAsJSON(
        [API.createElement({ type: "rectangle", id: "rect1" })],
        { ...getDefaultAppState(), viewBackgroundColor: "#ff0000" },
        {},
        "local",
      ),
    ],
    { type },
  );

describe("getMimeType", () => {
  it("prefers the blob's own type", () => {
    expect(getMimeType(new Blob([], { type: "image/gif" }))).toBe("image/gif");
  });

  it("infers the type from file name or string extension", () => {
    expect(getMimeType("scene.excalidraw")).toBe(MIME_TYPES.json);
    expect(getMimeType("scene.json")).toBe(MIME_TYPES.json);
    expect(getMimeType("image.png")).toBe(MIME_TYPES.png);
    expect(getMimeType("image.jpg")).toBe(MIME_TYPES.jpg);
    expect(getMimeType("image.jpeg")).toBe(MIME_TYPES.jpg);
    expect(getMimeType("image.svg")).toBe(MIME_TYPES.svg);
    expect(getMimeType("lib.excalidrawlib")).toBe(MIME_TYPES.excalidrawlib);
    expect(getMimeType(new File([], "image.png"))).toBe(MIME_TYPES.png);
  });

  it("returns an empty string for unknown or missing names", () => {
    expect(getMimeType("notes.txt")).toBe("");
    expect(getMimeType(new Blob([]))).toBe("");
  });
});

describe("file handle helpers", () => {
  it("derives the handle type from its extension", () => {
    expect(getFileHandleType(null)).toBeNull();
    expect(getFileHandleType(handle("a.json"))).toBe("json");
    expect(getFileHandleType(handle("a.excalidraw"))).toBe("excalidraw");
    expect(getFileHandleType(handle("a.png"))).toBe("png");
    expect(getFileHandleType(handle("a.svg"))).toBe("svg");
    expect(getFileHandleType(handle("a.txt"))).toBeNull();
  });

  it("detects image file handles", () => {
    expect(isImageFileHandleType("png")).toBe(true);
    expect(isImageFileHandleType("svg")).toBe(true);
    expect(isImageFileHandleType("json")).toBe(false);
    expect(isImageFileHandleType(null)).toBe(false);
    expect(isImageFileHandle(handle("a.svg"))).toBe(true);
    expect(isImageFileHandle(handle("a.excalidraw"))).toBe(false);
    expect(isImageFileHandle(null)).toBe(false);
  });

  it("returns null from getFileHandle without native file system support", async () => {
    expect(await getFileHandle({} as DataTransferItem)).toBeNull();
  });
});

describe("isSupportedImageFile", () => {
  it("accepts known image mime types only", () => {
    expect(isSupportedImageFileType(MIME_TYPES.png)).toBe(true);
    expect(isSupportedImageFileType(MIME_TYPES.svg)).toBe(true);
    expect(isSupportedImageFileType(MIME_TYPES.json)).toBe(false);
    expect(isSupportedImageFileType(null)).toBe(false);
    expect(isSupportedImageFileType(undefined)).toBe(false);
    expect(isSupportedImageFile(new Blob([], { type: MIME_TYPES.jpg }))).toBe(
      true,
    );
    expect(isSupportedImageFile(new Blob([], { type: "text/plain" }))).toBe(
      false,
    );
    expect(isSupportedImageFile(null)).toBe(false);
  });
});

describe("loadSceneOrLibraryFromBlob", () => {
  it("restores a JSON scene", async () => {
    const localAppState = {
      ...getDefaultAppState(),
      theme: "dark",
    } as any;
    const ret = await loadSceneOrLibraryFromBlob(
      sceneBlob(),
      localAppState,
      null,
      handle("scene.excalidraw"),
    );
    expect(ret.type).toBe(MIME_TYPES.excalidraw);
    const data = ret.data as any;
    expect(data.elements.map((el: any) => el.id)).toEqual(["rect1"]);
    expect(data.appState.viewBackgroundColor).toBe("#ff0000");
    expect(data.appState.theme).toBe("dark");
    expect(data.appState.fileHandle.name).toBe("scene.excalidraw");
    expect(data.files).toEqual({});
  });

  it("returns library data for library files", async () => {
    const ret = await loadSceneOrLibraryFromBlob(
      new Blob([serializeLibraryAsJSON([])], {
        type: MIME_TYPES.excalidrawlib,
      }),
      null,
      null,
    );
    expect(ret.type).toBe(MIME_TYPES.excalidrawlib);
    expect(ret.data).toMatchObject({
      type: EXPORT_DATA_TYPES.excalidrawLibrary,
      libraryItems: [],
    });
  });

  it("throws 'invalid file' for malformed or unknown JSON", async () => {
    await expect(
      loadSceneOrLibraryFromBlob(new Blob(["{not json"]), null, null),
    ).rejects.toThrow("Error: invalid file");
    await expect(
      loadSceneOrLibraryFromBlob(
        new Blob([JSON.stringify({ type: "other" })]),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");
  });

  it("throws ImageSceneDataError for a PNG without scene data", async () => {
    const png = await API.loadFile("./fixtures/smiley.png");
    const error = await loadSceneOrLibraryFromBlob(png, null, null).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ImageSceneDataError);
    expect(error.code).toBe("IMAGE_NOT_CONTAINS_SCENE_DATA");
  });

  it("throws ImageSceneDataError for an SVG without scene data", async () => {
    const svg = SVGStringToFile("<svg></svg>", "a.svg");
    const error = await loadSceneOrLibraryFromBlob(svg, null, null).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ImageSceneDataError);
    expect(error.code).toBe("IMAGE_NOT_CONTAINS_SCENE_DATA");
  });

  it("throws ImageSceneDataError for an unparsable image of another type", async () => {
    const error = await loadSceneOrLibraryFromBlob(
      new Blob(["garbage"], { type: MIME_TYPES.jpg }),
      null,
      null,
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ImageSceneDataError);
    expect(error.code).toBe("IMAGE_NOT_CONTAINS_SCENE_DATA");
  });

  it("restores a scene embedded in a PNG", async () => {
    const png = await API.loadFile("./fixtures/smiley_embedded_v2.png");
    const ret = await loadSceneOrLibraryFromBlob(png, null, null);
    expect(ret.type).toBe(MIME_TYPES.excalidraw);
    expect((ret.data as any).elements).toEqual([
      expect.objectContaining({ type: "text", text: "😀" }),
    ]);
  });
});

describe("loadFromBlob / parseLibraryJSON / loadLibraryFromBlob", () => {
  it("loadFromBlob returns scene data", async () => {
    const data = await loadFromBlob(sceneBlob(), null, null);
    expect(data.elements.map((el) => el.id)).toEqual(["rect1"]);
  });

  it("loadFromBlob rejects library files", async () => {
    await expect(
      loadFromBlob(new Blob([serializeLibraryAsJSON([])]), null, null),
    ).rejects.toThrow("Error: invalid file");
  });

  it("parseLibraryJSON restores v2 items with the default status", () => {
    const rect = API.createElement({ type: "rectangle" });
    const items = parseLibraryJSON(
      JSON.stringify({
        type: EXPORT_DATA_TYPES.excalidrawLibrary,
        version: 2,
        libraryItems: [{ id: "item1", elements: [rect] }],
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "item1", status: "unpublished" });
    expect(items[0].elements[0].id).toBe(rect.id);
  });

  it("parseLibraryJSON migrates v1 libraries", () => {
    const rect = API.createElement({ type: "rectangle" });
    const items = parseLibraryJSON(
      JSON.stringify({
        type: EXPORT_DATA_TYPES.excalidrawLibrary,
        version: 1,
        library: [[rect]],
      }),
      "published",
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("published");
    expect(typeof items[0].id).toBe("string");
  });

  it("parseLibraryJSON throws on non-library JSON", () => {
    expect(() => parseLibraryJSON(JSON.stringify({ type: "x" }))).toThrow(
      "Invalid library",
    );
  });

  it("loadLibraryFromBlob reads the fixture library", async () => {
    const json = await API.readFile(
      "./fixtures/fixture_library.excalidrawlib",
      "utf8",
    );
    const items = await loadLibraryFromBlob(
      new Blob([json], { type: MIME_TYPES.excalidrawlib }),
      "published",
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.status === "published")).toBe(true);
  });
});

describe("canvasToBlob", () => {
  it("resolves with the canvas blob (also for a promised canvas)", async () => {
    const blob = new Blob(["png"], { type: MIME_TYPES.png });
    const canvas = {
      toBlob: (cb: (b: Blob | null) => void) => cb(blob),
    } as HTMLCanvasElement;
    expect(await canvasToBlob(canvas)).toBe(blob);
    expect(await canvasToBlob(Promise.resolve(canvas))).toBe(blob);
  });

  it("rejects with CANVAS_POSSIBLY_TOO_BIG when no blob is produced", async () => {
    const canvas = {
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    } as HTMLCanvasElement;
    const error = await canvasToBlob(canvas).catch((e) => e);
    expect(error).toBeInstanceOf(CanvasError);
    expect(error.name).toBe("CANVAS_POSSIBLY_TOO_BIG");
  });

  it("rejects when the canvas promise rejects", async () => {
    await expect(
      canvasToBlob(Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
  });
});

describe("data URL helpers", () => {
  it("getDataURL reads a blob as a data URL", async () => {
    expect(await getDataURL(new Blob(["hi"], { type: "text/plain" }))).toBe(
      "data:text/plain;base64,aGk=",
    );
  });

  it("getDataURL_sync encodes strings and bytes", () => {
    expect(getDataURL_sync("hi", MIME_TYPES.svg)).toBe(
      "data:image/svg+xml;base64,aGk=",
    );
    expect(getDataURL_sync(new Uint8Array([104, 105]), MIME_TYPES.png)).toBe(
      "data:image/png;base64,aGk=",
    );
  });

  it("dataURLToFile decodes mime type, name and bytes", async () => {
    const file = dataURLToFile(
      "data:image/png;base64,AQID" as DataURL,
      "img.png",
    );
    expect(file.name).toBe("img.png");
    expect(file.type).toBe("image/png");
    expect(Array.from(new Uint8Array(await blobToArrayBuffer(file)))).toEqual([
      1, 2, 3,
    ]);
    expect(dataURLToFile("data:text/plain;base64,aGk=" as DataURL).name).toBe(
      "",
    );
  });

  it("dataURLToString decodes utf-8 payloads", () => {
    const dataURL = getDataURL_sync("ünï ✓", MIME_TYPES.svg);
    expect(dataURLToString(dataURL)).toBe("ünï ✓");
  });
});

describe("file constructors", () => {
  it("SVGStringToFile creates an svg file", () => {
    const file = SVGStringToFile("<svg/>", "a.svg");
    expect(file.type).toBe(MIME_TYPES.svg);
    expect(file.name).toBe("a.svg");
    expect(file.size).toBe(6);
  });

  it("createFile wraps data with a mime type and default name", () => {
    const file = createFile(
      new Uint8Array([1]).buffer,
      MIME_TYPES.png,
      undefined,
    );
    expect(file.type).toBe(MIME_TYPES.png);
    expect(file.name).toBe("");
  });
});

describe("resizeImageFile", () => {
  it("returns SVG files untouched", async () => {
    const svg = SVGStringToFile("<svg/>");
    expect(await resizeImageFile(svg, { maxWidthOrHeight: 10 })).toBe(svg);
  });

  it("rejects unsupported file types", async () => {
    const error = await resizeImageFile(new File(["x"], "a.txt"), {
      maxWidthOrHeight: 10,
    }).catch((e) => e);
    expect(error.message).toBe("Error: unsupported file type");
    expect(error.cause).toBe("UNSUPPORTED");
  });
});

describe("ImageURLToFile", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns a File for a supported image response", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () =>
        new Blob([new Uint8Array(PNG_BYTES)], {
          type: MIME_TYPES.png,
        }),
    })) as any;
    const file = await ImageURLToFile("https://example.com/a.png", "a.png");
    expect(file).toBeInstanceOf(File);
    expect(file!.name).toBe("a.png");
    expect(file!.type).toBe(MIME_TYPES.png);
  });

  it("throws FETCH_ERROR when fetch fails or the response is not ok", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as any;
    await expect(ImageURLToFile("https://x")).rejects.toMatchObject({
      message: "Error: failed to fetch image",
      cause: "FETCH_ERROR",
    });

    global.fetch = vi.fn(async () => ({ ok: false })) as any;
    await expect(ImageURLToFile("https://x")).rejects.toMatchObject({
      cause: "FETCH_ERROR",
    });
  });

  it("throws UNSUPPORTED for non-image responses", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["<html>"], { type: "text/html" }),
    })) as any;
    await expect(ImageURLToFile("https://x")).rejects.toMatchObject({
      message: "Error: unsupported file type",
      cause: "UNSUPPORTED",
    });
  });
});

describe("normalizeFile", () => {
  it("sets excalidraw mime types from the extension", async () => {
    expect(
      (await normalizeFile(new File(["{}"], "lib.excalidrawlib"))).type,
    ).toBe(MIME_TYPES.excalidrawlib);
    expect((await normalizeFile(new File(["{}"], "a.excalidraw"))).type).toBe(
      MIME_TYPES.excalidraw,
    );
  });

  it("detects the real image type from leading bytes", async () => {
    for (const [bytes, type] of [
      [PNG_BYTES, MIME_TYPES.png],
      [JPG_BYTES, MIME_TYPES.jpg],
      [GIF_BYTES, MIME_TYPES.gif],
      [WEBP_BYTES, MIME_TYPES.webp],
    ] as const) {
      const file = new File([new Uint8Array(bytes)], "image.png", {
        type: MIME_TYPES.jpg === type ? MIME_TYPES.png : MIME_TYPES.jpg,
      });
      const normalized = await normalizeFile(file);
      expect(normalized.type).toBe(type);
      expect(normalized.name).toBe("image.png");
    }
  });

  it("keeps the declared type when bytes are unrecognized", async () => {
    const file = new File(["abc"], "a.png", { type: MIME_TYPES.png });
    expect(await normalizeFile(file)).toBe(file);
    const untyped = new File(["abc"], "a");
    expect((await normalizeFile(untyped)).type).toBe("");
  });

  it("does not normalize the same file twice", async () => {
    const normalized = await normalizeFile(
      new File([new Uint8Array(PNG_BYTES)], "a.jpg", { type: MIME_TYPES.jpg }),
    );
    expect(await normalizeFile(normalized)).toBe(normalized);
  });

  it("leaves non-image files alone", async () => {
    const file = new File(["{}"], "a.json", { type: MIME_TYPES.json });
    expect(await normalizeFile(file)).toBe(file);
  });
});

describe("blobToArrayBuffer", () => {
  it("uses Blob#arrayBuffer when available", async () => {
    const expected = new Uint8Array([1, 2]).buffer;
    const arrayBuffer = vi.fn(async () => expected);
    const blob = Object.assign(new Blob([new Uint8Array([3, 4])]), {
      arrayBuffer,
    });
    expect(await blobToArrayBuffer(blob)).toBe(expected);
    expect(arrayBuffer).toHaveBeenCalledTimes(1);
  });

  it("falls back to FileReader when arrayBuffer() is unavailable", async () => {
    // jsdom's Blob doesn't implement arrayBuffer()
    const blob = new Blob([new Uint8Array([7, 8, 9])]);
    expect("arrayBuffer" in blob).toBe(false);
    const buffer = await blobToArrayBuffer(blob);
    expect(Array.from(new Uint8Array(buffer))).toEqual([7, 8, 9]);
  });
});
