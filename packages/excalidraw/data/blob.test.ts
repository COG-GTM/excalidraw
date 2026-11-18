import { MIME_TYPES } from "@excalidraw/common";

import { CanvasError, ImageSceneDataError } from "../errors";

import {
  ImageURLToFile,
  SVGStringToFile,
  canvasToBlob,
  createFile,
  dataURLToFile,
  dataURLToString,
  generateIdFromFile,
  getDataURL,
  getDataURL_sync,
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

const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68];
const JPG_HEADER = [255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0];

const readAsText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

/** jsdom Blob lacks arrayBuffer(), which blobToArrayBuffer() prefers */
const withArrayBuffer = <T extends Blob>(blob: T, bytes: number[]): T => {
  (blob as any).arrayBuffer = () =>
    Promise.resolve(new Uint8Array(bytes).buffer);
  (blob as any).slice = (start = 0, end = bytes.length) =>
    withArrayBuffer(new Blob(), bytes.slice(start, end));
  return blob;
};

describe("mime type helpers", () => {
  it("getMimeType prefers blob.type and falls back to the extension", () => {
    expect(getMimeType(new Blob([], { type: "text/plain" }))).toBe(
      "text/plain",
    );
    expect(getMimeType("scene.excalidraw")).toBe(MIME_TYPES.json);
    expect(getMimeType("scene.json")).toBe(MIME_TYPES.json);
    expect(getMimeType("image.png")).toBe(MIME_TYPES.png);
    expect(getMimeType("image.jpg")).toBe(MIME_TYPES.jpg);
    expect(getMimeType("image.jpeg")).toBe(MIME_TYPES.jpg);
    expect(getMimeType("image.svg")).toBe(MIME_TYPES.svg);
    expect(getMimeType("lib.excalidrawlib")).toBe(MIME_TYPES.excalidrawlib);
    expect(getMimeType("notes.txt")).toBe("");
    expect(getMimeType(new File([], "drawing.png"))).toBe(MIME_TYPES.png);
    expect(getMimeType(new Blob([]))).toBe("");
  });

  it("file handle helpers derive the type from the handle name", () => {
    expect(getFileHandleType(null)).toBe(null);
    expect(getFileHandleType(fileHandle("a.excalidraw"))).toBe("excalidraw");
    expect(getFileHandleType(fileHandle("a.json"))).toBe("json");
    expect(getFileHandleType(fileHandle("a.png"))).toBe("png");
    expect(getFileHandleType(fileHandle("a.txt"))).toBe(null);

    expect(isImageFileHandleType("png")).toBe(true);
    expect(isImageFileHandleType("svg")).toBe(true);
    expect(isImageFileHandleType("json")).toBe(false);
    expect(isImageFileHandleType(null)).toBe(false);

    expect(isImageFileHandle(fileHandle("a.svg"))).toBe(true);
    expect(isImageFileHandle(fileHandle("a.excalidraw"))).toBe(false);
    expect(isImageFileHandle(null)).toBe(false);
  });

  it("supported image detection", () => {
    expect(isSupportedImageFileType(MIME_TYPES.png)).toBe(true);
    expect(isSupportedImageFileType(MIME_TYPES.svg)).toBe(true);
    expect(isSupportedImageFileType("application/pdf")).toBe(false);
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

describe("data URLs", () => {
  it("getDataURL_sync encodes strings and bytes", () => {
    expect(getDataURL_sync("hi", MIME_TYPES.text)).toBe(
      "data:text/plain;base64,aGk=",
    );
    expect(getDataURL_sync(new Uint8Array([104, 105]), MIME_TYPES.png)).toBe(
      "data:image/png;base64,aGk=",
    );
  });

  it("dataURLToString decodes unicode payloads", () => {
    const dataURL = getDataURL_sync("ñ ✓", MIME_TYPES.text);
    expect(dataURLToString(dataURL)).toBe("ñ ✓");
  });

  it("dataURLToFile creates a typed file with the decoded bytes", async () => {
    const file = dataURLToFile(
      "data:image/svg+xml;base64,PHN2Zy8+" as DataURL,
      "drawing.svg",
    );
    expect(file.name).toBe("drawing.svg");
    expect(file.type).toBe(MIME_TYPES.svg);
    expect(await readAsText(file)).toBe("<svg/>");
  });

  it("getDataURL reads blobs asynchronously", async () => {
    const dataURL = await getDataURL(
      new Blob(["hello"], { type: MIME_TYPES.text }),
    );
    expect(dataURL).toBe("data:text/plain;base64,aGVsbG8=");
  });
});

describe("file helpers", () => {
  it("createFile and SVGStringToFile set name and type", async () => {
    const file = createFile(new Blob(["x"]), MIME_TYPES.png, undefined);
    expect(file.name).toBe("");
    expect(file.type).toBe(MIME_TYPES.png);

    const svg = SVGStringToFile("<svg></svg>", "a.svg");
    expect(svg.name).toBe("a.svg");
    expect(svg.type).toBe(MIME_TYPES.svg);
    expect(await readAsText(svg)).toBe("<svg></svg>");
  });

  it("normalizeFile assigns excalidraw/library mime types by extension", async () => {
    const lib = await normalizeFile(new File(["{}"], "items.excalidrawlib"));
    expect(lib.type).toBe(MIME_TYPES.excalidrawlib);

    const scene = await normalizeFile(new File(["{}"], "scene.excalidraw"));
    expect(scene.type).toBe(MIME_TYPES.excalidraw);
    // already normalized files are returned as-is
    expect(await normalizeFile(scene)).toBe(scene);
  });

  it("normalizeFile detects the real image type from leading bytes", async () => {
    const png = withArrayBuffer(
      new File([], "image.jpg", { type: MIME_TYPES.jpg }),
      PNG_HEADER,
    );
    expect((await normalizeFile(png)).type).toBe(MIME_TYPES.png);

    const jpg = withArrayBuffer(new File([], "image"), JPG_HEADER);
    expect((await normalizeFile(jpg)).type).toBe(MIME_TYPES.jpg);

    const unknown = withArrayBuffer(
      new File([], "image.webp", { type: MIME_TYPES.webp }),
      [1, 2, 3],
    );
    const normalizedUnknown = await normalizeFile(unknown);
    expect(normalizedUnknown).toBe(unknown);
    expect(normalizedUnknown.type).toBe(MIME_TYPES.webp);
  });

  it("generateIdFromFile returns the SHA-1 hex digest", async () => {
    const file = new File([], "a.txt");
    // Node-realm buffer, which Node's SubtleCrypto accepts
    (file as any).arrayBuffer = () =>
      Promise.resolve(new TextEncoder().encode("abc").buffer);
    expect(await generateIdFromFile(file)).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
  });

  it("generateIdFromFile falls back to a random 40-char id", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const digest = vi
      .spyOn(window.crypto.subtle, "digest")
      .mockRejectedValueOnce(new Error("unsupported"));
    const file = withArrayBuffer(new File([], "a.txt"), [1]);
    const id = await generateIdFromFile(file);
    expect(id).toHaveLength(40);
    expect(id).not.toMatch(/^[0-9a-f]{40}$/);
    digest.mockRestore();
    errorSpy.mockRestore();
  });

  it("resizeImageFile returns SVGs untouched and rejects unsupported files", async () => {
    const svg = SVGStringToFile("<svg/>");
    expect(await resizeImageFile(svg, { maxWidthOrHeight: 10 })).toBe(svg);

    await expect(
      resizeImageFile(new File(["x"], "a.txt", { type: "text/plain" }), {
        maxWidthOrHeight: 10,
      }),
    ).rejects.toThrow("Error: unsupported file type");
  });
});

describe("canvasToBlob", () => {
  it("resolves with the canvas blob (also for promised canvases)", async () => {
    const blob = new Blob(["png"], { type: MIME_TYPES.png });
    const canvas = {
      toBlob: (cb: (b: Blob | null) => void) => cb(blob),
    } as unknown as HTMLCanvasElement;
    expect(await canvasToBlob(canvas)).toBe(blob);
    expect(await canvasToBlob(Promise.resolve(canvas))).toBe(blob);
  });

  it("rejects with a CanvasError when the canvas is too big", async () => {
    const canvas = {
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    } as unknown as HTMLCanvasElement;
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

describe("ImageURLToFile", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns a File for supported images", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["x"], { type: MIME_TYPES.png })),
    });
    const file = await ImageURLToFile("https://example.com/a.png", "a.png");
    expect(file).toBeInstanceOf(File);
    expect(file!.name).toBe("a.png");
    expect(file!.type).toBe(MIME_TYPES.png);
  });

  it("throws for unsupported types", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["x"], { type: "text/html" })),
    });
    await expect(ImageURLToFile("https://example.com")).rejects.toMatchObject({
      cause: "UNSUPPORTED",
    });
  });

  it("throws FETCH_ERROR for failed or non-ok responses", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(ImageURLToFile("https://example.com")).rejects.toMatchObject({
      cause: "FETCH_ERROR",
    });

    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    await expect(ImageURLToFile("https://example.com")).rejects.toMatchObject({
      cause: "FETCH_ERROR",
    });
  });
});

describe("loading scenes and libraries from blobs", () => {
  const rectangle = {
    id: "rect",
    type: "rectangle",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
  };

  const sceneBlob = (extra: Record<string, unknown> = {}) =>
    new Blob(
      [
        JSON.stringify({
          type: "excalidraw",
          version: 2,
          elements: [rectangle],
          appState: { viewBackgroundColor: "#ffc9c9" },
          files: {},
          ...extra,
        }),
      ],
      { type: MIME_TYPES.json },
    );

  const libraryJSON = serializeLibraryAsJSON([
    {
      id: "item",
      status: "published",
      created: 1,
      elements: [rectangle as any],
    },
  ]);

  it("loads a scene, restoring elements and appState", async () => {
    const result = await loadSceneOrLibraryFromBlob(sceneBlob(), null, null);
    expect(result.type).toBe(MIME_TYPES.excalidraw);
    const data = result.data as Awaited<ReturnType<typeof loadFromBlob>>;
    expect(data.elements).toHaveLength(1);
    expect(data.elements[0]).toMatchObject({
      id: "rect",
      type: "rectangle",
      x: 10,
    });
    expect(data.appState.viewBackgroundColor).toBe("#ffc9c9");
    expect(data.files).toEqual({});
  });

  it("loads a serialized scene via loadFromBlob", async () => {
    const blob = new Blob(
      [
        serializeAsJSON(
          [rectangle as any],
          { viewBackgroundColor: "#a5d8ff" },
          {},
          "local",
        ),
      ],
      { type: MIME_TYPES.json },
    );
    const data = await loadFromBlob(blob, null, null);
    expect(data.elements.map((el) => el.id)).toEqual(["rect"]);
    expect(data.appState.viewBackgroundColor).toBe("#a5d8ff");
  });

  it("detects libraries", async () => {
    const result = await loadSceneOrLibraryFromBlob(
      new Blob([libraryJSON], { type: MIME_TYPES.json }),
      null,
      null,
    );
    expect(result.type).toBe(MIME_TYPES.excalidrawlib);

    await expect(
      loadFromBlob(
        new Blob([libraryJSON], { type: MIME_TYPES.json }),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");
  });

  it("rejects invalid JSON and unknown data", async () => {
    await expect(
      loadSceneOrLibraryFromBlob(new Blob(["not json"]), null, null),
    ).rejects.toThrow("Error: invalid file");
    await expect(
      loadSceneOrLibraryFromBlob(
        new Blob([JSON.stringify({ type: "other" })]),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");
  });

  it("throws ImageSceneDataError for SVGs without a scene", async () => {
    const error = await loadSceneOrLibraryFromBlob(
      new Blob(["<svg></svg>"], { type: MIME_TYPES.svg }),
      null,
      null,
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ImageSceneDataError);
    expect(error.code).toBe("IMAGE_NOT_CONTAINS_SCENE_DATA");
  });

  it("parseLibraryJSON / loadLibraryFromBlob restore library items", async () => {
    const items = parseLibraryJSON(libraryJSON);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "item", status: "published" });

    // v1 libraries use `library` (array of element arrays) and get the default status
    const v1 = JSON.stringify({
      type: "excalidrawlib",
      version: 1,
      library: [[rectangle]],
    });
    const v1Items = await loadLibraryFromBlob(new Blob([v1]), "published");
    expect(v1Items).toHaveLength(1);
    expect(v1Items[0].status).toBe("published");
    expect(v1Items[0].elements[0].id).toBe("rect");

    expect(() => parseLibraryJSON(JSON.stringify({ type: "x" }))).toThrow(
      "Invalid library",
    );
  });
});
