import { MIME_TYPES } from "@excalidraw/common";
import * as mockedSceneExportUtils from "@excalidraw/excalidraw/scene/export";
import { diagramFactory } from "@excalidraw/excalidraw/tests/fixtures/diagramFixture";
import { vi } from "vitest";

import * as utils from "../src";

const exportToSvgSpy = vi.spyOn(mockedSceneExportUtils, "exportToSvg");

describe("exportToCanvas", async () => {
  const EXPORT_PADDING = 10;

  it("with default arguments", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("when custom width and height", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      getDimensions: () => ({ width: 200, height: 200, scale: 1 }),
    });

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  it("defaults the scale to 1 when getDimensions omits it", async () => {
    const getDimensions = vi.fn((width: number, height: number) => ({
      width: width * 2,
      height: height * 2,
    }));
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      getDimensions,
    });

    expect(getDimensions).toHaveBeenCalledWith(
      100 + 2 * EXPORT_PADDING,
      100 + 2 * EXPORT_PADDING,
    );
    expect(canvas.width).toBe(2 * (100 + 2 * EXPORT_PADDING));
    expect(canvas.height).toBe(2 * (100 + 2 * EXPORT_PADDING));
  });

  it("with custom exportPadding", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      exportPadding: 0,
    });

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  it("scales down to maxWidthOrHeight when content is larger", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      maxWidthOrHeight: 60,
    });

    expect(canvas.width).toBe(60);
    expect(canvas.height).toBe(60);
  });

  it("falls back on appState.exportScale when content is smaller than maxWidthOrHeight", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({
        elementOverrides: { width: 100, height: 100 },
        overrides: {
          appState: {
            viewBackgroundColor: "#ffffff",
            gridModeEnabled: false,
            exportScale: 2,
          },
        },
      }),
      maxWidthOrHeight: 1000,
    });

    expect(canvas.width).toBe(2 * (100 + 2 * EXPORT_PADDING));
    expect(canvas.height).toBe(2 * (100 + 2 * EXPORT_PADDING));
  });

  it("uses a scale of 1 when content is smaller than maxWidthOrHeight and no exportScale is set", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({
        elementOverrides: { width: 100, height: 100 },
        overrides: { appState: undefined },
      }),
      maxWidthOrHeight: 1000,
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("warns and ignores getDimensions when maxWidthOrHeight is supplied", async () => {
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementationOnce(() => void 0);
    const getDimensions = vi.fn(() => ({ width: 500, height: 500, scale: 1 }));

    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      maxWidthOrHeight: 60,
      getDimensions,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "`getDimensions()` is ignored when `maxWidthOrHeight` is supplied.",
    );
    expect(getDimensions).not.toHaveBeenCalled();
    expect(canvas.width).toBe(60);
    expect(canvas.height).toBe(60);
    consoleSpy.mockRestore();
  });

  it("excludes deleted elements", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({
        elementOverrides: { width: 100, height: 100, isDeleted: true },
      }),
    });

    // no visible content left, so only the padding remains
    expect(canvas.width).toBe(2 * EXPORT_PADDING);
    expect(canvas.height).toBe(2 * EXPORT_PADDING);
  });
});

describe("exportToBlob", async () => {
  describe("mime type", () => {
    it("should change image/jpg to image/jpeg", async () => {
      const blob = await utils.exportToBlob({
        ...diagramFactory(),
        getDimensions: (width, height) => ({ width, height, scale: 1 }),
        // testing typo in MIME type (jpg → jpeg)
        mimeType: "image/jpg",
        appState: {
          exportBackground: true,
        },
      });
      expect(blob?.type).toBe(MIME_TYPES.jpg);
    });
    it("should default to image/png", async () => {
      const blob = await utils.exportToBlob({
        ...diagramFactory(),
      });
      expect(blob?.type).toBe(MIME_TYPES.png);
    });

    it("should warn when using quality with image/png", async () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementationOnce(() => void 0);
      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.png,
        quality: 1,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        `"quality" will be ignored for "${MIME_TYPES.png}" mimeType`,
      );
    });

    it("should default exportBackground to true for image/jpeg", async () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementationOnce(() => void 0);
      const blob = await utils.exportToBlob({
        ...diagramFactory({ overrides: { appState: undefined } }),
        mimeType: MIME_TYPES.jpg,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
      );
      expect(blob.type).toBe(MIME_TYPES.jpg);
      consoleSpy.mockRestore();
    });

    it("should not warn for image/jpeg when exportBackground is set", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      consoleSpy.mockClear();
      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.jpg,
        appState: { exportBackground: true },
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("quality", () => {
    const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");

    beforeEach(() => {
      toBlobSpy.mockClear();
    });

    it("should default to 0.92 for image/jpeg", async () => {
      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.jpg,
        appState: { exportBackground: true },
      });

      expect(toBlobSpy).toHaveBeenCalledTimes(1);
      expect(toBlobSpy.mock.calls[0][1]).toBe(MIME_TYPES.jpg);
      expect(toBlobSpy.mock.calls[0][2]).toBe(0.92);
    });

    it("should default to 0.8 for image/png", async () => {
      await utils.exportToBlob({ ...diagramFactory() });

      expect(toBlobSpy).toHaveBeenCalledTimes(1);
      expect(toBlobSpy.mock.calls[0][1]).toBe(MIME_TYPES.png);
      expect(toBlobSpy.mock.calls[0][2]).toBe(0.8);
    });

    it("should pass a custom quality through", async () => {
      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.jpg,
        appState: { exportBackground: true },
        quality: 0.5,
      });

      expect(toBlobSpy.mock.calls[0][2]).toBe(0.5);
    });
  });

  it("should reject when the canvas produces no blob", async () => {
    const toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementationOnce((callback) => callback(null));

    await expect(utils.exportToBlob({ ...diagramFactory() })).rejects.toThrow(
      "couldn't export to blob",
    );
    toBlobSpy.mockClear();
  });
});

describe("exportToSvg", () => {
  const passedElements = () => exportToSvgSpy.mock.calls[0][0];
  const passedOptions = () => exportToSvgSpy.mock.calls[0][1];

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("with default arguments", async () => {
    await utils.exportToSvg({
      ...diagramFactory({
        overrides: { appState: void 0 },
      }),
    });

    const passedOptionsWhenDefault = {
      ...passedOptions(),
      // To avoid varying snapshots
      name: "name",
    };
    expect(passedElements().length).toBe(3);
    expect(passedOptionsWhenDefault).toMatchSnapshot();
  });

  // Regression test: when all elements are deleted, exportToSvg should pass
  // zero elements to the lower-level export (line 184-188 of export.ts calls
  // getNonDeletedElements which filters them out).
  it("with deleted elements", async () => {
    await utils.exportToSvg({
      ...diagramFactory({
        overrides: { appState: void 0 },
        elementOverrides: { isDeleted: true },
      }),
    });

    expect(passedElements().length).toBe(0);
  });

  it("with exportPadding", async () => {
    await utils.exportToSvg({
      ...diagramFactory({
        overrides: { appState: { name: "diagram name" } },
      }),
      exportPadding: 0,
    });

    expect(passedElements().length).toBe(3);
    expect(passedOptions()).toEqual(
      expect.objectContaining({ exportPadding: 0 }),
    );
  });

  it("with exportEmbedScene", async () => {
    await utils.exportToSvg({
      ...diagramFactory({
        overrides: {
          appState: { name: "diagram name", exportEmbedScene: true },
        },
      }),
    });

    expect(passedElements().length).toBe(3);
    expect(passedOptions().exportEmbedScene).toBe(true);
  });

  it("passes export options through to the scene exporter", async () => {
    await utils.exportToSvg({
      ...diagramFactory(),
      renderEmbeddables: true,
      skipInliningFonts: true,
      reuseImages: false,
      exportingFrame: null,
    });

    expect(exportToSvgSpy.mock.calls[0][3]).toEqual({
      exportingFrame: null,
      renderEmbeddables: true,
      skipInliningFonts: true,
      reuseImages: false,
    });
  });
});
