import { MIME_TYPES } from "@excalidraw/common";
import * as clipboard from "@excalidraw/excalidraw/clipboard";
import * as imageUtils from "@excalidraw/excalidraw/data/image";
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

describe("exportToCanvas with maxWidthOrHeight", () => {
  const EXPORT_PADDING = 10;
  const SIZE = 100 + 2 * EXPORT_PADDING;

  it("scales the canvas down to fit maxWidthOrHeight", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      maxWidthOrHeight: SIZE / 2,
    });

    expect(canvas.width).toBe(SIZE / 2);
    expect(canvas.height).toBe(SIZE / 2);
  });

  it("falls back to appState.exportScale when content is smaller", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      appState: { exportScale: 2 },
      maxWidthOrHeight: 1000,
    });

    expect(canvas.width).toBe(SIZE * 2);
    expect(canvas.height).toBe(SIZE * 2);
  });

  it("falls back to scale 1 when content is smaller and no exportScale", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      appState: {},
      maxWidthOrHeight: 1000,
    });

    expect(canvas.width).toBe(SIZE);
    expect(canvas.height).toBe(SIZE);
  });

  it("ignores getDimensions and warns when maxWidthOrHeight is supplied", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => void 0);
    const getDimensions = vi.fn(() => ({ width: 500, height: 500 }));

    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      maxWidthOrHeight: SIZE / 2,
      getDimensions,
    });

    expect(getDimensions).not.toHaveBeenCalled();
    expect(canvas.width).toBe(SIZE / 2);
    expect(warnSpy).toHaveBeenCalledWith(
      "`getDimensions()` is ignored when `maxWidthOrHeight` is supplied.",
    );
    warnSpy.mockRestore();
  });

  it("passes the content size to getDimensions", async () => {
    const getDimensions = vi.fn((width: number, height: number) => ({
      width: width * 3,
      height: height * 3,
    }));

    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      getDimensions,
    });

    expect(getDimensions).toHaveBeenCalledWith(SIZE, SIZE);
    expect(canvas.width).toBe(SIZE * 3);
    expect(canvas.height).toBe(SIZE * 3);
  });
});

describe("exportToBlob options", () => {
  // toBlob is already a mock (vitest-canvas-mock), so clear calls from
  // previous tests before asserting on them
  const toBlobSpy = () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");
    spy.mockClear();
    return spy;
  };

  it("defaults exportBackground to true for image/jpeg and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => void 0);
    const canvasSpy = vi.spyOn(mockedSceneExportUtils, "exportToCanvas");

    const blob = await utils.exportToBlob({
      ...diagramFactory(),
      mimeType: MIME_TYPES.jpg,
      appState: { exportBackground: false },
    });

    expect(blob.type).toBe(MIME_TYPES.jpg);
    expect(warnSpy).toHaveBeenCalledWith(
      `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
    );
    expect(canvasSpy.mock.calls[0][3]).toEqual(
      expect.objectContaining({ exportBackground: true }),
    );
    canvasSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("does not warn for image/jpeg when exportBackground is already set", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => void 0);

    await utils.exportToBlob({
      ...diagramFactory(),
      mimeType: MIME_TYPES.jpg,
      appState: { exportBackground: true },
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("uses 0.92 default quality for jpeg and 0.8 for other types", async () => {
    const spy = toBlobSpy();

    await utils.exportToBlob({
      ...diagramFactory(),
      mimeType: MIME_TYPES.jpg,
      appState: { exportBackground: true },
    });
    await utils.exportToBlob({ ...diagramFactory() });

    expect(spy.mock.calls[0][1]).toBe(MIME_TYPES.jpg);
    expect(spy.mock.calls[0][2]).toBe(0.92);
    expect(spy.mock.calls[1][1]).toBe(MIME_TYPES.png);
    expect(spy.mock.calls[1][2]).toBe(0.8);
    spy.mockRestore();
  });

  it("passes an explicit quality through", async () => {
    const spy = toBlobSpy();

    await utils.exportToBlob({
      ...diagramFactory(),
      mimeType: MIME_TYPES.jpg,
      quality: 0.5,
      appState: { exportBackground: true },
    });

    expect(spy.mock.calls[0][2]).toBe(0.5);
    spy.mockRestore();
  });

  it("rejects when the canvas produces no blob", async () => {
    const spy = toBlobSpy().mockImplementation((callback: BlobCallback) =>
      callback(null),
    );

    await expect(utils.exportToBlob({ ...diagramFactory() })).rejects.toThrow(
      "couldn't export to blob",
    );
    spy.mockRestore();
  });

  it("embeds the scene into png metadata when exportEmbedScene is set", async () => {
    const encodedBlob = new Blob(["encoded"], { type: MIME_TYPES.png });
    const encodeSpy = vi
      .spyOn(imageUtils, "encodePngMetadata")
      .mockResolvedValue(encodedBlob);
    const diagram = diagramFactory();

    const blob = await utils.exportToBlob({
      ...diagram,
      appState: { exportEmbedScene: true },
    });

    expect(blob).toBe(encodedBlob);
    expect(encodeSpy).toHaveBeenCalledTimes(1);
    const { metadata } = encodeSpy.mock.calls[0][0];
    expect(
      JSON.parse(metadata).elements.map((el: { id: string }) => el.id),
    ).toEqual(diagram.elements.map((el) => el.id));
    encodeSpy.mockRestore();
  });

  it("does not embed the scene for non-png types", async () => {
    const encodeSpy = vi.spyOn(imageUtils, "encodePngMetadata");

    await utils.exportToBlob({
      ...diagramFactory(),
      mimeType: MIME_TYPES.jpg,
      appState: { exportEmbedScene: true, exportBackground: true },
    });

    expect(encodeSpy).not.toHaveBeenCalled();
    encodeSpy.mockRestore();
  });
});

describe("exportToClipboard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("copies the svg markup as text for type svg", async () => {
    const copySpy = vi
      .spyOn(clipboard, "copyTextToSystemClipboard")
      .mockResolvedValue(undefined);

    await utils.exportToClipboard({ ...diagramFactory(), type: "svg" });

    expect(copySpy).toHaveBeenCalledTimes(1);
    expect(copySpy.mock.calls[0][0]).toMatch(/^<svg[\s\S]*<\/svg>$/);
    copySpy.mockRestore();
  });

  it("copies a png blob for type png", async () => {
    const copySpy = vi
      .spyOn(clipboard, "copyBlobToClipboardAsPng")
      .mockResolvedValue(undefined);

    await utils.exportToClipboard({ ...diagramFactory(), type: "png" });

    expect(copySpy).toHaveBeenCalledTimes(1);
    const blob = await copySpy.mock.calls[0][0];
    expect(blob.type).toBe(MIME_TYPES.png);
    copySpy.mockRestore();
  });

  it("copies the elements and files for type json", async () => {
    const copySpy = vi
      .spyOn(clipboard, "copyToClipboard")
      .mockResolvedValue(undefined);
    const diagram = diagramFactory();

    await utils.exportToClipboard({ ...diagram, type: "json" });

    expect(copySpy).toHaveBeenCalledWith(diagram.elements, diagram.files);
    copySpy.mockRestore();
  });

  it("throws on an unknown export type", async () => {
    await expect(
      utils.exportToClipboard({
        ...diagramFactory(),
        type: "gif" as "png",
      }),
    ).rejects.toThrow("Invalid export type");
  });
});
