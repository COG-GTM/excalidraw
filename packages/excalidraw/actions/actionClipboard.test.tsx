import React from "react";
import { vi } from "vitest";

import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import {
  copyTextToSystemClipboard,
  copyToClipboard,
  readSystemClipboard,
} from "../clipboard";
import { exportCanvas } from "../data/index";
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

const { h } = window;

const copyToClipboardMock = vi.mocked(copyToClipboard);
const copyTextMock = vi.mocked(copyTextToSystemClipboard);
const readSystemClipboardMock = vi.mocked(readSystemClipboard);
const exportCanvasMock = vi.mocked(exportCanvas);

const makeError = (name: string, message = name) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe("actionClipboard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    copyToClipboardMock.mockResolvedValue(undefined);
    copyTextMock.mockResolvedValue(undefined);
    exportCanvasMock.mockResolvedValue(undefined);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionCopy", () => {
    it("copies selected elements including bound text and frame children", async () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const frameChild = API.createElement({ id: "child", frameId: "frame" });
      const [container, boundText] = API.createTextContainer();
      const unselected = API.createElement({ id: "unselected", x: 500 });
      API.setElements([frame, frameChild, container, boundText, unselected]);
      API.setSelectedElements([frame, container]);

      const result = await actionCopy.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      const [copied, files, event] = copyToClipboardMock.mock.calls[0];
      expect(copied.map((el) => el.id).sort()).toEqual(
        ["frame", "child", container.id, boundText.id].sort(),
      );
      expect(files).toBe(h.app.files);
      expect(event).toBe(null);
      expect(result).toEqual({ captureUpdate: CaptureUpdateAction.EVENTUALLY });
    });

    it("surfaces clipboard failures as an error message", async () => {
      copyToClipboardMock.mockRejectedValueOnce(new Error("copy failed"));
      const rect = API.createElement({});
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await actionCopy.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: { errorMessage: "copy failed" },
      });
    });

    it("has no keyboard shortcut (handled via the copy event)", () => {
      expect(actionCopy.keyTest).toBeUndefined();
      expect(actionPaste.keyTest).toBeUndefined();
    });
  });

  describe("actionPaste", () => {
    it("pastes the system clipboard contents via app.pasteFromClipboard", async () => {
      readSystemClipboardMock.mockResolvedValueOnce({ "text/plain": "hello" });
      const pasteSpy = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockImplementation(async () => {});

      const result = await actionPaste.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(pasteSpy).toHaveBeenCalledTimes(1);
      const event = pasteSpy.mock.calls[0][0] as ClipboardEvent;
      expect(event.clipboardData?.getData("text/plain")).toBe("hello");
      expect(result).toEqual({ captureUpdate: CaptureUpdateAction.EVENTUALLY });
    });

    it.each(["AbortError", "NotAllowedError"])(
      "silently aborts on %s",
      async (name) => {
        readSystemClipboardMock.mockRejectedValueOnce(makeError(name));
        const pasteSpy = vi.spyOn(h.app, "pasteFromClipboard");

        const result = await actionPaste.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        );

        expect(result).toBe(false);
        expect(pasteSpy).not.toHaveBeenCalled();
      },
    );

    it("shows a read error when the clipboard cannot be read", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      readSystemClipboardMock.mockRejectedValueOnce(
        makeError("SecurityError", "nope"),
      );

      const result = await actionPaste.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          errorMessage: "Couldn't paste (couldn't read from system clipboard).",
        },
      });
      expect(consoleError).toHaveBeenCalledWith(
        "actionPaste SecurityError: nope",
      );
      consoleError.mockRestore();
    });

    it("shows a parse error when pasting the contents fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      readSystemClipboardMock.mockResolvedValueOnce({ "text/plain": "x" });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementation(() => {
        throw new Error("parse failed");
      });

      const result = await actionPaste.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: { errorMessage: "Couldn't paste." },
      });
      consoleError.mockRestore();
    });
  });

  describe("actionCut", () => {
    it("keyTest matches Ctrl/Cmd+X only", () => {
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
    });

    it("copies the selection to the clipboard and deletes it", async () => {
      const rect = API.createElement({ id: "rect" });
      const other = API.createElement({ id: "other", x: 300 });
      API.setElements([rect, other]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCut);

      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      expect(copyToClipboardMock.mock.calls[0][0].map((el) => el.id)).toEqual([
        "rect",
      ]);
      expect(h.elements.find((el) => el.id === "rect")!.isDeleted).toBe(true);
      expect(h.elements.find((el) => el.id === "other")!.isDeleted).toBe(false);
      expect(h.state.selectedElementIds).toEqual({});
    });
  });

  describe("actionCopyAsSvg", () => {
    it("predicate requires a non-empty scene", () => {
      expect(actionCopyAsSvg.predicate!([])).toBe(false);
      expect(actionCopyAsSvg.predicate!([API.createElement({})])).toBe(true);
    });

    it("exports the selection as SVG and shows a toast", async () => {
      const rect = API.createElement({ id: "rect" });
      const other = API.createElement({ id: "other", x: 300 });
      API.setElements([rect, other]);
      API.setSelectedElements([rect]);

      const result = await actionCopyAsSvg.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(exportCanvasMock).toHaveBeenCalledTimes(1);
      const [type, exported, , files, opts] = exportCanvasMock.mock.calls[0];
      expect(type).toBe("clipboard-svg");
      expect(exported.map((el) => el.id)).toEqual(["rect"]);
      expect(files).toBe(h.app.files);
      expect(opts).toMatchObject({
        exportingFrame: null,
        name: h.app.getName(),
      });
      expect(result).toEqual({
        appState: {
          toast: {
            message: "Copied selection to clipboard as SVG\n(Light mode)",
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("mentions the canvas and dark mode when nothing is selected", async () => {
      API.setElements([API.createElement({})]);

      const result = await actionCopyAsSvg.perform(
        h.app.scene.getElementsIncludingDeleted(),
        { ...h.state, exportWithDarkMode: true },
        null,
        h.app,
      );

      expect((result as any).appState.toast.message).toBe(
        "Copied canvas to clipboard as SVG\n(Dark mode)",
      );
      expect(exportCanvasMock.mock.calls[0][1].map((el) => el.id)).toHaveLength(
        1,
      );
    });

    it("returns the export error message", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      exportCanvasMock.mockRejectedValueOnce(new Error("svg failed"));
      API.setElements([API.createElement({})]);

      const result = await actionCopyAsSvg.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toEqual({
        appState: { errorMessage: "svg failed" },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      consoleError.mockRestore();
    });
  });

  describe("actionCopyAsPng", () => {
    it("keyTest matches Alt+Shift+C", () => {
      expect(
        actionCopyAsPng.keyTest!(
          new h.app.ownerWindow.KeyboardEvent("keydown", {
            code: CODES.C,
            altKey: true,
            shiftKey: true,
          }),
        ),
      ).toBe(true);
      expect(
        actionCopyAsPng.keyTest!(
          new h.app.ownerWindow.KeyboardEvent("keydown", {
            code: CODES.C,
            altKey: true,
          }),
        ),
      ).toBe(false);
    });

    it("predicate requires a non-empty scene", () => {
      expect(actionCopyAsPng.predicate!([])).toBe(false);
      expect(actionCopyAsPng.predicate!([API.createElement({})])).toBe(true);
    });

    it("exports a selected frame with its children as PNG", async () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 300,
      });
      const child = API.createElement({
        id: "child",
        x: 10,
        y: 10,
        width: 20,
        frameId: "frame",
      });
      API.setElements([frame, child]);
      API.setSelectedElements([frame]);

      const result = await actionCopyAsPng.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      const [type, exported, , , opts] = exportCanvasMock.mock.calls[0];
      expect(type).toBe("clipboard");
      expect(exported.map((el) => el.id).sort()).toEqual(["child", "frame"]);
      expect(opts.exportingFrame?.id).toBe("frame");
      expect((result as any).appState.toast.message).toBe(
        "Copied selection to clipboard as PNG\n(Light mode)",
      );
    });

    it("returns the export error message", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      exportCanvasMock.mockRejectedValueOnce(new Error("png failed"));
      API.setElements([API.createElement({})]);

      const result = await actionCopyAsPng.perform(
        h.app.scene.getElementsIncludingDeleted(),
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
  });

  describe("copyText", () => {
    it("predicate requires a selected text element (incl. bound text)", () => {
      const rect = API.createElement({ id: "rect", x: 500 });
      const [container, boundText] = API.createTextContainer();
      const text = API.createElement({ type: "text", text: "hi", x: 800 });
      API.setElements([rect, container, boundText, text]);

      API.setSelectedElements([rect]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        false,
      );

      API.setSelectedElements([text]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        true,
      );

      API.setSelectedElements([container]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        true,
      );
    });

    it("copies the text of selected text elements joined by blank lines", () => {
      const text1 = API.createElement({ type: "text", text: "first" });
      const text2 = API.createElement({
        type: "text",
        text: "second",
        x: 200,
      });
      const rect = API.createElement({ x: 400 });
      API.setElements([text1, text2, rect]);
      API.setSelectedElements([text1, text2, rect]);

      const result = copyText.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(copyTextMock).toHaveBeenCalledWith("first\n\nsecond");
      expect(result).toEqual({ captureUpdate: CaptureUpdateAction.EVENTUALLY });
    });

    it("throws a user-facing error when copying throws synchronously", () => {
      copyTextMock.mockImplementationOnce(() => {
        throw new Error("boom");
      });
      const text = API.createElement({ type: "text", text: "first" });
      API.setElements([text]);
      API.setSelectedElements([text]);

      expect(() =>
        copyText.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        ),
      ).toThrowError("Couldn't copy to clipboard.");
    });
  });
});
