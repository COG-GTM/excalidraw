import { MIME_TYPES, SVG_NS } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type {
  AppClassProperties,
  BinaryFileData,
  BinaryFiles,
  DataURL,
} from "@excalidraw/excalidraw/types";

import {
  getInitializedImageElements,
  isHTMLSVGElement,
  loadHTMLImageElement,
  normalizeSVG,
  updateImageCache,
} from "../src/image";

import type { FileId } from "../src/types";

const PNG_DATA_URL = "data:image/png;base64,AAAA" as DataURL;
const BROKEN_DATA_URL = "data:image/png;base64,broken" as DataURL;

// jsdom never loads images, so drive onload/onerror from the assigned src
class MockImage {
  onload: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (value === BROKEN_DATA_URL) {
        this.onerror?.(new Error("load failed"));
      } else {
        this.onload?.();
      }
    });
  }
}

const file = (
  id: string,
  mimeType: BinaryFileData["mimeType"] = MIME_TYPES.png,
  dataURL: DataURL = PNG_DATA_URL,
): BinaryFileData => ({
  id: id as FileId,
  mimeType,
  dataURL,
  created: 1,
});

const parseSVG = (svg: string) =>
  new DOMParser()
    .parseFromString(svg, MIME_TYPES.svg)
    .querySelector("svg") as SVGElement;

describe("loadHTMLImageElement", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", MockImage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the image once it loads", async () => {
    const image = await loadHTMLImageElement(PNG_DATA_URL);
    expect(image).toBeInstanceOf(MockImage);
    expect(image.src).toBe(PNG_DATA_URL);
  });

  it("rejects when the image fails to load", async () => {
    await expect(loadHTMLImageElement(BROKEN_DATA_URL)).rejects.toThrow(
      "load failed",
    );
  });
});

describe("updateImageCache", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", MockImage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads image files into the cache", async () => {
    const imageCache: AppClassProperties["imageCache"] = new Map();
    const files: BinaryFiles = { a: file("a"), b: file("b", MIME_TYPES.svg) };

    const result = await updateImageCache({
      fileIds: ["a", "b"] as FileId[],
      files,
      imageCache,
    });

    expect(result.imageCache).toBe(imageCache);
    expect([...result.updatedFiles.keys()]).toEqual(["a", "b"]);
    expect(result.erroredFiles.size).toBe(0);

    const entryA = imageCache.get("a" as FileId)!;
    expect(entryA.mimeType).toBe(MIME_TYPES.png);
    // the in-progress promise is replaced with the loaded image
    expect(entryA.image).toBeInstanceOf(MockImage);
    expect(imageCache.get("b" as FileId)!.mimeType).toBe(MIME_TYPES.svg);
  });

  it("skips file ids that have no file data", async () => {
    const imageCache: AppClassProperties["imageCache"] = new Map();

    const result = await updateImageCache({
      fileIds: ["missing"] as FileId[],
      files: {},
      imageCache,
    });

    expect(result.updatedFiles.size).toBe(0);
    expect(result.erroredFiles.size).toBe(0);
    expect(imageCache.size).toBe(0);
  });

  it("processes duplicate file ids only once", async () => {
    const imageCache: AppClassProperties["imageCache"] = new Map();
    const setSpy = vi.spyOn(imageCache, "set");

    await updateImageCache({
      fileIds: ["a", "a", "a"] as FileId[],
      files: { a: file("a") },
      imageCache,
    });

    // once with the pending promise, once with the loaded image
    expect(setSpy).toHaveBeenCalledTimes(2);
  });

  it("marks non-image (binary) files as errored without caching them", async () => {
    const imageCache: AppClassProperties["imageCache"] = new Map();

    const result = await updateImageCache({
      fileIds: ["bin"] as FileId[],
      files: { bin: file("bin", MIME_TYPES.binary) },
      imageCache,
    });

    expect(result.updatedFiles.has("bin" as FileId)).toBe(true);
    expect(result.erroredFiles.has("bin" as FileId)).toBe(true);
    expect(imageCache.has("bin" as FileId)).toBe(false);
  });

  it("marks files whose image fails to load as errored", async () => {
    const imageCache: AppClassProperties["imageCache"] = new Map();

    const result = await updateImageCache({
      fileIds: ["ok", "bad"] as FileId[],
      files: {
        ok: file("ok"),
        bad: file("bad", MIME_TYPES.png, BROKEN_DATA_URL),
      },
      imageCache,
    });

    expect([...result.erroredFiles.keys()]).toEqual(["bad"]);
    expect(result.updatedFiles.size).toBe(2);
    expect(imageCache.get("ok" as FileId)!.image).toBeInstanceOf(MockImage);
    // the pending entry is left in the cache for the failed file
    expect(imageCache.get("bad" as FileId)!.image).toBeInstanceOf(Promise);
  });
});

describe("getInitializedImageElements", () => {
  it("returns only image elements that have a fileId", () => {
    const initialized = API.createElement({
      type: "image",
      fileId: "file-1" as FileId,
    });
    const pending = API.createElement({ type: "image" });
    const rect = API.createElement({ type: "rectangle" });

    expect(getInitializedImageElements([rect, pending, initialized])).toEqual([
      initialized,
    ]);
    expect(getInitializedImageElements([])).toEqual([]);
  });
});

describe("isHTMLSVGElement", () => {
  it("detects svg nodes regardless of case", () => {
    expect(isHTMLSVGElement(parseSVG(`<svg xmlns="${SVG_NS}"/>`))).toBe(true);
    const htmlDoc = document.createElement("div");
    htmlDoc.innerHTML = "<SVG></SVG>";
    expect(isHTMLSVGElement(htmlDoc.firstChild)).toBe(true);
  });

  it("rejects other nodes and null", () => {
    expect(isHTMLSVGElement(document.createElement("div"))).toBe(false);
    expect(isHTMLSVGElement(null)).toBe(false);
  });
});

describe("normalizeSVG", () => {
  it("throws for invalid SVG markup", () => {
    expect(() => normalizeSVG("<svg><g></svg>")).toThrow("Invalid SVG");
    expect(() => normalizeSVG("<div/>")).toThrow("Invalid SVG");
  });

  it("keeps explicit dimensions and viewBox", () => {
    const svg = parseSVG(
      normalizeSVG(
        `<svg xmlns="${SVG_NS}" width="10" height="20" viewBox="0 0 10 20"/>`,
      ),
    );
    expect(svg.getAttribute("xmlns")).toBe(SVG_NS);
    expect(svg.getAttribute("width")).toBe("10");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.getAttribute("viewBox")).toBe("0 0 10 20");
  });

  it("derives a viewBox from explicit width and height", () => {
    const svg = parseSVG(
      normalizeSVG(`<svg xmlns="${SVG_NS}" width="30" height="40"/>`),
    );
    expect(svg.getAttribute("viewBox")).toBe("0 0 30 40");
  });

  it("defaults missing dimensions to 50 when there is no viewBox", () => {
    const svg = parseSVG(normalizeSVG(`<svg xmlns="${SVG_NS}"/>`));
    expect(svg.getAttribute("width")).toBe("50");
    expect(svg.getAttribute("height")).toBe("50");
    expect(svg.getAttribute("viewBox")).toBe("0 0 50 50");
  });

  it("takes dimensions from the viewBox when width/height are missing", () => {
    const svg = parseSVG(
      normalizeSVG(`<svg xmlns="${SVG_NS}" viewBox="0 0 120.5 80"/>`),
    );
    expect(svg.getAttribute("width")).toBe("120.5");
    expect(svg.getAttribute("height")).toBe("80");
    expect(svg.getAttribute("viewBox")).toBe("0 0 120.5 80");
  });

  it("ignores percentage and auto dimensions", () => {
    const svg = parseSVG(
      normalizeSVG(
        `<svg xmlns="${SVG_NS}" width="100%" height="auto" viewBox="0 0 64 32"/>`,
      ),
    );
    expect(svg.getAttribute("width")).toBe("64");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("keeps the 50px fallback when the viewBox cannot be parsed", () => {
    const svg = parseSVG(
      normalizeSVG(`<svg xmlns="${SVG_NS}" height="auto" viewBox="bogus"/>`),
    );
    expect(svg.getAttribute("width")).toBe("50");
    expect(svg.getAttribute("height")).toBe("50");
    expect(svg.getAttribute("viewBox")).toBe("bogus");
  });

  it("only fills in the missing dimension", () => {
    const svg = parseSVG(normalizeSVG(`<svg xmlns="${SVG_NS}" width="70"/>`));
    expect(svg.getAttribute("width")).toBe("70");
    expect(svg.getAttribute("height")).toBe("50");
    expect(svg.getAttribute("viewBox")).toBe("0 0 70 50");
  });
});
