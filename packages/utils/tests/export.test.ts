import { MIME_TYPES } from "@excalidraw/common";
import * as clipboard from "@excalidraw/excalidraw/clipboard";
import * as imageData from "@excalidraw/excalidraw/data/image";
import * as mockedSceneExportUtils from "@excalidraw/excalidraw/scene/export";
import { diagramFactory } from "@excalidraw/excalidraw/tests/fixtures/diagramFixture";
import { vi } from "vitest";

import * as utils from "../src";

vi.mock("@excalidraw/excalidraw/clipboard", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@excalidraw/excalidraw/clipboard")
  >()),
  copyTextToSystemClipboard: vi.fn(),
  copyBlobToClipboardAsPng: vi.fn(),
  copyToClipboard: vi.fn(),
}));

vi.mock("@excalidraw/excalidraw/data/image", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@excalidraw/excalidraw/data/image")
  >()),
  encodePngMetadata: vi.fn(
    async () => new Blob(["embedded"], { type: "image/png" }),
  ),
}));

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

  it("scales down to maxWidthOrHeight when content is larger", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      maxWidthOrHeight: 60,
    });

    expect(canvas.width).toBe(60);
    expect(canvas.height).toBe(60);
  });

  it("falls back to exportScale when content fits maxWidthOrHeight", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({
        overrides: {
          appState: {
            viewBackgroundColor: "#ffffff",
            gridModeEnabled: false,
            exportScale: 2,
          },
        },
        elementOverrides: { width: 100, height: 100 },
      }),
      maxWidthOrHeight: 1000,
    });

    expect(canvas.width).toBe((100 + 2 * EXPORT_PADDING) * 2);
    expect(canvas.height).toBe((100 + 2 * EXPORT_PADDING) * 2);
  });

  it("uses scale 1 when content fits maxWidthOrHeight without exportScale", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      maxWidthOrHeight: 1000,
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("ignores getDimensions and warns when maxWidthOrHeight is set", async () => {
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementationOnce(() => void 0);
    const getDimensions = vi.fn(() => ({ width: 500, height: 500 }));

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
  });

  it("applies the exportPadding", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      exportPadding: 0,
    });

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
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
  });

  describe("quality and background", () => {
    const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");

    beforeEach(() => {
      toBlobSpy.mockClear();
    });

    it("defaults quality to 0.8 for png", async () => {
      await utils.exportToBlob({ ...diagramFactory() });

      expect(toBlobSpy).toHaveBeenCalledTimes(1);
      expect(toBlobSpy.mock.calls[0][1]).toBe(MIME_TYPES.png);
      expect(toBlobSpy.mock.calls[0][2]).toBe(0.8);
    });

    it("defaults quality to 0.92 for jpeg", async () => {
      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.jpg,
        appState: { exportBackground: true },
      });

      expect(toBlobSpy.mock.calls[0][1]).toBe(MIME_TYPES.jpg);
      expect(toBlobSpy.mock.calls[0][2]).toBe(0.92);
    });

    it("passes an explicit quality through", async () => {
      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.jpg,
        quality: 0.5,
        appState: { exportBackground: true },
      });

      expect(toBlobSpy.mock.calls[0][2]).toBe(0.5);
    });

    it("forces exportBackground on and warns for jpeg", async () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementationOnce(() => void 0);
      const exportToCanvasSpy = vi.spyOn(
        mockedSceneExportUtils,
        "exportToCanvas",
      );
      exportToCanvasSpy.mockClear();

      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.jpg,
        appState: { exportBackground: false },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
      );
      expect(exportToCanvasSpy.mock.calls[0][3]).toEqual(
        expect.objectContaining({ exportBackground: true }),
      );
      exportToCanvasSpy.mockRestore();
    });

    it("rejects when the canvas produces no blob", async () => {
      toBlobSpy.mockImplementationOnce((callback) => callback(null));

      await expect(utils.exportToBlob({ ...diagramFactory() })).rejects.toThrow(
        "couldn't export to blob",
      );
    });

    it("embeds the scene into png metadata when exportEmbedScene is set", async () => {
      const encodeSpy = vi.mocked(imageData.encodePngMetadata);
      encodeSpy.mockClear();
      const diagram = diagramFactory();

      const blob = await utils.exportToBlob({
        ...diagram,
        appState: { ...diagram.appState, exportEmbedScene: true },
      });

      expect(encodeSpy).toHaveBeenCalledTimes(1);
      const { metadata } = encodeSpy.mock.calls[0][0];
      expect(
        JSON.parse(metadata).elements.map((el: { id: string }) => el.id),
      ).toEqual(diagram.elements.map((el) => el.id));
      expect(blob).toBe(await encodeSpy.mock.results[0].value);
    });

    it("does not embed the scene for jpeg", async () => {
      const encodeSpy = vi.mocked(imageData.encodePngMetadata);
      encodeSpy.mockClear();

      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.jpg,
        appState: { exportBackground: true, exportEmbedScene: true },
      });

      expect(encodeSpy).not.toHaveBeenCalled();
    });
  });
});

describe("exportToClipboard", () => {
  beforeEach(() => {
    vi.mocked(clipboard.copyTextToSystemClipboard).mockClear();
    vi.mocked(clipboard.copyBlobToClipboardAsPng).mockClear();
    vi.mocked(clipboard.copyToClipboard).mockClear();
  });

  it("copies the svg markup as text for type svg", async () => {
    await utils.exportToClipboard({ ...diagramFactory(), type: "svg" });

    const copyText = vi.mocked(clipboard.copyTextToSystemClipboard);
    expect(copyText).toHaveBeenCalledTimes(1);
    expect(copyText.mock.calls[0][0]).toMatch(/^<svg/);
    expect(clipboard.copyBlobToClipboardAsPng).not.toHaveBeenCalled();
  });

  it("copies a png blob for type png", async () => {
    await utils.exportToClipboard({ ...diagramFactory(), type: "png" });

    const copyBlob = vi.mocked(clipboard.copyBlobToClipboardAsPng);
    expect(copyBlob).toHaveBeenCalledTimes(1);
    const blob = await copyBlob.mock.calls[0][0];
    expect(blob.type).toBe(MIME_TYPES.png);
    expect(clipboard.copyTextToSystemClipboard).not.toHaveBeenCalled();
  });

  it("copies elements and files for type json", async () => {
    const diagram = diagramFactory();

    await utils.exportToClipboard({ ...diagram, type: "json" });

    expect(clipboard.copyToClipboard).toHaveBeenCalledWith(
      diagram.elements,
      diagram.files,
    );
  });

  it("throws for an unknown type", async () => {
    await expect(
      utils.exportToClipboard({
        ...diagramFactory(),
        type: "pdf" as "png",
      }),
    ).rejects.toThrow("Invalid export type");
    expect(clipboard.copyToClipboard).not.toHaveBeenCalled();
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
});
