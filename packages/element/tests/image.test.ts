import { MIME_TYPES, SVG_NS } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type {
  AppClassProperties,
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

const parseSVG = (svgString: string) =>
  new DOMParser()
    .parseFromString(svgString, MIME_TYPES.svg)
    .querySelector("svg")!;

describe("normalizeSVG", () => {
  it("throws on invalid SVG", () => {
    expect(() => normalizeSVG("<div></div>")).toThrow("Invalid SVG");
    expect(() => normalizeSVG("<svg><unclosed></svg>")).toThrow("Invalid SVG");
  });

  // NOTE: inputs carry `xmlns` because jsdom rejects `setAttribute("xmlns")`
  // on XML documents ("Invalid attribute localName value"), unlike browsers
  it("adds default dimensions and viewBox", () => {
    const svg = parseSVG(normalizeSVG(`<svg xmlns="${SVG_NS}"></svg>`));

    expect(svg.getAttribute("width")).toBe("50");
    expect(svg.getAttribute("height")).toBe("50");
    expect(svg.getAttribute("viewBox")).toBe("0 0 50 50");
  });

  it("keeps explicit dimensions and viewBox untouched", () => {
    const svg = parseSVG(
      normalizeSVG(
        `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 10 10"></svg>`,
      ),
    );

    expect(svg.getAttribute("width")).toBe("120");
    expect(svg.getAttribute("height")).toBe("80");
    expect(svg.getAttribute("viewBox")).toBe("0 0 10 10");
  });

  it("derives dimensions from viewBox when width/height are relative", () => {
    const svg = parseSVG(
      normalizeSVG(
        `<svg xmlns="${SVG_NS}" width="100%" height="auto" viewBox="0 0 300.5 150"></svg>`,
      ),
    );

    expect(svg.getAttribute("width")).toBe("300.5");
    expect(svg.getAttribute("height")).toBe("150");
    expect(svg.getAttribute("viewBox")).toBe("0 0 300.5 150");
  });

  it("falls back to defaults when viewBox can't be parsed", () => {
    const svg = parseSVG(
      normalizeSVG(
        `<svg xmlns="${SVG_NS}" width="auto" height="50%" viewBox="foo"></svg>`,
      ),
    );

    expect(svg.getAttribute("width")).toBe("50");
    expect(svg.getAttribute("height")).toBe("50");
  });

  it("fills in only the missing dimension", () => {
    const svg = parseSVG(
      normalizeSVG(`<svg xmlns="${SVG_NS}" width="30"></svg>`),
    );

    expect(svg.getAttribute("width")).toBe("30");
    expect(svg.getAttribute("height")).toBe("50");
    expect(svg.getAttribute("viewBox")).toBe("0 0 30 50");
  });
});

describe("isHTMLSVGElement", () => {
  it("detects svg nodes regardless of case", () => {
    expect(isHTMLSVGElement(parseSVG("<svg></svg>"))).toBe(true);
    expect(isHTMLSVGElement(document.createElement("div"))).toBe(false);
    expect(isHTMLSVGElement(null)).toBe(false);
  });
});

describe("getInitializedImageElements", () => {
  it("returns only image elements with a fileId", () => {
    const initialized = API.createElement({
      type: "image",
      fileId: "file-1",
    });
    const uninitialized = API.createElement({ type: "image" });
    const rect = API.createElement({ type: "rectangle" });

    expect(
      getInitializedImageElements([initialized, uninitialized, rect]),
    ).toEqual([initialized]);
  });
});

describe("image loading", () => {
  const OriginalImage = window.Image;

  class MockImage {
    onload: (() => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;
    private _src = "";

    get src() {
      return this._src;
    }

    set src(value: string) {
      this._src = value;
      setTimeout(() => {
        if (value.includes("broken")) {
          this.onerror?.(new Error("load error"));
        } else {
          this.onload?.();
        }
      });
    }
  }

  beforeEach(() => {
    window.Image = MockImage as unknown as typeof Image;
  });

  afterEach(() => {
    window.Image = OriginalImage;
  });

  it("loadHTMLImageElement resolves on load and rejects on error", async () => {
    const image = await loadHTMLImageElement(
      "data:image/png;base64,ok" as DataURL,
    );
    expect(image.src).toBe("data:image/png;base64,ok");

    await expect(
      loadHTMLImageElement("data:image/png;base64,broken" as DataURL),
    ).rejects.toThrow("load error");
  });

  it("updateImageCache caches loaded images and reports errored files", async () => {
    const files: BinaryFiles = {
      ok: {
        id: "ok" as FileId,
        mimeType: MIME_TYPES.png,
        dataURL: "data:image/png;base64,ok" as DataURL,
        created: 1,
      },
      broken: {
        id: "broken" as FileId,
        mimeType: MIME_TYPES.png,
        dataURL: "data:image/png;base64,broken" as DataURL,
        created: 1,
      },
      binary: {
        id: "binary" as FileId,
        mimeType: MIME_TYPES.binary,
        dataURL: "data:application/octet-stream;base64,xx" as DataURL,
        created: 1,
      },
    };

    const imageCache: AppClassProperties["imageCache"] = new Map();

    const { updatedFiles, erroredFiles } = await updateImageCache({
      fileIds: [
        "ok",
        "ok",
        "broken",
        "binary",
        "missing",
      ] as unknown as FileId[],
      files,
      imageCache,
    });

    expect([...updatedFiles.keys()].sort()).toEqual(["binary", "broken", "ok"]);
    expect([...erroredFiles.keys()].sort()).toEqual(["binary", "broken"]);

    const cached = imageCache.get("ok" as FileId)!;
    expect(cached.mimeType).toBe(MIME_TYPES.png);
    expect(cached.image).toBeInstanceOf(MockImage);
    // binary files never make it into the cache
    expect(imageCache.has("binary" as FileId)).toBe(false);
  });
});
