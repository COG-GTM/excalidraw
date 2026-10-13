import { vi } from "vitest";

import { KEYS, THEME } from "@excalidraw/common";

import {
  copyTextToSystemClipboard,
  copyToClipboard,
  readSystemClipboard,
} from "../clipboard";
import { exportCanvas } from "../data/index";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render, waitFor } from "../tests/test-utils";

import {
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  actionCut,
  actionPaste,
  copyText,
} from "./actionClipboard";

const mocks = vi.hoisted(() => ({
  isFirefox: false,
  supportsClipboard: true,
}));

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  const { mockThrottleRAF } = await import("../tests/helpers/mocks");
  return {
    ...module,
    throttleRAF: mockThrottleRAF,
    get isFirefox() {
      return mocks.isFirefox;
    },
  };
});

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    copyToClipboard: vi.fn(),
    copyTextToSystemClipboard: vi.fn(),
    readSystemClipboard: vi.fn(),
    get probablySupportsClipboardWriteText() {
      return mocks.supportsClipboard;
    },
    get probablySupportsClipboardBlob() {
      return mocks.supportsClipboard;
    },
  };
});

vi.mock("../data/index", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/index")>();
  return {
    ...module,
    exportCanvas: vi.fn(),
  };
});

const { h } = window;

const copyToClipboardMock = vi.mocked(copyToClipboard);
const copyTextMock = vi.mocked(copyTextToSystemClipboard);
const readSystemClipboardMock = vi.mocked(readSystemClipboard);
const exportCanvasMock = vi.mocked(exportCanvas);

const isEnabled = (action: Parameters<typeof API.executeAction>[0]) =>
  h.app.actionManager.isActionEnabled(action);

const namedError = (name: string, message = name) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe("actionClipboard", () => {
  beforeEach(async () => {
    mocks.isFirefox = false;
    mocks.supportsClipboard = true;
    copyToClipboardMock.mockReset().mockResolvedValue(undefined);
    copyTextMock.mockReset().mockResolvedValue(undefined);
    readSystemClipboardMock.mockReset();
    exportCanvasMock.mockReset().mockResolvedValue(undefined);

    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("copy", () => {
    it("copies the selection including bound text and frame children", async () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const inFrame = API.createElement({
        type: "rectangle",
        id: "inFrame",
        frameId: frame.id,
      });
      const [container, boundText] = API.createTextContainer();
      const unselected = API.createElement({ type: "ellipse", id: "other" });
      API.setElements([frame, inFrame, container, boundText, unselected]);
      API.setSelectedElements([frame, container]);

      API.executeAction(actionCopy);

      await waitFor(() => expect(copyToClipboardMock).toHaveBeenCalledTimes(1));
      const [copied, files, event] = copyToClipboardMock.mock.calls[0];
      expect(copied.map((el) => el.id).sort()).toEqual(
        [frame.id, inFrame.id, container.id, boundText.id].sort(),
      );
      expect(files).toBe(h.app.files);
      expect(event).toBe(null);
      expect(h.state.errorMessage).toBe(null);
    });

    it("surfaces clipboard errors as an error message", async () => {
      copyToClipboardMock.mockRejectedValueOnce(new Error("copy failed"));
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopy);

      await waitFor(() => expect(h.state.errorMessage).toBe("copy failed"));
    });

    it("has no keyboard shortcut", () => {
      expect(actionCopy.keyTest).toBeUndefined();
      expect(actionPaste.keyTest).toBeUndefined();
    });
  });

  describe("cut", () => {
    it("copies and then deletes the selected elements", async () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const ellipse = API.createElement({ type: "ellipse", id: "ellipse" });
      API.setElements([rect, ellipse]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCut);

      await waitFor(() => expect(copyToClipboardMock).toHaveBeenCalledTimes(1));
      expect(copyToClipboardMock.mock.calls[0][0].map((el) => el.id)).toEqual([
        rect.id,
      ]);
      expect(API.getElement(rect).isDeleted).toBe(true);
      expect(API.getElement(ellipse).isDeleted).toBe(false);
      expect(h.state.selectedElementIds).toEqual({});
    });

    it("matches Ctrl/Cmd+X only", () => {
      expect(
        actionCut.keyTest!(
          new h.app.ownerWindow.KeyboardEvent("keydown", {
            key: KEYS.X,
            ctrlKey: true,
          }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(true);
      expect(
        actionCut.keyTest!(
          new h.app.ownerWindow.KeyboardEvent("keydown", { key: KEYS.X }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
      expect(
        actionCut.keyTest!(
          new h.app.ownerWindow.KeyboardEvent("keydown", {
            key: KEYS.C,
            ctrlKey: true,
          }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe("paste", () => {
    it("forwards the system clipboard contents to the app as a paste event", async () => {
      readSystemClipboardMock.mockResolvedValueOnce({
        "text/plain": "hello world",
      });
      const pasteSpy = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockResolvedValue(undefined);

      API.executeAction(actionPaste);

      await waitFor(() => expect(pasteSpy).toHaveBeenCalledTimes(1));
      const event = pasteSpy.mock.calls[0][0];
      expect(event.type).toBe("paste");
      expect(event.clipboardData?.getData("text/plain")).toBe("hello world");
      expect(h.state.errorMessage).toBe(null);
    });

    it.each(["AbortError", "NotAllowedError"])(
      "silently ignores %s when reading the clipboard",
      async (name) => {
        readSystemClipboardMock.mockRejectedValueOnce(namedError(name));
        const pasteSpy = vi.spyOn(h.app, "pasteFromClipboard");

        API.executeAction(actionPaste);

        await waitFor(() => expect(readSystemClipboardMock).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(pasteSpy).not.toHaveBeenCalled();
        expect(h.state.errorMessage).toBe(null);
      },
    );

    it("shows a generic read error for other failures", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      readSystemClipboardMock.mockRejectedValueOnce(namedError("TypeError"));

      API.executeAction(actionPaste);

      await waitFor(() =>
        expect(h.state.errorMessage).toBe(t("errors.asyncPasteFailedOnRead")),
      );
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("shows a Firefox-specific hint when reading fails on Firefox", async () => {
      mocks.isFirefox = true;
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      readSystemClipboardMock.mockRejectedValueOnce(namedError("TypeError"));

      API.executeAction(actionPaste);

      await waitFor(() =>
        expect(h.state.errorMessage).toBe(t("hints.firefox_clipboard_write")),
      );
      consoleError.mockRestore();
    });

    it("shows a parse error when pasting the clipboard data throws", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      readSystemClipboardMock.mockResolvedValueOnce({ "text/plain": "x" });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementationOnce(() => {
        throw new Error("parse failed");
      });

      API.executeAction(actionPaste);

      await waitFor(() =>
        expect(h.state.errorMessage).toBe(t("errors.asyncPasteFailedOnParse")),
      );
      expect(h.elements).toHaveLength(0);
      consoleError.mockRestore();
    });
  });

  describe("copyAsSvg", () => {
    it("is enabled only with elements and clipboard text support", () => {
      expect(isEnabled(actionCopyAsSvg)).toBe(false);

      API.setElements([API.createElement({ type: "rectangle" })]);
      expect(isEnabled(actionCopyAsSvg)).toBe(true);

      mocks.supportsClipboard = false;
      expect(isEnabled(actionCopyAsSvg)).toBe(false);
    });

    it("exports the selection as SVG and shows a toast", async () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const ellipse = API.createElement({ type: "ellipse", id: "ellipse" });
      API.setElements([rect, ellipse]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyAsSvg);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(
          t("toast.copyToClipboardAsSvg", {
            exportSelection: t("toast.selection"),
            exportColorScheme: t("buttons.lightMode"),
          }),
        ),
      );
      expect(exportCanvasMock).toHaveBeenCalledTimes(1);
      const [type, exported, , files, opts] = exportCanvasMock.mock.calls[0];
      expect(type).toBe("clipboard-svg");
      expect(exported.map((el) => el.id)).toEqual([rect.id]);
      expect(files).toBe(h.app.files);
      expect(opts).toMatchObject({
        exportingFrame: null,
        name: h.app.getName(),
      });
    });

    it("exports the whole canvas in dark mode when nothing is selected", async () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const ellipse = API.createElement({ type: "ellipse", id: "ellipse" });
      API.setElements([rect, ellipse]);
      API.setAppState({ theme: THEME.DARK });
      expect(h.state.exportWithDarkMode).toBe(true);

      API.executeAction(actionCopyAsSvg);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(
          t("toast.copyToClipboardAsSvg", {
            exportSelection: t("toast.canvas"),
            exportColorScheme: t("buttons.darkMode"),
          }),
        ),
      );
      expect(exportCanvasMock.mock.calls[0][1].map((el) => el.id)).toEqual([
        rect.id,
        ellipse.id,
      ]);
    });

    it("surfaces export errors as an error message", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      exportCanvasMock.mockRejectedValueOnce(new Error("svg failed"));
      API.setElements([API.createElement({ type: "rectangle" })]);

      API.executeAction(actionCopyAsSvg);

      await waitFor(() => expect(h.state.errorMessage).toBe("svg failed"));
      expect(h.state.toast).toBe(null);
      consoleError.mockRestore();
    });
  });

  describe("copyAsPng", () => {
    it("is enabled only with elements and clipboard blob support", () => {
      expect(isEnabled(actionCopyAsPng)).toBe(false);

      API.setElements([API.createElement({ type: "rectangle" })]);
      expect(isEnabled(actionCopyAsPng)).toBe(true);

      mocks.supportsClipboard = false;
      expect(isEnabled(actionCopyAsPng)).toBe(false);
    });

    it("matches Shift+Alt+C by key code", () => {
      expect(
        actionCopyAsPng.keyTest!(
          new h.app.ownerWindow.KeyboardEvent("keydown", {
            code: "KeyC",
            altKey: true,
            shiftKey: true,
          }),
        ),
      ).toBe(true);
      expect(
        actionCopyAsPng.keyTest!(
          new h.app.ownerWindow.KeyboardEvent("keydown", {
            code: "KeyC",
            altKey: true,
          }),
        ),
      ).toBe(false);
    });

    it("exports a selected frame as PNG and shows a toast", async () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 200,
        height: 200,
      });
      const inFrame = API.createElement({
        type: "rectangle",
        id: "inFrame",
        frameId: frame.id,
        width: 50,
        height: 50,
      });
      API.setElements([frame, inFrame]);
      API.setSelectedElements([frame]);

      API.executeAction(actionCopyAsPng);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(
          t("toast.copyToClipboardAsPng", {
            exportSelection: t("toast.selection"),
            exportColorScheme: t("buttons.lightMode"),
          }),
        ),
      );
      const [type, exported, , , opts] = exportCanvasMock.mock.calls[0];
      expect(type).toBe("clipboard");
      expect(exported.map((el) => el.id).sort()).toEqual(
        [frame.id, inFrame.id].sort(),
      );
      expect(opts.exportingFrame?.id).toBe(frame.id);
    });

    it("reports the canvas and dark mode when nothing is selected", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      API.setAppState({ theme: THEME.DARK });
      expect(h.state.exportWithDarkMode).toBe(true);

      API.executeAction(actionCopyAsPng);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(
          t("toast.copyToClipboardAsPng", {
            exportSelection: t("toast.canvas"),
            exportColorScheme: t("buttons.darkMode"),
          }),
        ),
      );
    });

    it("surfaces export errors as an error message", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      exportCanvasMock.mockRejectedValueOnce(new Error("png failed"));
      API.setElements([API.createElement({ type: "rectangle" })]);

      API.executeAction(actionCopyAsPng);

      await waitFor(() => expect(h.state.errorMessage).toBe("png failed"));
      consoleError.mockRestore();
    });
  });

  describe("copyText", () => {
    it("is enabled only when the selection contains text", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const [container, boundText] = API.createTextContainer();
      API.setElements([rect, container, boundText]);

      API.setSelectedElements([rect]);
      expect(isEnabled(copyText)).toBe(false);

      API.setSelectedElements([container]);
      expect(isEnabled(copyText)).toBe(true);

      mocks.supportsClipboard = false;
      expect(isEnabled(copyText)).toBe(false);
    });

    it("copies the text of all selected text elements", () => {
      const text1 = API.createElement({ type: "text", text: "first" });
      const text2 = API.createElement({ type: "text", text: "second" });
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([text1, text2, rect]);
      API.setSelectedElements([text1, text2, rect]);

      API.executeAction(copyText);

      expect(copyTextMock).toHaveBeenCalledWith("first\n\nsecond");
    });

    it("throws a user-facing error when the clipboard write throws", () => {
      copyTextMock.mockImplementationOnce(() => {
        throw new Error("denied");
      });
      const text = API.createElement({ type: "text", text: "hi" });
      API.setElements([text]);
      API.setSelectedElements([text]);

      expect(() => API.executeAction(copyText)).toThrow(
        t("errors.copyToSystemClipboardFailed"),
      );
    });
  });
});
