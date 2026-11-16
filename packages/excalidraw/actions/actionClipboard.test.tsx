import { vi } from "vitest";

import { KEYS, CODES } from "@excalidraw/common";
import { CaptureUpdateAction, getTextFromElements } from "@excalidraw/element";

import {
  copyTextToSystemClipboard,
  copyToClipboard,
  readSystemClipboard,
} from "../clipboard";
import { exportCanvas } from "../data/index";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import {
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  actionCut,
  actionPaste,
  copyText,
} from "./actionClipboard";

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    probablySupportsClipboardBlob: true,
    probablySupportsClipboardWriteText: true,
    copyToClipboard: vi.fn(),
    copyTextToSystemClipboard: vi.fn(),
    readSystemClipboard: vi.fn(),
  };
});

vi.mock("../data/index", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/index")>();
  return {
    ...module,
    exportCanvas: vi.fn(),
  };
});

const copyToClipboardMock = vi.mocked(copyToClipboard);
const copyTextMock = vi.mocked(copyTextToSystemClipboard);
const readSystemClipboardMock = vi.mocked(readSystemClipboard);
const exportCanvasMock = vi.mocked(exportCanvas);

const { h } = window;

const getElements = () => h.app.scene.getElementsIncludingDeleted();

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const createScene = () => {
  const rect = API.createElement({
    type: "rectangle",
    id: "rect",
    x: 0,
    y: 0,
    boundElements: [{ type: "text", id: "label" }],
  });
  const label = API.createElement({
    type: "text",
    id: "label",
    text: "label",
    containerId: rect.id,
  });
  const text = API.createElement({
    type: "text",
    id: "text",
    text: "standalone",
    x: 200,
  });
  const ellipse = API.createElement({
    type: "ellipse",
    id: "ellipse",
    x: 400,
  });
  API.updateScene({
    elements: [rect, label, text, ellipse],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  return { rect, label, text, ellipse };
};

const namedError = (name: string, message = name) =>
  Object.assign(new Error(message), { name });

describe("actionClipboard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    copyToClipboardMock.mockResolvedValue(undefined);
    copyTextMock.mockResolvedValue(undefined);
    exportCanvasMock.mockResolvedValue(undefined);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("copy", () => {
    it("copies the selection including bound text, along with files and event", async () => {
      const { rect } = createScene();
      API.setSelectedElements([rect]);
      const event = new Event("copy") as ClipboardEvent;

      const result = await actionCopy.perform(
        getElements(),
        h.state,
        event,
        h.app,
      );

      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      const [elements, files, passedEvent] = copyToClipboardMock.mock.calls[0];
      expect(elements.map((el) => el.id).sort()).toEqual(["label", "rect"]);
      expect(files).toBe(h.app.files);
      expect(passedEvent).toBe(event);
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("includes frame children when copying a frame", async () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
        height: 500,
      });
      const child = API.createElement({
        type: "rectangle",
        id: "child",
        x: 10,
        y: 10,
        frameId: frame.id,
      });
      API.updateScene({
        elements: [child, frame],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([frame]);

      await actionCopy.perform(getElements(), h.state, null, h.app);

      expect(
        copyToClipboardMock.mock.calls[0][0].map((el) => el.id).sort(),
      ).toEqual(["child", "frame"]);
    });

    it("surfaces clipboard failures as an error message", async () => {
      const { ellipse } = createScene();
      API.setSelectedElements([ellipse]);
      copyToClipboardMock.mockRejectedValueOnce(new Error("write denied"));

      const result = await actionCopy.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: { errorMessage: "write denied" },
      });
    });
  });

  describe("cut", () => {
    it("copies and then deletes the selection", () => {
      const { ellipse, text } = createScene();
      API.setSelectedElements([ellipse]);

      API.executeAction(actionCut);

      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      expect(copyToClipboardMock.mock.calls[0][0].map((el) => el.id)).toEqual([
        "ellipse",
      ]);
      expect(getElement(ellipse.id).isDeleted).toBe(true);
      expect(getElement(text.id).isDeleted).toBe(false);
    });

    it("is bound to Ctrl+X", () => {
      expect(
        actionCut.keyTest!(
          { ctrlKey: true, key: KEYS.X } as KeyboardEvent,
          h.state,
          getElements(),
          h.app,
        ),
      ).toBe(true);
      expect(
        actionCut.keyTest!(
          { ctrlKey: false, key: KEYS.X } as KeyboardEvent,
          h.state,
          getElements(),
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe("paste", () => {
    it("forwards the system clipboard contents to the app as a paste event", async () => {
      readSystemClipboardMock.mockResolvedValueOnce({
        "text/plain": "hello",
      });
      const pasteSpy = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockImplementation(async () => {});

      const result = await actionPaste.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(pasteSpy).toHaveBeenCalledTimes(1);
      const event = pasteSpy.mock.calls[0][0] as ClipboardEvent;
      expect(event.clipboardData?.getData("text/plain")).toBe("hello");
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it.each(["AbortError", "NotAllowedError"])(
      "silently aborts when reading the clipboard fails with %s",
      async (name) => {
        readSystemClipboardMock.mockRejectedValueOnce(namedError(name));
        const pasteSpy = vi.spyOn(h.app, "pasteFromClipboard");

        const result = await actionPaste.perform(
          getElements(),
          h.state,
          null,
          h.app,
        );

        expect(result).toBe(false);
        expect(pasteSpy).not.toHaveBeenCalled();
      },
    );

    it("shows a read error for other clipboard failures", async () => {
      readSystemClipboardMock.mockRejectedValueOnce(
        namedError("SecurityError", "nope"),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionPaste.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: { errorMessage: t("errors.asyncPasteFailedOnRead") },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(consoleError).toHaveBeenCalledWith(
        "actionPaste SecurityError: nope",
      );
      consoleError.mockRestore();
    });

    it("shows a parse error when the app fails to handle the pasted data", async () => {
      readSystemClipboardMock.mockResolvedValueOnce({ "text/plain": "x" });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementation(() => {
        throw new Error("bad data");
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionPaste.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: { errorMessage: t("errors.asyncPasteFailedOnParse") },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      consoleError.mockRestore();
    });
  });

  describe("copyAsSvg / copyAsPng", () => {
    it("are enabled only when there are elements", () => {
      expect(actionCopyAsSvg.predicate!([])).toBe(false);
      expect(actionCopyAsPng.predicate!([])).toBe(false);

      createScene();
      expect(actionCopyAsSvg.predicate!(getElements())).toBe(true);
      expect(actionCopyAsPng.predicate!(getElements())).toBe(true);
    });

    it("copyAsPng is bound to Alt+Shift+C", () => {
      expect(
        actionCopyAsPng.keyTest!({
          code: CODES.C,
          altKey: true,
          shiftKey: true,
        } as KeyboardEvent),
      ).toBe(true);
      expect(
        actionCopyAsPng.keyTest!({
          code: CODES.C,
          altKey: true,
          shiftKey: false,
        } as KeyboardEvent),
      ).toBe(false);
    });

    it("copyAsSvg exports only the selection and reports it in the toast", async () => {
      const { ellipse } = createScene();
      API.setSelectedElements([ellipse]);

      const result = await actionCopyAsSvg.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(exportCanvasMock).toHaveBeenCalledTimes(1);
      const [type, exported, , files, opts] = exportCanvasMock.mock.calls[0];
      expect(type).toBe("clipboard-svg");
      expect(exported.map((el) => el.id)).toEqual(["ellipse"]);
      expect(files).toBe(h.app.files);
      expect(opts).toMatchObject({
        exportingFrame: null,
        name: h.app.getName(),
      });
      expect(result).toMatchObject({
        appState: {
          toast: {
            message: t("toast.copyToClipboardAsSvg", {
              exportSelection: t("toast.selection"),
              exportColorScheme: t("buttons.lightMode"),
            }),
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("copyAsSvg exports the whole canvas in dark mode when nothing is selected", async () => {
      createScene();
      API.setSelectedElements([]);

      const result = await actionCopyAsSvg.perform(
        getElements(),
        { ...h.state, exportWithDarkMode: true },
        null,
        h.app,
      );

      expect(exportCanvasMock.mock.calls[0][1]).toHaveLength(4);
      expect((result as any).appState.toast.message).toBe(
        t("toast.copyToClipboardAsSvg", {
          exportSelection: t("toast.canvas"),
          exportColorScheme: t("buttons.darkMode"),
        }),
      );
    });

    it("copyAsSvg reports export errors", async () => {
      createScene();
      exportCanvasMock.mockRejectedValueOnce(new Error("svg failed"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionCopyAsSvg.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: { errorMessage: "svg failed" },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      consoleError.mockRestore();
    });

    it("copyAsPng exports via the clipboard export type", async () => {
      const { rect } = createScene();
      API.setSelectedElements([rect]);

      const result = await actionCopyAsPng.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      const [type, exported] = exportCanvasMock.mock.calls[0];
      expect(type).toBe("clipboard");
      expect(exported.map((el) => el.id).sort()).toEqual(["label", "rect"]);
      expect((result as any).appState.toast.message).toBe(
        t("toast.copyToClipboardAsPng", {
          exportSelection: t("toast.selection"),
          exportColorScheme: t("buttons.lightMode"),
        }),
      );
    });

    it("copyAsPng reports the canvas in the toast when nothing is selected", async () => {
      createScene();
      API.setSelectedElements([]);

      const result = await actionCopyAsPng.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect((result as any).appState.toast.message).toBe(
        t("toast.copyToClipboardAsPng", {
          exportSelection: t("toast.canvas"),
          exportColorScheme: t("buttons.lightMode"),
        }),
      );
    });

    it("copyAsPng reports export errors", async () => {
      createScene();
      exportCanvasMock.mockRejectedValueOnce(new Error("png failed"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionCopyAsPng.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: { errorMessage: "png failed" },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      consoleError.mockRestore();
    });

    it("are no-ops when the app has no canvas", async () => {
      createScene();
      const app = Object.assign(Object.create(h.app), { canvas: null });

      for (const action of [actionCopyAsSvg, actionCopyAsPng]) {
        const result = await action.perform(getElements(), h.state, null, app);
        expect(result).toEqual({
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
      }
      expect(exportCanvasMock).not.toHaveBeenCalled();
    });
  });

  describe("copyText", () => {
    it("is enabled only when the selection contains text", () => {
      const { ellipse, rect, text } = createScene();

      API.setSelectedElements([ellipse]);
      expect(
        copyText.predicate!(getElements(), h.state, h.app.props, h.app),
      ).toBe(false);

      API.setSelectedElements([rect]);
      expect(
        copyText.predicate!(getElements(), h.state, h.app.props, h.app),
      ).toBe(true);

      API.setSelectedElements([text]);
      expect(
        copyText.predicate!(getElements(), h.state, h.app.props, h.app),
      ).toBe(true);
    });

    it("copies the text of selected text elements, including bound text", () => {
      const { rect, text, ellipse } = createScene();
      API.setSelectedElements([rect, text, ellipse]);

      API.executeAction(copyText);

      expect(copyTextMock).toHaveBeenCalledTimes(1);
      const copied = copyTextMock.mock.calls[0][0];
      expect(copied).toBe(
        getTextFromElements([getElement("label"), getElement("text")]),
      );
      expect(copied).toContain("label");
      expect(copied).toContain("standalone");
    });

    it("throws a localized error when the clipboard write throws", () => {
      const { text } = createScene();
      API.setSelectedElements([text]);
      copyTextMock.mockImplementationOnce(() => {
        throw new Error("denied");
      });

      expect(() =>
        copyText.perform(getElements(), h.state, null, h.app),
      ).toThrowError(t("errors.copyToSystemClipboardFailed"));
    });
  });
});
