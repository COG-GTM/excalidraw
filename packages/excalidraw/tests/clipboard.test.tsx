import React from "react";
import { vi } from "vitest";

import { getLineHeightInPx } from "@excalidraw/element";

import { KEYS, arrayToMap, getLineHeight } from "@excalidraw/common";

import { getElementBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  actionCopyAsPng,
  actionCopyAsSvg,
  actionPaste,
  copyText,
} from "../actions/actionClipboard";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  createPasteEvent,
  readSystemClipboard,
  serializeAsClipboardJSON,
} from "../clipboard";
import { exportCanvas } from "../data/index";
import { t } from "../i18n";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { Pointer, Keyboard } from "./helpers/ui";
import {
  render,
  waitFor,
  GlobalTestState,
  unmountComponent,
} from "./test-utils";

import type { NormalizedZoomValue } from "../types";

import type { Action, ActionResult } from "../actions/types";
import type { AppClassProperties, AppState } from "../types";

const { h } = window;

const clipboardMocks = vi.hoisted(() => ({
  isFirefox: false,
  supportsWriteText: true,
  supportsBlob: true,
}));

const mouse = new Pointer("mouse");

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  const { mockThrottleRAF } = await import("./helpers/mocks");

  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    get isFirefox() {
      return clipboardMocks.isFirefox;
    },
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
    throttleRAF: mockThrottleRAF,
  };
});

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();

  return {
    __esmodule: true,
    ...module,
    get probablySupportsClipboardWriteText() {
      return clipboardMocks.supportsWriteText;
    },
    get probablySupportsClipboardBlob() {
      return clipboardMocks.supportsBlob;
    },
    readSystemClipboard: vi.fn(module.readSystemClipboard),
    copyTextToSystemClipboard: vi.fn(module.copyTextToSystemClipboard),
    copyBlobToClipboardAsPng: vi.fn(module.copyBlobToClipboardAsPng),
  };
});

vi.mock("../data/index", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/index")>();

  return {
    __esmodule: true,
    ...module,
    exportCanvas: vi.fn(module.exportCanvas),
  };
});

const sendPasteEvent = (text: string) => {
  const clipboardEvent = createPasteEvent({
    types: {
      "text/plain": text,
    },
  });
  document.dispatchEvent(clipboardEvent);
};

const pasteWithCtrlCmdShiftV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const pasteWithCtrlCmdV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

beforeEach(async () => {
  unmountComponent();

  localStorage.clear();

  mouse.reset();

  await render(
    <Excalidraw
      autoFocus={true}
      handleKeyboardGlobally={true}
      initialData={{ appState: { zoom: { value: 1 as NormalizedZoomValue } } }}
    />,
  );
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
});

describe("general paste behavior", () => {
  it("should randomize seed on paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rectangle],
      files: null,
    });
    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).not.toBe(rectangle.seed);
    });
  });

  it("should retain seed on shift-paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rectangle],
      files: null,
    });

    // assert we don't randomize seed on shift-paste
    pasteWithCtrlCmdShiftV(clipboardJSON);
    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).toBe(rectangle.seed);
    });
  });
});

describe("paste text as single lines", () => {
  it("should create an element for each line when copying with Ctrl/Cmd+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(text.split("\n").length);
    });
  });

  it("should ignore empty lines when creating an element for each line", async () => {
    const text = "\n\nsajgfakfn\n\n\naaksfnknas\n\nakefnkasf\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(3);
    });
  });

  it("should not create any element if clipboard has only new lines", async () => {
    const text = "\n\n\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      await sleep(50); // elements lenght will always be zero if we don't wait, since paste is async
      expect(h.elements.length).toEqual(0);
    });
  });

  it("should space items correctly", async () => {
    const elementsMap = arrayToMap(h.elements);

    const text = "hkhkjhki\njgkjhffjh\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0], elementsMap);
      for (let i = 1; i < h.elements.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [fx, elY] = getElementBounds(h.elements[i], elementsMap);
        expect(elY).toEqual(firstElY + lineHeightPx * i);
      }
    });
  });

  it("should leave a space for blank new lines", async () => {
    const elementsMap = arrayToMap(h.elements);
    const text = "hkhkjhki\n\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);

    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0], elementsMap);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [lx, lastElY] = getElementBounds(h.elements[1], elementsMap);
      expect(lastElY).toEqual(firstElY + lineHeightPx * 2);
    });
  });
});

describe("paste text as a single element", () => {
  it("should create single text element when copying text with Ctrl/Cmd+Shift+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
  });
  it("should not create any element when only new lines in clipboard", async () => {
    const text = "\n\n\n\n";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(async () => {
      await sleep(50);
      expect(h.elements.length).toEqual(0);
    });
  });
});

describe("Paste bound text container", () => {
  const container = {
    type: "ellipse",
    id: "container-id",
    x: 554.984375,
    y: 196.0234375,
    width: 166,
    height: 187.01953125,
    roundness: { type: 2 },
    boundElements: [{ type: "text", id: "text-id" }],
  };
  const textElement = {
    type: "text",
    id: "text-id",
    x: 560.51171875,
    y: 202.033203125,
    width: 154,
    height: 175,
    fontSize: 20,
    fontFamily: 1,
    text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
    baseline: 168,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: container.id,
    originalText:
      "Excalidraw is a virtual opensource whiteboard for sketching hand-drawn like diagrams",
  };

  it("should fix ellipse bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [container, textElement],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(368);
      expect(container.width).toBe(166);
    });
  });

  it("should fix diamond bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [
        {
          ...container,
          type: "diamond",
        },
        textElement,
      ],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(770);
      expect(container.width).toBe(166);
    });
  });
});

describe("pasting & frames", () => {
  it("should add pasted elements to frame under cursor", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({ type: "rectangle" });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(50, 50);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[0].index! < frame.index!).toBe(true);
    });
  });

  it("should layer pasted elements above the highest frame child", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const frameChild = API.createElement({
      id: "frameChild",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });
    const rect = API.createElement({ type: "rectangle" });

    API.setElements([frameChild, frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(50, 50);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(frame.id);
      expect(h.elements.map((element) => element.id)).toEqual([
        frameChild.id,
        h.elements[1].id,
        frame.id,
      ]);
      expect(h.elements[1].index! > frameChild.index!).toBe(true);
      expect(h.elements[1].index! < frame.index!).toBe(true);
    });
  });

  it("should preserve denormalized pasted frame child order", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const frameChild = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [frame, frameChild],
      files: null,
    });

    mouse.moveTo(200, 200);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[0].type).toBe(frame.type);
      expect(h.elements[1].type).toBe(frameChild.type);
      expect(h.elements[1].frameId).toBe(h.elements[0].id);
    });
  });

  it("should remove element from frame when pasted outside", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      frameId: frame.id,
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(150, 150);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(null);
    });
  });

  it("should filter out elements not overlapping frame", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 100,
      y: 100,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[2].type).toBe(rect2.type);
      expect(h.elements[2].frameId).toBe(null);
    });
  });

  it("should not filter out elements not overlapping frame if part of group", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      groupIds: ["g1"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 100,
      y: 100,
      groupIds: ["g1"],
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].type).toBe(rect2.type);
      expect(h.elements[1].frameId).toBe(frame.id);
      expect(h.elements[2].id).toBe(frame.id);
    });
  });

  it("should not filter out other frames and their children", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      groupIds: ["g1"],
    });

    const frame2 = API.createElement({
      type: "frame",
      width: 75,
      height: 75,
      x: 0,
      y: 0,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 55,
      y: 55,
      frameId: frame2.id,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2, frame2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(4);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[2].type).toBe(rect2.type);
      expect(h.elements[2].frameId).toBe(h.elements[3].id);
      expect(h.elements[3].type).toBe(frame2.type);
      expect(h.elements[3].frameId).toBe(null);
    });
  });
});

describe("clipboard - pasting mermaid definition", () => {
  beforeAll(() => {
    mockMermaidToExcalidraw({
      parseMermaidToExcalidraw: async (definition) => {
        const lines = definition.split("\n");
        return new Promise((resolve, reject) => {
          if (lines.some((line) => line === "flowchart TD")) {
            resolve({
              elements: [
                {
                  id: "rect1",
                  type: "rectangle",
                  groupIds: [],
                  x: 0,
                  y: 0,
                  width: 69.703125,
                  height: 44,
                  strokeWidth: 2,
                  label: {
                    groupIds: [],
                    text: "A",
                    fontSize: 20,
                  },
                  link: null,
                },
              ],
            });
          } else {
            reject(new Error("ERROR"));
          }
        });
      },
    });
  });

  it("should detect and paste as mermaid", async () => {
    const text = "flowchart TD\nA";

    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(2);
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "rectangle" }),
          expect.objectContaining({ type: "text", text: "A" }),
        ]),
      );
    });
  });

  it("should support directives", async () => {
    const text = "%%{init: { **config** } }%%\nflowchart TD\nA";

    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(2);
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "rectangle" }),
          expect.objectContaining({ type: "text", text: "A" }),
        ]),
      );
    });
  });

  it("should paste as normal text if invalid mermaid", async () => {
    const text = "flowchart TD xx\nA";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(2);
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text", text: "flowchart TD xx" }),
          expect.objectContaining({ type: "text", text: "A" }),
        ]),
      );
    });
  });
});

describe("clipboard actions", () => {
  const performAction = async (
    action: Action,
    appState: AppState = h.state,
    app: AppClassProperties = h.app as unknown as AppClassProperties,
  ): Promise<ActionResult> =>
    action.perform(
      h.app.scene.getElementsIncludingDeleted(),
      appState,
      null,
      app,
    );

  const checkPredicate = (
    action: Action,
    elements: readonly ExcalidrawElement[],
  ) =>
    action.predicate!(
      elements,
      h.state,
      {},
      h.app as unknown as AppClassProperties,
    );

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clipboardMocks.isFirefox = false;
    clipboardMocks.supportsWriteText = true;
    clipboardMocks.supportsBlob = true;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.mocked(readSystemClipboard).mockReset();
    vi.mocked(copyTextToSystemClipboard).mockReset();
    vi.mocked(copyBlobToClipboardAsPng).mockReset();
    vi.mocked(exportCanvas).mockReset();
    vi.restoreAllMocks();
  });

  describe("paste", () => {
    it.each(["AbortError", "NotAllowedError"])(
      "should silently bail out when clipboard read rejects with %s",
      async (name) => {
        const error = new Error("denied");
        error.name = name;
        vi.mocked(readSystemClipboard).mockRejectedValueOnce(error);
        const pasteSpy = vi.spyOn(h.app, "pasteFromClipboard");

        const result = await performAction(actionPaste);

        expect(result).toBe(false);
        expect(pasteSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      },
    );

    it("should set generic read error message when clipboard read fails", async () => {
      vi.mocked(readSystemClipboard).mockRejectedValueOnce(
        new TypeError("read failed"),
      );

      const result = await performAction(actionPaste);

      expect(result).not.toBe(false);
      expect(result && result.appState?.errorMessage).toBe(
        t("errors.asyncPasteFailedOnRead"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "actionPaste TypeError: read failed",
      );
    });

    it("should set Firefox hint when clipboard read fails on Firefox", async () => {
      clipboardMocks.isFirefox = true;
      vi.mocked(readSystemClipboard).mockRejectedValueOnce(
        new TypeError("read failed"),
      );

      const result = await performAction(actionPaste);

      expect(result && result.appState?.errorMessage).toBe(
        t("hints.firefox_clipboard_write"),
      );
    });

    it("should surface error via executeAction when clipboard read fails", async () => {
      vi.mocked(readSystemClipboard).mockRejectedValueOnce(
        new Error("read failed"),
      );

      h.app.actionManager.executeAction(actionPaste);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(t("errors.asyncPasteFailedOnRead"));
      });
      expect(h.elements.length).toBe(0);
    });

    it("should set parse error message when pasting clipboard data throws", async () => {
      vi.mocked(readSystemClipboard).mockResolvedValueOnce({
        "text/plain": "hello",
      });
      const parseError = new Error("parse failed");
      vi.spyOn(h.app, "pasteFromClipboard").mockImplementationOnce(() => {
        throw parseError;
      });

      const result = await performAction(actionPaste);

      expect(result && result.appState?.errorMessage).toBe(
        t("errors.asyncPasteFailedOnParse"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(parseError);
    });

    it("should paste clipboard contents read from the system clipboard", async () => {
      vi.mocked(readSystemClipboard).mockResolvedValueOnce({
        "text/plain": "hello",
      });
      const pasteSpy = vi.spyOn(h.app, "pasteFromClipboard");

      const result = await performAction(actionPaste);

      expect(result && result.appState).toBeUndefined();
      expect(pasteSpy).toHaveBeenCalledTimes(1);
      const event = pasteSpy.mock.calls[0][0] as ClipboardEvent;
      expect(event.clipboardData?.getData("text/plain")).toBe("hello");
    });
  });

  describe("copyAsSvg", () => {
    it("should no-op when there is no canvas", async () => {
      const result = await performAction(actionCopyAsSvg, h.state, {
        ...h.app,
        canvas: null,
      } as unknown as AppClassProperties);

      expect(result).toEqual({ captureUpdate: expect.anything() });
      expect(exportCanvas).not.toHaveBeenCalled();
    });

    it("should copy SVG of selection and show toast", async () => {
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([rectangle]);
      API.setSelectedElements([rectangle]);
      vi.mocked(copyTextToSystemClipboard).mockResolvedValueOnce(undefined);

      h.app.actionManager.executeAction(actionCopyAsSvg);

      await waitFor(() => {
        expect(h.state.toast?.message).toBe(
          t("toast.copyToClipboardAsSvg", {
            exportSelection: t("toast.selection"),
            exportColorScheme: t("buttons.lightMode"),
          }),
        );
      });
      expect(exportCanvas).toHaveBeenCalledWith(
        "clipboard-svg",
        [expect.objectContaining({ id: rectangle.id })],
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ exportingFrame: null }),
      );
      expect(copyTextToSystemClipboard).toHaveBeenCalledTimes(1);
      expect(vi.mocked(copyTextToSystemClipboard).mock.calls[0][0]).toMatch(
        /^<svg/,
      );
      expect(h.state.errorMessage).toBe(null);
    });

    it("should mention canvas and dark mode in toast when nothing is selected", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      vi.mocked(copyTextToSystemClipboard).mockResolvedValueOnce(undefined);

      const result = await performAction(actionCopyAsSvg, {
        ...h.state,
        exportWithDarkMode: true,
      });

      expect(result && result.appState?.toast?.message).toBe(
        t("toast.copyToClipboardAsSvg", {
          exportSelection: t("toast.canvas"),
          exportColorScheme: t("buttons.darkMode"),
        }),
      );
      expect(exportCanvas).toHaveBeenCalledWith(
        "clipboard-svg",
        expect.anything(),
        expect.objectContaining({ exportWithDarkMode: true }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("should set errorMessage when writing to the clipboard fails", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      vi.mocked(copyTextToSystemClipboard).mockRejectedValueOnce(
        new Error("write failed"),
      );

      h.app.actionManager.executeAction(actionCopyAsSvg);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(
          t("errors.copyToSystemClipboardFailed"),
        );
      });
      expect(h.state.toast).toBe(null);
    });

    it("should set errorMessage when canvas is empty", async () => {
      const result = await performAction(actionCopyAsSvg);

      expect(result && result.appState?.errorMessage).toBe(
        t("alerts.cannotExportEmptyCanvas"),
      );
    });

    it("predicate should require elements and clipboard writeText support", () => {
      const elements = [API.createElement({ type: "rectangle" })];

      expect(checkPredicate(actionCopyAsSvg, elements)).toBe(true);
      expect(checkPredicate(actionCopyAsSvg, [])).toBe(false);

      clipboardMocks.supportsWriteText = false;
      expect(checkPredicate(actionCopyAsSvg, elements)).toBe(false);
    });
  });

  describe("copyAsPng", () => {
    it("should no-op when there is no canvas", async () => {
      const result = await performAction(actionCopyAsPng, h.state, {
        ...h.app,
        canvas: null,
      } as unknown as AppClassProperties);

      expect(result).toEqual({ captureUpdate: expect.anything() });
      expect(exportCanvas).not.toHaveBeenCalled();
    });

    it("should copy PNG of selection and show toast", async () => {
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([rectangle]);
      API.setSelectedElements([rectangle]);
      vi.mocked(copyBlobToClipboardAsPng).mockResolvedValueOnce(undefined);

      h.app.actionManager.executeAction(actionCopyAsPng);

      await waitFor(() => {
        expect(h.state.toast?.message).toBe(
          t("toast.copyToClipboardAsPng", {
            exportSelection: t("toast.selection"),
            exportColorScheme: t("buttons.lightMode"),
          }),
        );
      });
      expect(exportCanvas).toHaveBeenCalledWith(
        "clipboard",
        [expect.objectContaining({ id: rectangle.id })],
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ exportingFrame: null }),
      );
      expect(copyBlobToClipboardAsPng).toHaveBeenCalledTimes(1);
      expect(h.state.errorMessage).toBe(null);
    });

    it("should set canvas-too-big errorMessage when blob export fails", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      const error = new Error("Canvas too big");
      error.name = "CANVAS_POSSIBLY_TOO_BIG";
      vi.mocked(copyBlobToClipboardAsPng).mockRejectedValueOnce(error);
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      h.app.actionManager.executeAction(actionCopyAsPng);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(t("canvasError.canvasTooBig"));
      });
      expect(h.state.toast).toBe(null);
      consoleWarnSpy.mockRestore();
    });

    it("should set errorMessage when export throws", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      vi.mocked(exportCanvas).mockRejectedValueOnce(new Error("export failed"));

      const result = await performAction(actionCopyAsPng);

      expect(result && result.appState?.errorMessage).toBe("export failed");
      expect(result && result.appState?.toast).toBeFalsy();
    });

    it("predicate should require elements and clipboard blob support", () => {
      const elements = [API.createElement({ type: "rectangle" })];

      expect(checkPredicate(actionCopyAsPng, elements)).toBe(true);
      expect(checkPredicate(actionCopyAsPng, [])).toBe(false);

      clipboardMocks.supportsBlob = false;
      expect(checkPredicate(actionCopyAsPng, elements)).toBe(false);
    });
  });

  describe("copyText", () => {
    it("should copy text of selected text elements", () => {
      const text1 = API.createElement({ type: "text", text: "hello" });
      const text2 = API.createElement({ type: "text", text: "world" });
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([text1, text2, rectangle]);
      API.setSelectedElements([text1, text2, rectangle]);
      vi.mocked(copyTextToSystemClipboard).mockResolvedValueOnce(undefined);

      performAction(copyText);

      expect(copyTextToSystemClipboard).toHaveBeenCalledWith("hello\n\nworld");
    });

    it("should throw a user-facing error when copying fails", () => {
      const text = API.createElement({ type: "text", text: "hello" });
      API.setElements([text]);
      API.setSelectedElements([text]);
      vi.mocked(copyTextToSystemClipboard).mockImplementationOnce(() => {
        throw new Error("write failed");
      });

      // copyText.perform is synchronous, so the error is thrown, not rejected
      expect(() =>
        copyText.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app as unknown as AppClassProperties,
        ),
      ).toThrow(t("errors.copyToSystemClipboardFailed"));
    });

    it("predicate should require a selected text element and writeText support", () => {
      const text = API.createElement({ type: "text", text: "hello" });
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([text, rectangle]);
      const elements = h.app.scene.getElementsIncludingDeleted();

      API.setSelectedElements([rectangle]);
      expect(checkPredicate(copyText, elements)).toBe(false);

      API.setSelectedElements([text]);
      expect(checkPredicate(copyText, elements)).toBe(true);

      clipboardMocks.supportsWriteText = false;
      expect(checkPredicate(copyText, elements)).toBe(false);
    });
  });
});
