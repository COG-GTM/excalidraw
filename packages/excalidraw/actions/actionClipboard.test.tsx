import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { t } from "../i18n";
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

import type { ActionResult } from "./types";

const mocks = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  copyTextToSystemClipboard: vi.fn(),
  readSystemClipboard: vi.fn(),
  exportCanvas: vi.fn(),
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

const { h } = window;

const perform = async (
  action:
    | typeof actionCopy
    | typeof actionPaste
    | typeof actionCopyAsSvg
    | typeof actionCopyAsPng,
  value: any = null,
) =>
  (await action.perform(
    h.app.scene.getElementsIncludingDeleted(),
    h.state,
    value,
    h.app,
  )) as Exclude<ActionResult, false>;

const silenceConsoleError = () =>
  vi.spyOn(console, "error").mockImplementation(() => {});

describe("actionClipboard", () => {
  beforeEach(async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.copyToClipboard.mockResolvedValue(undefined);
    mocks.copyTextToSystemClipboard.mockResolvedValue(undefined);
    mocks.exportCanvas.mockResolvedValue(undefined);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("copy", () => {
    it("copies selected elements including bound text and frame children", async () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const child = API.createElement({
        type: "ellipse",
        id: "child",
        frameId: "frame",
      });
      const container = API.createElement({
        type: "rectangle",
        id: "container",
        boundElements: [{ type: "text", id: "boundText" }],
      });
      const boundText = API.createElement({
        type: "text",
        id: "boundText",
        containerId: "container",
      });
      const other = API.createElement({ type: "diamond", id: "other" });
      API.setElements([frame, child, container, boundText, other]);
      API.setSelectedElements([frame, container]);
      const event = new ClipboardEvent("copy", {
        clipboardData: new DataTransfer(),
      });

      const result = await perform(actionCopy, event);

      expect(mocks.copyToClipboard).toHaveBeenCalledTimes(1);
      const [copied, files, passedEvent] = mocks.copyToClipboard.mock.calls[0];
      expect(copied.map((el: { id: string }) => el.id).sort()).toEqual(
        ["boundText", "child", "container", "frame"].sort(),
      );
      expect(files).toBe(h.app.files);
      expect(passedEvent).toBe(event);
      expect(result.appState).toBeUndefined();
    });

    it("surfaces clipboard errors as an error message", async () => {
      mocks.copyToClipboard.mockRejectedValueOnce(new Error("denied"));
      const rect = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await perform(actionCopy);

      expect(result.appState?.errorMessage).toBe("denied");
    });
  });

  describe("cut", () => {
    it("copies and then deletes the selection", async () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      const r2 = API.createElement({ type: "rectangle", id: "r2" });
      API.setElements([r1, r2]);
      API.setSelectedElements([r1]);

      API.executeAction(actionCut);

      expect(mocks.copyToClipboard).toHaveBeenCalledTimes(1);
      expect(
        mocks.copyToClipboard.mock.calls[0][0].map(
          (el: { id: string }) => el.id,
        ),
      ).toEqual(["r1"]);
      expect(h.elements.find((el) => el.id === "r1")!.isDeleted).toBe(true);
      expect(h.elements.find((el) => el.id === "r2")!.isDeleted).toBe(false);
    });

    it("is bound to Ctrl+X", () => {
      expect(
        actionCut.keyTest!(
          new KeyboardEvent("keydown", { ctrlKey: true, key: "x" }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(true);
      expect(
        actionCut.keyTest!(
          new KeyboardEvent("keydown", { key: "x" }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe("paste", () => {
    it("pastes the system clipboard contents into the scene", async () => {
      mocks.readSystemClipboard.mockResolvedValueOnce({
        "text/plain": "hello",
      });
      const pasteFromClipboard = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockImplementation(async () => {});

      const result = await perform(actionPaste);

      expect(pasteFromClipboard).toHaveBeenCalledTimes(1);
      const event = pasteFromClipboard.mock.calls[0][0] as ClipboardEvent;
      expect(event.clipboardData!.getData("text/plain")).toBe("hello");
      expect(result.appState).toBeUndefined();
    });

    it.each(["AbortError", "NotAllowedError"])(
      "silently aborts on %s",
      async (name) => {
        const error = new Error("nope");
        error.name = name;
        mocks.readSystemClipboard.mockRejectedValueOnce(error);
        const pasteFromClipboard = vi.spyOn(h.app, "pasteFromClipboard");

        expect(
          await actionPaste.perform(
            h.app.scene.getElementsIncludingDeleted(),
            h.state,
            null,
            h.app,
          ),
        ).toBe(false);
        expect(pasteFromClipboard).not.toHaveBeenCalled();
      },
    );

    it("reports a read failure for other clipboard errors", async () => {
      const consoleError = silenceConsoleError();
      mocks.readSystemClipboard.mockRejectedValueOnce(new Error("boom"));

      const result = await perform(actionPaste);

      expect(result.appState?.errorMessage).toBe(
        t("errors.asyncPasteFailedOnRead"),
      );
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("reports a parse failure when pasting throws", async () => {
      const consoleError = silenceConsoleError();
      mocks.readSystemClipboard.mockResolvedValueOnce({
        "text/plain": "hello",
      });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementation(() => {
        throw new Error("bad data");
      });

      const result = await perform(actionPaste);

      expect(result.appState?.errorMessage).toBe(
        t("errors.asyncPasteFailedOnParse"),
      );
      consoleError.mockRestore();
    });
  });

  describe("copyAsSvg", () => {
    it("is enabled only when the scene has elements", () => {
      expect(actionCopyAsSvg.predicate!([])).toBe(false);
      expect(
        actionCopyAsSvg.predicate!([API.createElement({ type: "rectangle" })]),
      ).toBe(true);
    });

    it("exports the selection to the clipboard as SVG and shows a toast", async () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      const r2 = API.createElement({ type: "rectangle", id: "r2" });
      API.setElements([r1, r2]);
      API.setSelectedElements([r1]);

      const result = await perform(actionCopyAsSvg);

      expect(mocks.exportCanvas).toHaveBeenCalledTimes(1);
      const [type, exported] = mocks.exportCanvas.mock.calls[0];
      expect(type).toBe("clipboard-svg");
      expect(exported.map((el: { id: string }) => el.id)).toEqual(["r1"]);
      expect(result.appState?.toast?.message).toBe(
        t("toast.copyToClipboardAsSvg", {
          exportSelection: t("toast.selection"),
          exportColorScheme: t("buttons.lightMode"),
        }),
      );
    });

    it("mentions the canvas and dark mode when nothing is selected", async () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([r1]);

      const result = (await actionCopyAsSvg.perform(
        h.app.scene.getElementsIncludingDeleted(),
        { ...h.state, exportWithDarkMode: true },
        null,
        h.app,
      )) as Exclude<ActionResult, false>;

      const [, exported] = mocks.exportCanvas.mock.calls[0];
      expect(exported.map((el: { id: string }) => el.id)).toEqual(["r1"]);
      expect(result.appState?.toast?.message).toBe(
        t("toast.copyToClipboardAsSvg", {
          exportSelection: t("toast.canvas"),
          exportColorScheme: t("buttons.darkMode"),
        }),
      );
    });

    it("surfaces export errors", async () => {
      const consoleError = silenceConsoleError();
      mocks.exportCanvas.mockRejectedValueOnce(new Error("svg failed"));
      API.setElements([API.createElement({ type: "rectangle" })]);

      const result = await perform(actionCopyAsSvg);

      expect(result.appState?.errorMessage).toBe("svg failed");
      expect(result.appState?.toast).toBeUndefined();
      consoleError.mockRestore();
    });
  });

  describe("copyAsPng", () => {
    it("exports to the clipboard as PNG and shows a toast", async () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([r1]);
      API.setSelectedElements([r1]);

      const result = await perform(actionCopyAsPng);

      expect(mocks.exportCanvas.mock.calls[0][0]).toBe("clipboard");
      expect(result.appState?.toast?.message).toBe(
        t("toast.copyToClipboardAsPng", {
          exportSelection: t("toast.selection"),
          exportColorScheme: t("buttons.lightMode"),
        }),
      );
    });

    it("mentions the canvas when nothing is selected", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);

      const result = await perform(actionCopyAsPng);

      expect(result.appState?.toast?.message).toBe(
        t("toast.copyToClipboardAsPng", {
          exportSelection: t("toast.canvas"),
          exportColorScheme: t("buttons.lightMode"),
        }),
      );
    });

    it("surfaces export errors", async () => {
      const consoleError = silenceConsoleError();
      mocks.exportCanvas.mockRejectedValueOnce(new Error("png failed"));
      API.setElements([API.createElement({ type: "rectangle" })]);

      const result = await perform(actionCopyAsPng);

      expect(result.appState?.errorMessage).toBe("png failed");
      consoleError.mockRestore();
    });

    it("is bound to Alt+Shift+C by key code and requires elements", () => {
      expect(
        actionCopyAsPng.keyTest!(
          new KeyboardEvent("keydown", {
            altKey: true,
            shiftKey: true,
            code: CODES.C,
          }),
        ),
      ).toBe(true);
      expect(
        actionCopyAsPng.keyTest!(
          new KeyboardEvent("keydown", { altKey: true, code: CODES.C }),
        ),
      ).toBe(false);
      expect(actionCopyAsPng.predicate!([])).toBe(false);
    });

    it("returns without exporting when there is no canvas", async () => {
      const app = Object.create(h.app, { canvas: { value: null } });

      for (const action of [actionCopyAsPng, actionCopyAsSvg]) {
        const result = await action.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          app,
        );
        expect(result).toEqual({ captureUpdate: expect.anything() });
      }
      expect(mocks.exportCanvas).not.toHaveBeenCalled();
    });
  });

  describe("copyText", () => {
    it("is enabled only when a text element (or bound text) is selected", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const container = API.createElement({
        type: "rectangle",
        id: "container",
        boundElements: [{ type: "text", id: "boundText" }],
      });
      const boundText = API.createElement({
        type: "text",
        id: "boundText",
        containerId: "container",
        text: "inside",
      });
      API.setElements([rect, container, boundText]);

      const isEnabled = () =>
        copyText.predicate!(h.elements, h.state, h.app.props, h.app);

      API.setSelectedElements([rect]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([container]);
      expect(isEnabled()).toBe(true);
    });

    it("copies the text of all selected text elements", () => {
      const t1 = API.createElement({ type: "text", id: "t1", text: "first" });
      const t2 = API.createElement({ type: "text", id: "t2", text: "second" });
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([t1, t2, rect]);
      API.setSelectedElements([t1, t2, rect]);

      act(() => {
        h.app.actionManager.executeAction(copyText);
      });

      expect(mocks.copyTextToSystemClipboard).toHaveBeenCalledWith(
        "first\n\nsecond",
      );
    });

    it("throws a user-facing error when copying fails synchronously", () => {
      mocks.copyTextToSystemClipboard.mockImplementationOnce(() => {
        throw new Error("sync failure");
      });
      const t1 = API.createElement({ type: "text", id: "t1", text: "first" });
      API.setElements([t1]);
      API.setSelectedElements([t1]);

      expect(() =>
        copyText.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        ),
      ).toThrow(t("errors.copyToSystemClipboardFailed"));
    });
  });
});
