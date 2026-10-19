import { createHash } from "crypto";
import fs from "fs";
import path from "path";

import { vi } from "vitest";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import { mockMultipleHTMLImageElements } from "../tests/helpers/mocks";
import { CanvasError, ImageSceneDataError } from "../errors";

import {
  canvasToBlob,
  generateIdFromFile,
  getMimeType,
  ImageURLToFile,
  loadFromBlob,
  loadLibraryFromBlob,
  loadSceneOrLibraryFromBlob,
  normalizeFile,
  resizeImageFile,
} from "./blob";

const reduceToBlobMock = vi.fn();
const picaToBlobMock = vi.fn();

vi.mock("pica", () => ({
  default: vi.fn(() => ({ toBlob: picaToBlobMock })),
}));

vi.mock("image-blob-reduce", () => ({
  default: vi.fn(({ pica }: { pica: unknown }) => ({
    pica,
    toBlob: reduceToBlobMock,
    _create_blob: null,
  })),
}));

const FIXTURES_DIR = path.resolve(__dirname, "../tests/fixtures");

const readFixture = (name: string) =>
  new Uint8Array(fs.readFileSync(path.join(FIXTURES_DIR, name)));

const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13];
const JPG_HEADER = [255, 216, 255, 224, 0, 16];
const GIF_HEADER = [71, 73, 70, 56, 57, 97, 1, 0];
const WEBP_HEADER = [
  82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32,
];

const sceneJSON = JSON.stringify({
  type: EXPORT_DATA_TYPES.excalidraw,
  version: 2,
  source: "test",
  elements: [
    {
      id: "rect-1",
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    },
  ],
  appState: { viewBackgroundColor: "#ff0000" },
  files: {},
});

const libraryJSON = JSON.stringify({
  type: EXPORT_DATA_TYPES.excalidrawLibrary,
  version: 2,
  source: "test",
  libraryItems: [
    {
      id: "lib-item-1",
      status: "published",
      created: 1,
      elements: [
        {
          id: "lib-rect-1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
    },
  ],
});

const readAsText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getMimeType", () => {
  it("prefers the blob's own type", () => {
    expect(
      getMimeType(new File([""], "drawing.png", { type: MIME_TYPES.jpg })),
    ).toBe(MIME_TYPES.jpg);
  });

  it("infers the type from the file name when the blob has no type", () => {
    expect(getMimeType(new File([""], "scene.excalidraw"))).toBe(
      MIME_TYPES.json,
    );
    expect(getMimeType("scene.json")).toBe(MIME_TYPES.json);
    expect(getMimeType("image.png")).toBe(MIME_TYPES.png);
    expect(getMimeType("image.jpg")).toBe(MIME_TYPES.jpg);
    expect(getMimeType("image.jpeg")).toBe(MIME_TYPES.jpg);
    expect(getMimeType("image.svg")).toBe(MIME_TYPES.svg);
    expect(getMimeType("items.excalidrawlib")).toBe(MIME_TYPES.excalidrawlib);
    expect(getMimeType("notes.txt")).toBe("");
  });
});

describe("loadSceneOrLibraryFromBlob / loadFromBlob", () => {
  it("restores a valid scene", async () => {
    const blob = new Blob([sceneJSON], { type: MIME_TYPES.json });

    const ret = await loadSceneOrLibraryFromBlob(blob, null, null);
    expect(ret.type).toBe(MIME_TYPES.excalidraw);

    const data = await loadFromBlob(blob, null, null);
    expect(data.elements).toEqual([
      expect.objectContaining({
        id: "rect-1",
        type: "rectangle",
        x: 10,
        y: 20,
      }),
    ]);
    expect(data.appState.viewBackgroundColor).toBe("#ff0000");
    expect(data.files).toEqual({});
  });

  it("returns library data for a valid library", async () => {
    const ret = await loadSceneOrLibraryFromBlob(
      new Blob([libraryJSON], { type: MIME_TYPES.json }),
      null,
      null,
    );
    expect(ret.type).toBe(MIME_TYPES.excalidrawlib);
    expect(ret.data).toEqual(JSON.parse(libraryJSON));
  });

  it("rejects non-JSON content", async () => {
    await expect(
      loadFromBlob(
        new Blob(["definitely { not json"], { type: MIME_TYPES.json }),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");
  });

  it("rejects JSON that is not an excalidraw scene", async () => {
    await expect(
      loadFromBlob(
        new Blob([JSON.stringify({ type: "something-else", elements: [] })], {
          type: MIME_TYPES.json,
        }),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");

    await expect(
      loadFromBlob(
        new Blob([JSON.stringify({ elements: [] })], {
          type: MIME_TYPES.json,
        }),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");
  });

  it("rejects a scene whose elements are not an array", async () => {
    await expect(
      loadFromBlob(
        new Blob(
          [
            JSON.stringify({
              type: EXPORT_DATA_TYPES.excalidraw,
              elements: "nope",
            }),
          ],
          { type: MIME_TYPES.json },
        ),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");
  });

  it("loadFromBlob rejects a library file", async () => {
    await expect(
      loadFromBlob(
        new Blob([libraryJSON], { type: MIME_TYPES.json }),
        null,
        null,
      ),
    ).rejects.toThrow("Error: invalid file");
  });

  it("throws IMAGE_NOT_CONTAINS_SCENE_DATA for a PNG without a scene", async () => {
    const png = new Blob([readFixture("smiley.png")], {
      type: MIME_TYPES.png,
    });

    const promise = loadFromBlob(png, null, null);
    await expect(promise).rejects.toBeInstanceOf(ImageSceneDataError);
    await expect(promise).rejects.toMatchObject({
      code: "IMAGE_NOT_CONTAINS_SCENE_DATA",
    });
  });

  it("throws IMAGE_NOT_CONTAINS_SCENE_DATA for an SVG without a scene", async () => {
    const svg = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>'],
      { type: MIME_TYPES.svg },
    );

    const promise = loadFromBlob(svg, null, null);
    await expect(promise).rejects.toBeInstanceOf(ImageSceneDataError);
    await expect(promise).rejects.toMatchObject({
      code: "IMAGE_NOT_CONTAINS_SCENE_DATA",
    });
  });

  it("throws IMAGE_SCENE_DATA_ERROR for an SVG with a corrupted scene payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const svg = new Blob(
      [
        `<svg xmlns="http://www.w3.org/2000/svg"><!-- svg-source:excalidraw --><!-- payload-type:${MIME_TYPES.excalidraw} --><!-- payload-version:2 --><!-- payload-start -->!!!not-base64!!!<!-- payload-end --></svg>`,
      ],
      { type: MIME_TYPES.svg },
    );

    const promise = loadFromBlob(svg, null, null);
    await expect(promise).rejects.toBeInstanceOf(ImageSceneDataError);
    await expect(promise).rejects.toMatchObject({
      code: "IMAGE_SCENE_DATA_ERROR",
    });
  });

  it("throws IMAGE_NOT_CONTAINS_SCENE_DATA for a non-JSON raster image", async () => {
    const jpg = new Blob([new Uint8Array(JPG_HEADER)], {
      type: MIME_TYPES.jpg,
    });

    const promise = loadFromBlob(jpg, null, null);
    await expect(promise).rejects.toBeInstanceOf(ImageSceneDataError);
    await expect(promise).rejects.toMatchObject({
      code: "IMAGE_NOT_CONTAINS_SCENE_DATA",
    });
  });
});

describe("loadLibraryFromBlob", () => {
  it("restores library items", async () => {
    const items = await loadLibraryFromBlob(
      new Blob([libraryJSON], { type: MIME_TYPES.json }),
    );
    expect(items).toEqual([
      expect.objectContaining({
        id: "lib-item-1",
        status: "published",
        elements: [expect.objectContaining({ id: "lib-rect-1" })],
      }),
    ]);
  });

  it("rejects a scene file", async () => {
    await expect(
      loadLibraryFromBlob(new Blob([sceneJSON], { type: MIME_TYPES.json })),
    ).rejects.toThrow("Invalid library");
  });

  it("rejects non-JSON content", async () => {
    await expect(
      loadLibraryFromBlob(new Blob(["nope"], { type: MIME_TYPES.json })),
    ).rejects.toThrow(SyntaxError);
  });
});

describe("normalizeFile", () => {
  it("sets the excalidraw MIME type on mislabeled .excalidraw files", async () => {
    const file = new File([sceneJSON], "scene.excalidraw", {
      type: "text/plain",
    });

    const normalized = await normalizeFile(file);

    expect(normalized).not.toBe(file);
    expect(normalized.type).toBe(MIME_TYPES.excalidraw);
    expect(normalized.name).toBe("scene.excalidraw");
    expect(await readAsText(normalized)).toBe(sceneJSON);
  });

  it("sets the excalidrawlib MIME type on .excalidrawlib files", async () => {
    const file = new File([libraryJSON], "items.excalidrawlib", {
      type: "",
    });

    const normalized = await normalizeFile(file);

    expect(normalized.type).toBe(MIME_TYPES.excalidrawlib);
    expect(normalized.name).toBe("items.excalidrawlib");
    expect(await readAsText(normalized)).toBe(libraryJSON);
  });

  it("corrects the MIME type of an image with a wrong type", async () => {
    const file = new File([readFixture("smiley.png")], "smiley.jpg", {
      type: MIME_TYPES.jpg,
    });

    const normalized = await normalizeFile(file);

    expect(normalized.type).toBe(MIME_TYPES.png);
    expect(normalized.name).toBe("smiley.jpg");
    expect(normalized.size).toBe(file.size);
  });

  it.each([
    ["png", PNG_HEADER, MIME_TYPES.png],
    ["jpg", JPG_HEADER, MIME_TYPES.jpg],
    ["gif", GIF_HEADER, MIME_TYPES.gif],
    ["webp", WEBP_HEADER, MIME_TYPES.webp],
  ])(
    "detects %s from leading bytes when the file has no type",
    async (_, bytes, expected) => {
      const file = new File([new Uint8Array(bytes)], "pasted");

      const normalized = await normalizeFile(file);

      expect(normalized.type).toBe(expected);
    },
  );

  it("keeps the file untouched when its image type is already correct", async () => {
    const file = new File([new Uint8Array(PNG_HEADER)], "image.png", {
      type: MIME_TYPES.png,
    });

    expect(await normalizeFile(file)).toBe(file);
  });

  it("keeps the declared type when leading bytes are unrecognized", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "image.bmp", {
      type: "image/bmp",
    });

    const normalized = await normalizeFile(file);

    expect(normalized).toBe(file);
    expect(normalized.type).toBe("image/bmp");
  });

  it("does not touch non-image files with a type", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    const normalized = await normalizeFile(file);

    expect(normalized).toBe(file);
    expect(normalized.type).toBe("text/plain");
  });

  it("does not normalize the same file twice", async () => {
    const file = new File([sceneJSON], "scene.excalidraw", {
      type: "text/plain",
    });

    const normalized = await normalizeFile(file);

    expect(await normalizeFile(normalized)).toBe(normalized);
  });
});

describe("ImageURLToFile", () => {
  it("returns a File for a supported image", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () =>
        new Blob([new Uint8Array(PNG_HEADER)], { type: MIME_TYPES.png }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = await ImageURLToFile("https://example.com/a.png", "a.png");

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/a.png");
    expect(file).toBeInstanceOf(File);
    expect(file!.name).toBe("a.png");
    expect(file!.type).toBe(MIME_TYPES.png);
    expect(file!.size).toBe(PNG_HEADER.length);
  });

  it("throws FETCH_ERROR when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net")));

    await expect(
      ImageURLToFile("https://example.com/a.png"),
    ).rejects.toMatchObject({
      message: "Error: failed to fetch image",
      cause: "FETCH_ERROR",
    });
  });

  it("throws FETCH_ERROR for a non-OK response", async () => {
    const blob = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, blob }),
    );

    await expect(
      ImageURLToFile("https://example.com/missing.png"),
    ).rejects.toMatchObject({
      message: "Error: failed to fetch image",
      cause: "FETCH_ERROR",
    });
    expect(blob).not.toHaveBeenCalled();
  });

  it("throws UNSUPPORTED for a non-image response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () =>
          new Blob(["<html></html>"], { type: MIME_TYPES.html }),
      }),
    );

    await expect(
      ImageURLToFile("https://example.com/page"),
    ).rejects.toMatchObject({
      message: "Error: unsupported file type",
      cause: "UNSUPPORTED",
    });
  });

  it("throws UNSUPPORTED for a response without a type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob([new Uint8Array(PNG_HEADER)]),
      }),
    );

    await expect(
      ImageURLToFile("https://example.com/unknown"),
    ).rejects.toMatchObject({ cause: "UNSUPPORTED" });
  });
});

describe("generateIdFromFile", () => {
  it("returns the SHA-1 hex digest of the file", async () => {
    const bytes = readFixture("smiley.png");
    const file = new File([bytes], "smiley.png", { type: MIME_TYPES.png });

    const id = await generateIdFromFile(file);

    expect(id).toBe(createHash("sha1").update(bytes).digest("hex"));
  });

  it("falls back to a random 40-char id when hashing fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const digestError = new Error("digest unsupported");
    vi.spyOn(window.crypto.subtle, "digest").mockRejectedValue(digestError);

    const file = new File(["abc"], "a.txt");
    const id1 = await generateIdFromFile(file);
    const id2 = await generateIdFromFile(file);

    expect(id1).toHaveLength(40);
    expect(id2).toHaveLength(40);
    expect(id1).not.toBe(id2);
    expect(id1).not.toMatch(/^[0-9a-f]{40}$/);
    expect(consoleError).toHaveBeenCalledWith(digestError);
  });
});

describe("canvasToBlob", () => {
  const createCanvas = (blob: Blob | null) =>
    ({
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => cb(blob)),
    } as unknown as HTMLCanvasElement);

  it("resolves with the canvas blob", async () => {
    const blob = new Blob(["png"], { type: MIME_TYPES.png });
    await expect(canvasToBlob(createCanvas(blob))).resolves.toBe(blob);
  });

  it("awaits a canvas promise", async () => {
    const blob = new Blob(["png"], { type: MIME_TYPES.png });
    await expect(
      canvasToBlob(Promise.resolve(createCanvas(blob))),
    ).resolves.toBe(blob);
  });

  it("rejects with CANVAS_POSSIBLY_TOO_BIG when toBlob yields null", async () => {
    const promise = canvasToBlob(createCanvas(null));

    await expect(promise).rejects.toBeInstanceOf(CanvasError);
    await expect(promise).rejects.toMatchObject({
      name: "CANVAS_POSSIBLY_TOO_BIG",
      message: "Error: Canvas too big",
    });
  });

  it("rejects when the canvas promise rejects", async () => {
    const error = new Error("render failed");
    await expect(canvasToBlob(Promise.reject(error))).rejects.toBe(error);
  });
});

describe("resizeImageFile", () => {
  beforeEach(() => {
    reduceToBlobMock.mockReset();
    picaToBlobMock.mockReset();
  });

  it("returns SVG files unchanged", async () => {
    const svg = new File(["<svg></svg>"], "a.svg", { type: MIME_TYPES.svg });

    await expect(resizeImageFile(svg, { maxWidthOrHeight: 1 })).resolves.toBe(
      svg,
    );
    expect(reduceToBlobMock).not.toHaveBeenCalled();
  });

  it("throws UNSUPPORTED for non-image files", async () => {
    const file = new File(["hello"], "a.txt", { type: "text/plain" });

    await expect(
      resizeImageFile(file, { maxWidthOrHeight: 100 }),
    ).rejects.toMatchObject({
      message: "Error: unsupported file type",
      cause: "UNSUPPORTED",
    });
    expect(reduceToBlobMock).not.toHaveBeenCalled();
  });

  it("downscales images larger than maxWidthOrHeight", async () => {
    mockMultipleHTMLImageElements([[400, 300]]);
    const resized = new Blob([new Uint8Array([9, 9])], {
      type: MIME_TYPES.png,
    });
    reduceToBlobMock.mockResolvedValue(resized);

    const file = new File([new Uint8Array(PNG_HEADER)], "big.png", {
      type: MIME_TYPES.png,
    });

    const result = await resizeImageFile(file, { maxWidthOrHeight: 200 });

    expect(reduceToBlobMock).toHaveBeenCalledWith(file, {
      max: 200,
      alpha: true,
    });
    expect(result).not.toBe(file);
    expect(result.name).toBe("big.png");
    expect(result.type).toBe(MIME_TYPES.png);
    expect(result.size).toBe(resized.size);
  });

  it("converts to the requested output type", async () => {
    const converted = new Blob([new Uint8Array([7])], {
      type: MIME_TYPES.jpg,
    });
    picaToBlobMock.mockResolvedValue(converted);
    reduceToBlobMock.mockImplementation(async function (this: any) {
      const env = await this._create_blob({ out_canvas: "canvas" });
      return env.out_blob;
    });

    const file = new File([new Uint8Array(PNG_HEADER)], "small.png", {
      type: MIME_TYPES.png,
    });

    const result = await resizeImageFile(file, {
      maxWidthOrHeight: 200,
      outputType: MIME_TYPES.jpg,
    });

    expect(picaToBlobMock).toHaveBeenCalledWith("canvas", MIME_TYPES.jpg, 0.8);
    expect(result.name).toBe("small.png");
    expect(result.type).toBe(MIME_TYPES.jpg);
    expect(result.size).toBe(converted.size);
  });
});
