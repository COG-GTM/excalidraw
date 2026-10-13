import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

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

import type { Action, ActionResult } from "./types";

type PerformResult = Exclude<ActionResult, false>;

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    probablySupportsClipboardWriteText: true,
    probablySupportsClipboardBlob: true,
    copyToClipboard: vi.fn(async () => {}),
    copyTextToSystemClipboard: vi.fn(async () => {}),
    readSystemClipboard: vi.fn(async () => ({})),
  };
});

vi.mock("../data/index", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/index")>();
  return {
    ...module,
    exportCanvas: vi.fn(async () => {}),
  };
});

const { h } = window;

const perform = (
  action: { perform: (...args: any[]) => any },
  value: any = null,
  appState: Partial<typeof h.state> = {},
) =>
  Promise.resolve(
    action.perform(
      h.app.scene.getElementsIncludingDeleted(),
      { ...h.state, ...appState },
      value,
      h.app,
    ),
  ) as Promise<PerformResult>;

const keyEvent = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", init) as unknown as React.KeyboardEvent &
    KeyboardEvent;

describe("actionClipboard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionCopy", () => {
    it("copies the selection including bound text and frame children", async () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const child = API.createElement({ id: "child", frameId: "frame" });
      const container = API.createElement({
        id: "container",
        x: 300,
        boundElements: [{ id: "label", type: "text" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        containerId: "container",
      });
      const other = API.createElement({ id: "other", x: 600 });
      API.setElements([frame, child, container, label, other]);
      API.setSelectedElements([frame, container]);
      const event = new ClipboardEvent("copy", {
        clipboardData: new DataTransfer(),
      });

      const result = await perform(actionCopy, event);

      expect(copyToClipboard).toHaveBeenCalledTimes(1);
      const [copied, files, passedEvent] =
        vi.mocked(copyToClipboard).mock.calls[0];
      expect(copied.map((el) => el.id).sort()).toEqual(
        ["child", "container", "frame", "label"].sort(),
      );
      expect(files).toBe(h.app.files);
      expect(passedEvent).toBe(event);
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("surfaces clipboard errors as errorMessage", async () => {
      vi.mocked(copyToClipboard).mockRejectedValueOnce(
        new Error("copy failed"),
      );
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await perform(actionCopy);

      expect(result.appState?.errorMessage).toBe("copy failed");
      expect(result.captureUpdate).toBe(CaptureUpdateAction.EVENTUALLY);
    });
  });

  describe("actionCut", () => {
    it("copies the selection and deletes it", () => {
      const a = API.createElement({ id: "a" });
      const b = API.createElement({ id: "b", x: 200 });
      API.setElements([a, b]);
      API.setSelectedElements([a]);

      API.executeAction(actionCut);

      expect(copyToClipboard).toHaveBeenCalledTimes(1);
      expect(
        vi.mocked(copyToClipboard).mock.calls[0][0].map((el) => el.id),
      ).toEqual(["a"]);
      expect(h.elements.find((el) => el.id === "a")?.isDeleted).toBe(true);
      expect(h.elements.find((el) => el.id === "b")?.isDeleted).toBe(false);
    });

    it("matches Ctrl/Cmd+X only", () => {
      expect(
        actionCut.keyTest!(
          keyEvent({ key: KEYS.X, [KEYS.CTRL_OR_CMD]: true }),
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
      ).toBeFalsy();
      expect(
        actionCut.keyTest!(
          keyEvent({ key: KEYS.C, [KEYS.CTRL_OR_CMD]: true }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe("actionPaste", () => {
    it("pastes the system clipboard contents via a synthetic paste event", async () => {
      vi.mocked(readSystemClipboard).mockResolvedValueOnce({
        "text/plain": "hello",
      });
      const pasteFromClipboard = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockImplementation(async () => {});

      const result = await perform(actionPaste);

      expect(pasteFromClipboard).toHaveBeenCalledTimes(1);
      const event = pasteFromClipboard.mock.calls[0][0] as ClipboardEvent;
      expect(event.clipboardData?.getData("text/plain")).toBe("hello");
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it.each(["AbortError", "NotAllowedError"])(
      "silently aborts on %s",
      async (name) => {
        const error = new Error("denied");
        error.name = name;
        vi.mocked(readSystemClipboard).mockRejectedValueOnce(error);
        const pasteFromClipboard = vi.spyOn(h.app, "pasteFromClipboard");

        const result = await perform(actionPaste);

        expect(result).toBe(false);
        expect(pasteFromClipboard).not.toHaveBeenCalled();
      },
    );

    it("reports other read errors", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("boom");
      error.name = "TypeError";
      vi.mocked(readSystemClipboard).mockRejectedValueOnce(error);

      const result = await perform(actionPaste);

      expect(result).toMatchObject({
        appState: { errorMessage: t("errors.asyncPasteFailedOnRead") },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(consoleError).toHaveBeenCalledWith("actionPaste TypeError: boom");
      consoleError.mockRestore();
    });

    it("reports errors thrown while parsing the pasted data", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(readSystemClipboard).mockResolvedValueOnce({
        "text/plain": "hello",
      });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementation(() => {
        throw new Error("parse failed");
      });

      const result = await perform(actionPaste);

      expect(result).toMatchObject({
        appState: { errorMessage: t("errors.asyncPasteFailedOnParse") },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      consoleError.mockRestore();
    });
  });

  describe.each([
    {
      action: actionCopyAsSvg as Action,
      exportType: "clipboard-svg",
      toastKey: "toast.copyToClipboardAsSvg",
    },
    {
      action: actionCopyAsPng as Action,
      exportType: "clipboard",
      toastKey: "toast.copyToClipboardAsPng",
    },
  ] as const)("$action.name", ({ action, exportType, toastKey }) => {
    it("is enabled only when there are elements", () => {
      expect(action.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        false,
      );
      API.setElements([API.createElement({ id: "rect" })]);
      expect(action.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        true,
      );
    });

    it("exports the selection and shows a selection/light-mode toast", async () => {
      const a = API.createElement({ id: "a" });
      const b = API.createElement({ id: "b", x: 300 });
      API.setElements([a, b]);
      API.setSelectedElements([a]);

      const result = await perform(action, null, {
        exportWithDarkMode: false,
      });

      expect(exportCanvas).toHaveBeenCalledTimes(1);
      const [type, exportedElements, , files, opts] =
        vi.mocked(exportCanvas).mock.calls[0];
      expect(type).toBe(exportType);
      expect(exportedElements.map((el) => el.id)).toEqual(["a"]);
      expect(files).toBe(h.app.files);
      expect(opts).toMatchObject({
        name: h.app.getName(),
        exportingFrame: null,
      });
      expect(result.appState?.toast?.message).toBe(
        t(toastKey, {
          exportSelection: t("toast.selection"),
          exportColorScheme: t("buttons.lightMode"),
        }),
      );
      expect(result.captureUpdate).toBe(CaptureUpdateAction.EVENTUALLY);
    });

    it("exports the whole canvas and mentions dark mode when nothing is selected", async () => {
      API.setElements([
        API.createElement({ id: "a" }),
        API.createElement({ id: "b", x: 300 }),
      ]);

      const result = await perform(action, null, { exportWithDarkMode: true });

      expect(
        vi.mocked(exportCanvas).mock.calls[0][1].map((el) => el.id),
      ).toEqual(["a", "b"]);
      expect(result.appState?.toast?.message).toBe(
        t(toastKey, {
          exportSelection: t("toast.canvas"),
          exportColorScheme: t("buttons.darkMode"),
        }),
      );
    });

    it("surfaces export errors as errorMessage", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(exportCanvas).mockRejectedValueOnce(new Error("export failed"));
      API.setElements([API.createElement({ id: "a" })]);

      const result = await perform(action);

      expect(result.appState?.errorMessage).toBe("export failed");
      expect(result.appState?.toast).toBeFalsy();
      consoleError.mockRestore();
    });

    it("does nothing while the canvas isn't mounted", async () => {
      API.setElements([API.createElement({ id: "a" })]);
      const canvas = h.app.canvas;
      // @ts-ignore
      h.app.canvas = null;
      try {
        const result = await perform(action);
        expect(result).toEqual({
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
        expect(exportCanvas).not.toHaveBeenCalled();
      } finally {
        // @ts-ignore
        h.app.canvas = canvas;
      }
    });
  });

  it("actionCopyAsPng matches Alt+Shift+C by code", () => {
    const keyTest = (actionCopyAsPng as Action).keyTest!;
    expect(
      keyTest(
        keyEvent({ code: "KeyC", altKey: true, shiftKey: true }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBe(true);
    expect(
      keyTest(
        keyEvent({ code: "KeyC", altKey: true }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBe(false);
    expect(
      keyTest(
        keyEvent({ code: "KeyV", altKey: true, shiftKey: true }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBe(false);
  });

  describe("copyText", () => {
    it("is enabled only when the selection contains text", () => {
      const rect = API.createElement({ id: "rect" });
      const text = API.createElement({ type: "text", id: "text", text: "hi" });
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

    it("copies the text of selected text elements, including bound text", () => {
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
      const text = API.createElement({
        type: "text",
        id: "text",
        text: "free",
        x: 300,
      });
      API.setElements([container, label, text]);
      API.setSelectedElements([container, text]);

      const result = copyText.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(copyTextToSystemClipboard).toHaveBeenCalledTimes(1);
      const copied = vi.mocked(copyTextToSystemClipboard).mock
        .calls[0][0] as string;
      expect(copied.split("\n\n").sort()).toEqual(["bound", "free"]);
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("throws a translated error when copying fails synchronously", () => {
      vi.mocked(copyTextToSystemClipboard).mockImplementationOnce(() => {
        throw new Error("nope");
      });
      const text = API.createElement({ type: "text", id: "text", text: "hi" });
      API.setElements([text]);
      API.setSelectedElements([text]);

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
