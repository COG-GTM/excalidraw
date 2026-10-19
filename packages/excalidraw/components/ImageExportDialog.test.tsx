import React from "react";

import { EXPORT_IMAGE_TYPES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { t } from "../i18n";
import { API } from "../tests/helpers/api";
import {
  act,
  fireEvent,
  render,
  toggleMenu,
  waitFor,
} from "../tests/test-utils";

const { h } = window;

const mocks = vi.hoisted(() => ({
  probablySupportsClipboardBlob: true,
  exportToCanvas: null as null | ((...args: any[]) => Promise<any>),
}));

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    get probablySupportsClipboardBlob() {
      return mocks.probablySupportsClipboardBlob;
    },
  };
});

vi.mock("@excalidraw/utils/export", async (importOriginal) => {
  const module = await importOriginal<
    typeof import("@excalidraw/utils/export")
  >();
  return {
    ...module,
    exportToCanvas: (...args: Parameters<typeof module.exportToCanvas>) =>
      mocks.exportToCanvas
        ? mocks.exportToCanvas(...args)
        : module.exportToCanvas(...args),
  };
});

const PREVIEW_CANVAS_CLASS = "ImageExportModal__preview__canvas";

const getOwnerDocument = () => h.app.ownerDocument;

const getSwitch = (name: string) =>
  getOwnerDocument().querySelector<HTMLInputElement>(
    `.ImageExportModal input[type="checkbox"][name="${name}"]`,
  );

const getScaleRadios = () =>
  Array.from(
    getOwnerDocument().querySelectorAll<HTMLInputElement>(
      '.ImageExportModal input[type="radio"][name="exportScale"]',
    ),
  );

const getButton = (label: string) =>
  getOwnerDocument().querySelector<HTMLButtonElement>(
    `.ImageExportModal button[aria-label="${label}"]`,
  );

const openImageExportDialog = async (container: HTMLElement) => {
  toggleMenu(container);
  fireEvent.click(
    container.querySelector("[data-testid='image-export-button']")!,
  );
  await waitFor(() => {
    expect(
      getOwnerDocument().querySelector(".ImageExportModal"),
    ).not.toBeNull();
  });
};

const getPreview = () =>
  getOwnerDocument().querySelector<HTMLElement>(`.${PREVIEW_CANVAS_CLASS}`);

const createPreviewCanvas = (blob: Blob | null) => {
  const canvas = getOwnerDocument().createElement("canvas");
  canvas.toBlob = (callback: BlobCallback) => callback(blob);
  return canvas;
};

// jsdom reports 0 for layout sizes, which makes the preview effect bail out
const mockPreviewDimensions = () => {
  const { HTMLElement } = h.app.ownerWindow;
  const offsetWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth",
  )!;
  const offsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  )!;
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains(PREVIEW_CANVAS_CLASS)
        ? 400
        : offsetWidth.get!.call(this);
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains(PREVIEW_CANVAS_CLASS)
        ? 300
        : offsetHeight.get!.call(this);
    },
  );
};

describe("<ImageExportDialog/>", () => {
  let onExportImageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.probablySupportsClipboardBlob = true;
    mocks.exportToCanvas = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithScene = async ({
    selectFirst = false,
    beforeOpen,
  }: { selectFirst?: boolean; beforeOpen?: () => void } = {}) => {
    const { container } = await render(<Excalidraw />);

    const rect1 = API.createElement({
      type: "rectangle",
      id: "rect1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      id: "rect2",
      x: 200,
      y: 200,
      width: 100,
      height: 100,
    });
    API.setElements([rect1, rect2]);
    if (selectFirst) {
      API.setSelectedElements([rect1]);
    }

    onExportImageSpy = vi
      .spyOn(h.app, "onExportImage")
      .mockResolvedValue(undefined) as any;

    beforeOpen?.();
    await openImageExportDialog(container);

    return { container, rect1, rect2 };
  };

  describe("settings", () => {
    it("initializes switches and scale from appState", async () => {
      await render(<Excalidraw />);
      act(() => {
        h.setState({
          exportBackground: false,
          exportEmbedScene: true,
          exportScale: 2,
        });
      });
      await openImageExportDialog(
        getOwnerDocument().querySelector(".excalidraw")!,
      );

      expect(getSwitch("exportBackgroundSwitch")?.checked).toBe(false);
      expect(getSwitch("exportEmbedSwitch")?.checked).toBe(true);
      expect(getSwitch("exportDarkModeSwitch")?.checked).toBe(false);
      expect(getScaleRadios().map((radio) => radio.checked)).toEqual([
        false,
        true,
        false,
      ]);
    });

    it("toggling background switch updates exportBackground", async () => {
      await renderWithScene();
      expect(h.state.exportBackground).toBe(true);
      expect(getSwitch("exportBackgroundSwitch")?.checked).toBe(true);

      fireEvent.click(getSwitch("exportBackgroundSwitch")!);

      expect(h.state.exportBackground).toBe(false);
      expect(getSwitch("exportBackgroundSwitch")?.checked).toBe(false);

      fireEvent.click(getSwitch("exportBackgroundSwitch")!);

      expect(h.state.exportBackground).toBe(true);
      expect(getSwitch("exportBackgroundSwitch")?.checked).toBe(true);
    });

    it("toggling dark mode switch updates exportWithDarkMode", async () => {
      await renderWithScene();
      expect(h.state.exportWithDarkMode).toBe(false);

      fireEvent.click(getSwitch("exportDarkModeSwitch")!);

      await waitFor(() => {
        expect(h.state.exportWithDarkMode).toBe(true);
        expect(getSwitch("exportDarkModeSwitch")?.checked).toBe(true);
      });
      // background must not be affected by the dark mode toggle
      expect(h.state.exportBackground).toBe(true);

      fireEvent.click(getSwitch("exportDarkModeSwitch")!);

      await waitFor(() => {
        expect(h.state.exportWithDarkMode).toBe(false);
        expect(getSwitch("exportDarkModeSwitch")?.checked).toBe(false);
      });
    });

    it("toggling embed scene switch updates exportEmbedScene", async () => {
      await renderWithScene();
      expect(h.state.exportEmbedScene).toBe(false);

      fireEvent.click(getSwitch("exportEmbedSwitch")!);

      expect(h.state.exportEmbedScene).toBe(true);
      expect(getSwitch("exportEmbedSwitch")?.checked).toBe(true);
    });

    it("selecting a scale updates exportScale", async () => {
      await renderWithScene();
      const radios = getScaleRadios();
      expect(radios).toHaveLength(3);

      fireEvent.click(radios[2]);

      expect(h.state.exportScale).toBe(3);
      expect(getScaleRadios()[2].checked).toBe(true);
      expect(getScaleRadios()[0].checked).toBe(false);

      fireEvent.click(getScaleRadios()[1]);

      expect(h.state.exportScale).toBe(2);
    });
  });

  describe("export selection only", () => {
    it("is not shown when nothing is selected", async () => {
      await renderWithScene();
      expect(getSwitch("exportOnlySelected")).toBeNull();
      expect(
        getOwnerDocument().querySelector(".ImageExportModal")?.textContent,
      ).not.toContain(t("imageExportDialog.label.onlySelected"));
    });

    it("is shown and enabled by default when there is a selection", async () => {
      await renderWithScene({ selectFirst: true });
      expect(getSwitch("exportOnlySelected")).not.toBeNull();
      expect(getSwitch("exportOnlySelected")?.checked).toBe(true);
    });
  });

  describe("export buttons", () => {
    it("exports only selected elements to PNG when selection-only is on", async () => {
      await renderWithScene({ selectFirst: true });

      fireEvent.click(getButton(t("imageExportDialog.title.exportToPng"))!);

      expect(onExportImageSpy).toHaveBeenCalledTimes(1);
      const [type, elements, opts] = onExportImageSpy.mock.calls[0];
      expect(type).toBe(EXPORT_IMAGE_TYPES.png);
      expect(elements.map((el: any) => el.id)).toEqual(["rect1"]);
      expect(opts).toEqual({ exportingFrame: null });
    });

    it("exports all elements to SVG when selection-only is turned off", async () => {
      await renderWithScene({ selectFirst: true });

      fireEvent.click(getSwitch("exportOnlySelected")!);
      expect(getSwitch("exportOnlySelected")?.checked).toBe(false);

      fireEvent.click(getButton(t("imageExportDialog.title.exportToSvg"))!);

      expect(onExportImageSpy).toHaveBeenCalledTimes(1);
      const [type, elements, opts] = onExportImageSpy.mock.calls[0];
      expect(type).toBe(EXPORT_IMAGE_TYPES.svg);
      expect(elements.map((el: any) => el.id)).toEqual(["rect1", "rect2"]);
      expect(opts).toEqual({ exportingFrame: null });
    });

    it("exports all elements when nothing is selected", async () => {
      await renderWithScene();

      fireEvent.click(getButton(t("imageExportDialog.title.exportToPng"))!);

      const [type, elements] = onExportImageSpy.mock.calls[0];
      expect(type).toBe(EXPORT_IMAGE_TYPES.png);
      expect(elements.map((el: any) => el.id)).toEqual(["rect1", "rect2"]);
    });

    it("copies PNG to clipboard when clipboard blobs are supported", async () => {
      await renderWithScene({ selectFirst: true });

      const copyButton = getButton(
        t("imageExportDialog.title.copyPngToClipboard"),
      );
      expect(copyButton).not.toBeNull();

      fireEvent.click(copyButton!);

      expect(onExportImageSpy).toHaveBeenCalledTimes(1);
      const [type, elements] = onExportImageSpy.mock.calls[0];
      expect(type).toBe(EXPORT_IMAGE_TYPES.clipboard);
      expect(elements.map((el: any) => el.id)).toEqual(["rect1"]);
      await waitFor(() => {
        expect(
          getButton(t("imageExportDialog.title.copyPngToClipboard")),
        ).toHaveClass("ExcButton--status-success");
      });
    });

    it("hides the clipboard button when clipboard blobs are not supported", async () => {
      mocks.probablySupportsClipboardBlob = false;
      await renderWithScene();

      expect(
        getButton(t("imageExportDialog.title.copyPngToClipboard")),
      ).toBeNull();
      expect(
        getButton(t("imageExportDialog.title.exportToPng")),
      ).not.toBeNull();
      expect(
        getButton(t("imageExportDialog.title.exportToSvg")),
      ).not.toBeNull();
    });
  });

  describe("preview", () => {
    it("renders the exported canvas into the preview", async () => {
      let previewCanvas: HTMLCanvasElement | null = null;
      const exportToCanvasMock = vi.fn(async () => {
        previewCanvas = createPreviewCanvas(
          new Blob(["png"], { type: "image/png" }),
        );
        return previewCanvas;
      });
      mocks.exportToCanvas = exportToCanvasMock;

      await renderWithScene({
        selectFirst: true,
        beforeOpen: mockPreviewDimensions,
      });

      await waitFor(() => {
        expect(getPreview()?.firstChild).not.toBeNull();
        expect(getPreview()?.firstChild).toBe(previewCanvas);
      });
      expect(getPreview()?.textContent).not.toContain(
        t("canvasError.cannotShowPreview"),
      );

      const { elements, maxWidthOrHeight } = (
        exportToCanvasMock.mock.calls.at(-1) as any[]
      )[0];
      expect(elements.map((el: any) => el.id)).toEqual(["rect1"]);
      expect(maxWidthOrHeight).toBe(400);
    });

    it("shows ErrorCanvasPreview when the canvas is possibly too big", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      // canvas.toBlob yields `null` when the canvas exceeds browser limits,
      // which canvasToBlob() turns into a CANVAS_POSSIBLY_TOO_BIG error
      mocks.exportToCanvas = vi.fn(async () => createPreviewCanvas(null));

      await renderWithScene({ beforeOpen: mockPreviewDimensions });

      await waitFor(() => {
        const preview = getPreview()!;
        expect(preview.textContent).toContain(
          t("canvasError.cannotShowPreview"),
        );
        expect(preview.textContent).toContain(t("canvasError.canvasTooBig"));
        expect(preview.textContent).toContain(t("canvasError.canvasTooBigTip"));
      });
      expect(getPreview()?.querySelector("canvas")).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: t("canvasError.canvasTooBig") }),
      );
    });

    it("shows ErrorCanvasPreview when exporting the preview fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.exportToCanvas = vi
        .fn()
        .mockRejectedValue(new Error("export failed"));

      await renderWithScene({ beforeOpen: mockPreviewDimensions });

      await waitFor(() => {
        expect(getPreview()?.textContent).toContain(
          t("canvasError.cannotShowPreview"),
        );
      });
    });
  });
});
