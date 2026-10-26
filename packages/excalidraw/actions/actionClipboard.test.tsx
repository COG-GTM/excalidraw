import { act } from "@testing-library/react";
import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

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
  copyToClipboard: vi.fn(),
  copyTextToSystemClipboard: vi.fn(),
  readSystemClipboard: vi.fn(),
  exportCanvas: vi.fn(),
  isFirefox: false,
}));

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    copyToClipboard: mocks.copyToClipboard,
    copyTextToSystemClipboard: mocks.copyTextToSystemClipboard,
    readSystemClipboard: mocks.readSystemClipboard,
    probablySupportsClipboardBlob: true,
    probablySupportsClipboardWriteText: true,
  };
});

vi.mock("../data/index", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/index")>();
  return { ...module, exportCanvas: mocks.exportCanvas };
});

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

const { h } = window;

const keyEvent = (init: Partial<KeyboardEvent>) =>
  ({
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code: "",
    key: "",
    ...init,
  } as KeyboardEvent);

const namedError = (name: string, message = name) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe("actionClipboard", () => {
  beforeEach(async () => {
    mocks.copyToClipboard.mockReset().mockResolvedValue(undefined);
    mocks.copyTextToSystemClipboard.mockReset().mockResolvedValue(undefined);
    mocks.readSystemClipboard.mockReset();
    mocks.exportCanvas.mockReset().mockResolvedValue(undefined);
    mocks.isFirefox = false;
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionCopy", () => {
    it("copies the selection including bound text and frame children", async () => {
      const container = API.createElement({
        id: "container",
        boundElements: [{ id: "label", type: "text" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        text: "hi",
        containerId: "container",
      });
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        x: 300,
        width: 300,
        height: 300,
      });
      const child = API.createElement({
        id: "child",
        x: 350,
        frameId: "frame",
      });
      const other = API.createElement({ id: "other", x: 900 });
      API.setElements([container, label, frame, child, other]);
      API.setSelectedElements([container, frame]);

      const event = null;
      const result = await actionCopy.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        event,
        h.app,
      );

      expect(mocks.copyToClipboard).toHaveBeenCalledTimes(1);
      const [copied, files, passedEvent] = mocks.copyToClipboard.mock.calls[0];
      expect(copied.map((el: { id: string }) => el.id).sort()).toEqual([
        "child",
        "container",
        "frame",
        "label",
      ]);
      expect(files).toBe(h.app.files);
      expect(passedEvent).toBe(event);
      expect(result).toEqual({ captureUpdate: CaptureUpdateAction.EVENTUALLY });
    });

    it("surfaces copy failures as an error message", async () => {
      mocks.copyToClipboard.mockRejectedValueOnce(new Error("copy failed"));
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopy);

      await waitFor(() => expect(h.state.errorMessage).toBe("copy failed"));
    });

    it("has no keyboard shortcut (handled via the copy event)", () => {
      expect(actionCopy.keyTest).toBeUndefined();
    });
  });

  describe("actionCut", () => {
    it("copies and then deletes the selected elements", () => {
      const rect = API.createElement({ id: "rect" });
      const keep = API.createElement({ id: "keep", x: 300 });
      API.setElements([rect, keep]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCut);

      expect(mocks.copyToClipboard).toHaveBeenCalledTimes(1);
      expect(mocks.copyToClipboard.mock.calls[0][0]).toEqual([
        expect.objectContaining({ id: "rect" }),
      ]);
      expect(API.getElement(rect).isDeleted).toBe(true);
      expect(API.getElement(keep).isDeleted).toBe(false);
    });

    it("is triggered by Ctrl+X only", () => {
      expect(
        actionCut.keyTest!(
          keyEvent({ ctrlKey: true, key: KEYS.X }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(true);
      expect(
        actionCut.keyTest!(
          keyEvent({ key: KEYS.X }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
      expect(
        actionCut.keyTest!(
          keyEvent({ ctrlKey: true, key: KEYS.C }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe("actionPaste", () => {
    it("passes the system clipboard contents to the app as a paste event", async () => {
      mocks.readSystemClipboard.mockResolvedValueOnce({
        "text/plain": "hello",
      });
      const pasteFromClipboard = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockImplementation(async () => {});

      const result = await actionPaste.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(pasteFromClipboard).toHaveBeenCalledTimes(1);
      const event = pasteFromClipboard.mock.calls[0][0] as ClipboardEvent;
      expect(event.type).toBe("paste");
      expect(event.clipboardData?.getData("text/plain")).toBe("hello");
      expect(result).toEqual({ captureUpdate: CaptureUpdateAction.EVENTUALLY });
    });

    it.each(["AbortError", "NotAllowedError"])(
      "silently aborts on %s",
      async (name) => {
        mocks.readSystemClipboard.mockRejectedValueOnce(namedError(name));
        const pasteFromClipboard = vi.spyOn(h.app, "pasteFromClipboard");

        const result = await actionPaste.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        );

        expect(result).toBe(false);
        expect(pasteFromClipboard).not.toHaveBeenCalled();
      },
    );

    it("shows a read error when the clipboard can't be read", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mocks.readSystemClipboard.mockRejectedValueOnce(
        namedError("SecurityError", "nope"),
      );

      API.executeAction(actionPaste);

      await waitFor(() =>
        expect(h.state.errorMessage).toBe(
          "Couldn't paste (couldn't read from system clipboard).",
        ),
      );
      expect(consoleError).toHaveBeenCalledWith(
        "actionPaste SecurityError: nope",
      );
      consoleError.mockRestore();
    });

    it("shows a Firefox-specific hint when reading fails on Firefox", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.isFirefox = true;
      mocks.readSystemClipboard.mockRejectedValueOnce(
        namedError("TypeError", "unsupported"),
      );

      const result = await actionPaste.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result && result.appState?.errorMessage).toMatch(
        /dom\.events\.asyncClipboard\.clipboardItem/,
      );
      vi.mocked(console.error).mockRestore();
    });

    it("shows a parse error when the app fails to handle the paste", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mocks.readSystemClipboard.mockResolvedValueOnce({
        "text/plain": "hello",
      });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementation(() => {
        throw new Error("bad data");
      });

      const result = await actionPaste.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result && result.appState?.errorMessage).toBe("Couldn't paste.");
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("actionCopyAsSvg / actionCopyAsPng", () => {
    it("are enabled only when there are elements", () => {
      expect(actionCopyAsSvg.predicate!([])).toBe(false);
      expect(actionCopyAsPng.predicate!([])).toBe(false);

      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      expect(actionCopyAsSvg.predicate!(h.elements)).toBe(true);
      expect(actionCopyAsPng.predicate!(h.elements)).toBe(true);
    });

    it("maps Alt+Shift+C to copyAsPng", () => {
      expect(
        actionCopyAsPng.keyTest!(
          keyEvent({ altKey: true, shiftKey: true, code: "KeyC" }),
        ),
      ).toBe(true);
      expect(
        actionCopyAsPng.keyTest!(keyEvent({ altKey: true, code: "KeyC" })),
      ).toBe(false);
    });

    it("exports only the selection as SVG and toasts about it", async () => {
      const rect = API.createElement({ id: "rect" });
      const other = API.createElement({ id: "other", x: 300 });
      API.setElements([rect, other]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyAsSvg);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(
          "Copied selection to clipboard as SVG\n(Light mode)",
        ),
      );
      expect(mocks.exportCanvas).toHaveBeenCalledTimes(1);
      const [type, exported, , files, opts] = mocks.exportCanvas.mock.calls[0];
      expect(type).toBe("clipboard-svg");
      expect(exported.map((el: { id: string }) => el.id)).toEqual(["rect"]);
      expect(files).toBe(h.app.files);
      expect(opts).toMatchObject({
        name: h.app.getName(),
        exportingFrame: null,
      });
    });

    it("exports the whole canvas as PNG in dark mode when nothing is selected", async () => {
      const rect = API.createElement({ id: "rect" });
      const other = API.createElement({ id: "other", x: 300 });
      API.setElements([rect, other]);

      const result = await actionCopyAsPng.perform(
        h.app.scene.getElementsIncludingDeleted(),
        { ...h.state, exportWithDarkMode: true },
        null,
        h.app,
      );

      expect(result && result.appState?.toast?.message).toBe(
        "Copied canvas to clipboard as PNG\n(Dark mode)",
      );
      const [type, exported] = mocks.exportCanvas.mock.calls[0];
      expect(type).toBe("clipboard");
      expect(exported.map((el: { id: string }) => el.id)).toEqual([
        "rect",
        "other",
      ]);
    });

    it.each([
      ["SVG", actionCopyAsSvg],
      ["PNG", actionCopyAsPng],
    ] as const)("reports %s export failures", async (_, action) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mocks.exportCanvas.mockRejectedValueOnce(new Error("export failed"));
      API.setElements([API.createElement({ id: "rect" })]);

      API.executeAction(action);

      await waitFor(() => expect(h.state.errorMessage).toBe("export failed"));
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it.each([
      ["SVG", actionCopyAsSvg],
      ["PNG", actionCopyAsPng],
    ] as const)("%s export is a no-op without a canvas", async (_, action) => {
      const result = await action.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        {
          ...h.app,
          canvas: null,
        } as unknown as typeof h.app,
      );

      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(mocks.exportCanvas).not.toHaveBeenCalled();
    });
  });

  describe("copyText", () => {
    it("is enabled only when a text element is selected", () => {
      const rect = API.createElement({ id: "rect" });
      const text = API.createElement({ type: "text", id: "t", text: "hi" });
      API.setElements([rect, text]);

      API.setSelectedElements([rect]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        false,
      );

      API.setSelectedElements([rect, text]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        true,
      );
    });

    it("is enabled for a container with bound text", () => {
      const container = API.createElement({
        id: "container",
        boundElements: [{ id: "label", type: "text" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        text: "bound",
        containerId: "container",
      });
      API.setElements([container, label]);
      API.setSelectedElements([container]);

      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        true,
      );
    });

    it("copies the text of all selected text elements", () => {
      const t1 = API.createElement({ type: "text", id: "t1", text: "one" });
      const t2 = API.createElement({
        type: "text",
        id: "t2",
        text: "two",
        y: 100,
      });
      API.setElements([t1, t2]);
      API.setSelectedElements([t1, t2]);

      act(() => {
        h.app.actionManager.executeAction(copyText);
      });

      expect(mocks.copyTextToSystemClipboard).toHaveBeenCalledWith(
        "one\n\ntwo",
      );
    });

    it("throws a user-facing error when copying throws synchronously", () => {
      mocks.copyTextToSystemClipboard.mockImplementationOnce(() => {
        throw new Error("boom");
      });
      const text = API.createElement({ type: "text", id: "t", text: "hi" });
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
