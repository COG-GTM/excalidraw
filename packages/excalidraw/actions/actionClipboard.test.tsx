import { vi } from "vitest";

import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

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

import type { AppClassProperties } from "../types";
import type { Action } from "./types";

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    probablySupportsClipboardWriteText: true,
    probablySupportsClipboardBlob: true,
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

const elements = () => h.app.scene.getElementsIncludingDeleted();

const copyToClipboardMock = vi.mocked(copyToClipboard);
const copyTextMock = vi.mocked(copyTextToSystemClipboard);
const readClipboardMock = vi.mocked(readSystemClipboard);
const exportCanvasMock = vi.mocked(exportCanvas);

const ids = (elements: readonly ExcalidrawElement[]) =>
  elements.map((el) => el.id).sort();

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
    it("copies the selection including bound text and frame children", async () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const child = API.createElement({
        type: "rectangle",
        id: "child",
        frameId: "frame",
      });
      const [container, text] = API.createTextContainer();
      const other = API.createElement({ type: "ellipse", id: "other" });
      API.setElements([frame, child, container, text, other]);
      API.setSelectedElements([frame, container]);

      const result = await actionCopy.perform(elements(), h.state, null, h.app);

      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      const [copied, files, event] = copyToClipboardMock.mock.calls[0];
      expect(ids(copied as ExcalidrawElement[])).toEqual(
        ids([frame, child, container, text]),
      );
      expect(files).toBe(h.app.files);
      expect(event).toBe(null);
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("surfaces clipboard failures as an error message", async () => {
      copyToClipboardMock.mockRejectedValueOnce(new Error("write blocked"));
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await actionCopy.perform(elements(), h.state, null, h.app);

      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: { errorMessage: "write blocked" },
      });
    });
  });

  describe("paste", () => {
    it("forwards clipboard contents to app.pasteFromClipboard", async () => {
      readClipboardMock.mockResolvedValueOnce({ "text/plain": "hello" });
      const pasteSpy = vi
        .spyOn(h.app, "pasteFromClipboard")
        .mockResolvedValue(undefined);

      const result = await actionPaste.perform(
        elements(),
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
      "silently aborts on %s",
      async (name) => {
        readClipboardMock.mockRejectedValueOnce(namedError(name));
        const pasteSpy = vi.spyOn(h.app, "pasteFromClipboard");

        const result = await actionPaste.perform(
          elements(),
          h.state,
          null,
          h.app,
        );

        expect(result).toBe(false);
        expect(pasteSpy).not.toHaveBeenCalled();
      },
    );

    it("reports a read failure for other clipboard errors", async () => {
      readClipboardMock.mockRejectedValueOnce(namedError("TypeError", "boom"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionPaste.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: { errorMessage: t("errors.asyncPasteFailedOnRead") },
      });
      expect(consoleError).toHaveBeenCalledWith("actionPaste TypeError: boom");
      consoleError.mockRestore();
    });

    it("reports a parse failure when pasting throws", async () => {
      readClipboardMock.mockResolvedValueOnce({ "text/plain": "x" });
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementation(() => {
        throw new Error("bad data");
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionPaste.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: { errorMessage: t("errors.asyncPasteFailedOnParse") },
      });
      consoleError.mockRestore();
    });
  });

  describe("cut", () => {
    it("copies and deletes the selected elements", () => {
      const a = API.createElement({ type: "rectangle", id: "a" });
      const b = API.createElement({ type: "rectangle", id: "b" });
      API.setElements([a, b]);
      API.setSelectedElements([a]);

      API.executeAction(actionCut);

      expect(ids(copyToClipboardMock.mock.calls[0][0] as any)).toEqual(["a"]);
      expect(h.elements.find((el) => el.id === "a")!.isDeleted).toBe(true);
      expect(h.elements.find((el) => el.id === "b")!.isDeleted).toBe(false);
    });

    it("is bound to Ctrl+X", () => {
      expect(
        actionCut.keyTest!(
          new KeyboardEvent("keydown", { key: KEYS.X, ctrlKey: true }),
          h.state,
          elements(),
          h.app,
        ),
      ).toBe(true);
      expect(
        actionCut.keyTest!(
          new KeyboardEvent("keydown", { key: KEYS.X }),
          h.state,
          elements(),
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe.each([
    {
      action: actionCopyAsSvg,
      exportType: "clipboard-svg",
      toastKey: "toast.copyToClipboardAsSvg",
    },
    {
      action: actionCopyAsPng,
      exportType: "clipboard",
      toastKey: "toast.copyToClipboardAsPng",
    },
  ] as const)("$action.name", ({ action, exportType, toastKey }) => {
    it("is enabled only when the scene has elements", () => {
      expect(
        (action as Action).predicate!([], h.state, h.app.props, h.app),
      ).toBe(false);
      expect(
        (action as Action).predicate!(
          [API.createElement({ type: "rectangle" })],
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);
    });

    it("exports only the selection and reports it in the toast", async () => {
      const a = API.createElement({ type: "rectangle", id: "a" });
      const b = API.createElement({ type: "rectangle", id: "b" });
      API.setElements([a, b]);
      API.setSelectedElements([a]);

      const result = await action.perform(elements(), h.state, null, h.app);

      expect(exportCanvasMock).toHaveBeenCalledTimes(1);
      const [type, exported, , files, opts] = exportCanvasMock.mock.calls[0];
      expect(type).toBe(exportType);
      expect(ids(exported)).toEqual(["a"]);
      expect(files).toBe(h.app.files);
      expect(opts).toMatchObject({ name: h.app.getName() });
      expect(result).toMatchObject({
        appState: {
          toast: {
            message: t(toastKey, {
              exportSelection: t("toast.selection"),
              exportColorScheme: t("buttons.lightMode"),
            }),
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("exports the whole canvas in dark mode when nothing is selected", async () => {
      API.setElements([
        API.createElement({ type: "rectangle", id: "a" }),
        API.createElement({ type: "rectangle", id: "b" }),
      ]);
      API.setSelectedElements([]);

      const result = await action.perform(
        elements(),
        { ...h.state, exportWithDarkMode: true },
        null,
        h.app,
      );

      expect(ids(exportCanvasMock.mock.calls[0][1])).toEqual(["a", "b"]);
      expect(result).toMatchObject({
        appState: {
          toast: {
            message: t(toastKey, {
              exportSelection: t("toast.canvas"),
              exportColorScheme: t("buttons.darkMode"),
            }),
          },
        },
      });
    });

    it("surfaces export failures as an error message", async () => {
      exportCanvasMock.mockRejectedValueOnce(new Error("export failed"));
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      API.setElements([API.createElement({ type: "rectangle" })]);

      const result = await action.perform(elements(), h.state, null, h.app);

      expect(result).toMatchObject({
        appState: { errorMessage: "export failed" },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      consoleError.mockRestore();
    });

    it("does nothing without a canvas", async () => {
      const app = { canvas: null } as unknown as AppClassProperties;

      const result = await action.perform(elements(), h.state, null, app);

      expect(exportCanvasMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });
  });

  it("copyAsPng is bound to Alt+Shift+C", () => {
    expect(
      actionCopyAsPng.keyTest!(
        new KeyboardEvent("keydown", {
          code: CODES.C,
          altKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe(true);
    expect(
      actionCopyAsPng.keyTest!(
        new KeyboardEvent("keydown", { code: CODES.C, altKey: true }),
      ),
    ).toBe(false);
  });

  describe("copyText", () => {
    it("is enabled only when the selection contains text", () => {
      const [container, text] = API.createTextContainer();
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([container, text, rect]);

      API.setSelectedElements([rect]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        false,
      );

      API.setSelectedElements([container]);
      expect(copyText.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
        true,
      );
    });

    it("copies the text of the selected elements", () => {
      const first = API.createElement({
        type: "text",
        text: "first",
        y: 0,
      });
      const second = API.createElement({
        type: "text",
        text: "second",
        y: 100,
      });
      API.setElements([first, second]);
      API.setSelectedElements([first, second]);

      const result = copyText.perform(elements(), h.state, null, h.app);

      expect(copyTextMock).toHaveBeenCalledTimes(1);
      const copied = copyTextMock.mock.calls[0][0] as string;
      expect(copied).toContain("first");
      expect(copied).toContain("second");
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("throws a translated error when copying throws synchronously", () => {
      copyTextMock.mockImplementationOnce(() => {
        throw new Error("nope");
      });
      const text = API.createElement({ type: "text", text: "x" });
      API.setElements([text]);
      API.setSelectedElements([text]);

      expect(() =>
        copyText.perform(elements(), h.state, null, h.app),
      ).toThrowError(t("errors.copyToSystemClipboardFailed"));
    });
  });
});
