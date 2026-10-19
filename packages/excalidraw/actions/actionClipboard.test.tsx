import React from "react";
import { vi } from "vitest";

import { KEYS, THEME } from "@excalidraw/common";

import {
  copyTextToSystemClipboard,
  copyToClipboard,
  readSystemClipboard,
} from "../clipboard";
import { exportCanvas } from "../data/index";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render } from "../tests/test-utils";

import {
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  actionCut,
  actionPaste,
  copyText,
} from "./actionClipboard";

const mocks = vi.hoisted(() => ({ isFirefox: false }));

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  return {
    ...module,
    get isFirefox() {
      return mocks.isFirefox;
    },
  };
});

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

const executeAsync = async (
  action: Parameters<typeof API.executeAction>[0],
) => {
  await act(async () => {
    h.app.actionManager.executeAction(action);
  });
};

const createContainerWithLabel = () => {
  const container = API.createElement({
    type: "rectangle",
    id: "container",
    boundElements: [{ id: "label", type: "text" }],
  });
  const label = API.createElement({
    type: "text",
    id: "label",
    text: "hello",
    containerId: container.id,
  });
  return { container, label };
};

describe("actionClipboard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.isFirefox = false;
    copyToClipboardMock.mockResolvedValue(undefined);
    copyTextMock.mockResolvedValue(undefined);
    exportCanvasMock.mockResolvedValue(undefined);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("copy", () => {
    it("copies selected elements including bound text", async () => {
      const { container, label } = createContainerWithLabel();
      const other = API.createElement({ type: "ellipse" });
      API.setElements([container, label, other]);
      API.setSelectedElements([container]);

      await executeAsync(actionCopy);

      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      const [copied, files] = copyToClipboardMock.mock.calls[0];
      expect(copied.map((el) => el.id).sort()).toEqual(
        [container.id, label.id].sort(),
      );
      expect(files).toBe(h.app.files);
      expect(h.state.errorMessage).toBe(null);
    });

    it("surfaces clipboard errors as errorMessage", async () => {
      copyToClipboardMock.mockRejectedValueOnce(new Error("no clipboard"));
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await executeAsync(actionCopy);

      expect(h.state.errorMessage).toBe("no clipboard");
    });
  });

  describe("paste", () => {
    it("passes clipboard contents to app.pasteFromClipboard", async () => {
      readSystemClipboardMock.mockResolvedValueOnce({ "text/plain": "hi" });
      const pasteSpy = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockImplementation(async () => {});

      await executeAsync(actionPaste);

      expect(pasteSpy).toHaveBeenCalledTimes(1);
      const event = pasteSpy.mock.calls[0][0] as ClipboardEvent;
      expect(event.clipboardData?.getData("text/plain")).toBe("hi");
      expect(h.state.errorMessage).toBe(null);
    });

    it.each(["AbortError", "NotAllowedError"])(
      "silently ignores %s when reading the clipboard",
      async (name) => {
        readSystemClipboardMock.mockRejectedValueOnce(
          Object.assign(new Error("nope"), { name }),
        );
        const pasteSpy = vi.spyOn(h.app, "pasteFromClipboard");
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await executeAsync(actionPaste);

        expect(pasteSpy).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
        expect(h.state.errorMessage).toBe(null);
        consoleError.mockRestore();
      },
    );

    it("reports clipboard read failures", async () => {
      readSystemClipboardMock.mockRejectedValueOnce(new Error("broken"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await executeAsync(actionPaste);

      expect(h.state.errorMessage).toBe(
        "Couldn't paste (couldn't read from system clipboard).",
      );
      expect(consoleError).toHaveBeenCalledWith("actionPaste Error: broken");
      consoleError.mockRestore();
    });

    it("shows the Firefox hint when reading fails in Firefox", async () => {
      mocks.isFirefox = true;
      readSystemClipboardMock.mockRejectedValueOnce(new Error("broken"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await executeAsync(actionPaste);

      expect(h.state.errorMessage).toContain(
        "dom.events.asyncClipboard.clipboardItem",
      );
      consoleError.mockRestore();
    });

    it("reports failures while parsing the pasted data", async () => {
      readSystemClipboardMock.mockResolvedValueOnce({ "text/plain": "hi" });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementation(() => {
        throw new Error("parse failed");
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await executeAsync(actionPaste);

      expect(h.state.errorMessage).toBe("Couldn't paste.");
      consoleError.mockRestore();
    });
  });

  describe("cut", () => {
    it("copies and deletes the selection", async () => {
      const rect = API.createElement({ type: "rectangle" });
      const ellipse = API.createElement({ type: "ellipse" });
      API.setElements([rect, ellipse]);
      API.setSelectedElements([rect]);

      await executeAsync(actionCut);

      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      expect(copyToClipboardMock.mock.calls[0][0].map((el) => el.id)).toEqual([
        rect.id,
      ]);
      expect(API.getElement(rect).isDeleted).toBe(true);
      expect(API.getElement(ellipse).isDeleted).toBe(false);
    });

    it("matches Ctrl+X only", () => {
      expect(
        actionCut.keyTest!(
          { ctrlKey: true, key: KEYS.X } as KeyboardEvent,
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(true);
      expect(
        actionCut.keyTest!(
          { ctrlKey: false, key: KEYS.X } as KeyboardEvent,
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
      expect(
        actionCut.keyTest!(
          { ctrlKey: true, key: KEYS.C } as KeyboardEvent,
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe("copyAsSvg / copyAsPng", () => {
    it("predicates require at least one element", () => {
      expect(actionCopyAsSvg.predicate!([])).toBe(false);
      expect(actionCopyAsPng.predicate!([])).toBe(false);
      const rect = API.createElement({ type: "rectangle" });
      expect(actionCopyAsSvg.predicate!([rect])).toBe(true);
      expect(actionCopyAsPng.predicate!([rect])).toBe(true);
    });

    it("copies the selection as SVG and reports it in a toast", async () => {
      const rect = API.createElement({ type: "rectangle" });
      const ellipse = API.createElement({ type: "ellipse" });
      API.setElements([rect, ellipse]);
      API.setSelectedElements([rect]);

      await executeAsync(actionCopyAsSvg);

      expect(exportCanvasMock).toHaveBeenCalledTimes(1);
      const [type, exported] = exportCanvasMock.mock.calls[0];
      expect(type).toBe("clipboard-svg");
      expect(exported.map((el) => el.id)).toEqual([rect.id]);
      expect(h.state.toast?.message).toBe(
        "Copied selection to clipboard as SVG\n(Light mode)",
      );
    });

    it("copies the whole canvas as SVG in dark mode", async () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.clearSelection();
      API.setAppState({ theme: THEME.DARK });
      expect(h.state.exportWithDarkMode).toBe(true);

      await executeAsync(actionCopyAsSvg);

      expect(exportCanvasMock.mock.calls[0][1].map((el) => el.id)).toEqual([
        rect.id,
      ]);
      expect(h.state.toast?.message).toBe(
        "Copied canvas to clipboard as SVG\n(Dark mode)",
      );
    });

    it("surfaces SVG export errors", async () => {
      exportCanvasMock.mockRejectedValueOnce(new Error("svg failed"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      API.setElements([API.createElement({ type: "rectangle" })]);

      await executeAsync(actionCopyAsSvg);

      expect(h.state.errorMessage).toBe("svg failed");
      expect(h.state.toast).toBe(null);
      consoleError.mockRestore();
    });

    it("copies the selection as PNG and reports it in a toast", async () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);
      API.setAppState({ theme: THEME.DARK });
      expect(h.state.exportWithDarkMode).toBe(true);

      await executeAsync(actionCopyAsPng);

      expect(exportCanvasMock).toHaveBeenCalledTimes(1);
      expect(exportCanvasMock.mock.calls[0][0]).toBe("clipboard");
      expect(h.state.toast?.message).toBe(
        "Copied selection to clipboard as PNG\n(Dark mode)",
      );
    });

    it("surfaces PNG export errors", async () => {
      exportCanvasMock.mockRejectedValueOnce(new Error("png failed"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      API.setElements([API.createElement({ type: "rectangle" })]);

      await executeAsync(actionCopyAsPng);

      expect(h.state.errorMessage).toBe("png failed");
      consoleError.mockRestore();
    });

    it("copyAsPng matches Alt+Shift+C", () => {
      expect(
        actionCopyAsPng.keyTest!({
          code: "KeyC",
          altKey: true,
          shiftKey: true,
        } as KeyboardEvent),
      ).toBe(true);
      expect(
        actionCopyAsPng.keyTest!({
          code: "KeyC",
          altKey: true,
          shiftKey: false,
        } as KeyboardEvent),
      ).toBe(false);
    });
  });

  describe("copyText", () => {
    it("is enabled only when the selection contains text", () => {
      const { container, label } = createContainerWithLabel();
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([container, label, rect]);

      API.setSelectedElements([rect]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        false,
      );

      // bound text counts as part of the selection
      API.setSelectedElements([container]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        true,
      );
    });

    it("copies the text of selected text elements", () => {
      const text1 = API.createElement({ type: "text", text: "first" });
      const text2 = API.createElement({ type: "text", text: "second" });
      API.setElements([text1, text2]);
      API.setSelectedElements([text1, text2]);

      API.executeAction(copyText);

      expect(copyTextMock).toHaveBeenCalledTimes(1);
      expect(copyTextMock.mock.calls[0][0]).toBe("first\n\nsecond");
    });

    it("throws a localized error if copying fails synchronously", () => {
      copyTextMock.mockImplementationOnce(() => {
        throw new Error("boom");
      });
      const text = API.createElement({ type: "text", text: "x" });
      API.setElements([text]);
      API.setSelectedElements([text]);

      expect(() =>
        copyText.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        ),
      ).toThrow("Couldn't copy to clipboard.");
    });
  });
});
