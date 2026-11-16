import {
  CODES,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  FONT_FAMILY,
  ROUNDNESS,
  getLineHeight,
} from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import {
  actionCopyStyles,
  actionPasteStyles,
  copiedStyles,
} from "./actionStyles";

const { h } = window;

const getElements = () => h.app.scene.getElementsIncludingDeleted();

const getElement = (id: string) =>
  h.elements.find((el) => el.id === id)! as NonDeletedExcalidrawElement;

const loadScene = (elements: NonDeletedExcalidrawElement[]) => {
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
};

const copyStylesFrom = (element: NonDeletedExcalidrawElement) => {
  API.setSelectedElements([getElement(element.id)]);
  API.executeAction(actionCopyStyles);
};

const pasteStylesTo = (...elements: NonDeletedExcalidrawElement[]) => {
  API.setSelectedElements(elements.map((el) => getElement(el.id)));
  API.executeAction(actionPasteStyles);
};

const styledRect = (overrides: Partial<ExcalidrawElement> = {}) =>
  API.createElement({
    type: "rectangle",
    id: "source",
    strokeColor: "#e03131",
    backgroundColor: "#a5d8ff",
    fillStyle: "cross-hatch",
    strokeWidth: 4,
    strokeStyle: "dotted",
    roughness: 2,
    opacity: 60,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    ...(overrides as any),
  });

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  // must run first: `copiedStyles` is module state shared by the tests below
  it("pasting before anything was copied leaves elements untouched", () => {
    const target = API.createElement({ type: "rectangle", id: "target" });
    loadScene([target]);
    expect(copiedStyles).toBe("{}");

    const result = actionPasteStyles.perform(
      getElements(),
      h.state,
      null,
      h.app,
    );

    expect(result).toEqual({
      elements: h.elements,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  });

  it("copying with nothing selected keeps the previous clipboard but shows a toast", () => {
    loadScene([styledRect()]);
    const before = copiedStyles;

    API.setSelectedElements([]);
    API.executeAction(actionCopyStyles);

    expect(copiedStyles).toBe(before);
    expect(h.state.toast?.message).toBe(t("toast.copyStyles"));
  });

  it("matches Ctrl+Alt+C / Ctrl+Alt+V by event code", () => {
    const event = (code: string, extra: Partial<KeyboardEvent> = {}) =>
      ({ ctrlKey: true, altKey: true, code, ...extra } as KeyboardEvent);

    expect(actionCopyStyles.keyTest!(event(CODES.C))).toBe(true);
    expect(actionPasteStyles.keyTest!(event(CODES.V))).toBe(true);
    expect(actionCopyStyles.keyTest!(event(CODES.V))).toBe(false);
    expect(actionCopyStyles.keyTest!(event(CODES.C, { altKey: false }))).toBe(
      false,
    );
    expect(actionPasteStyles.keyTest!(event(CODES.V, { ctrlKey: false }))).toBe(
      false,
    );
  });

  it("copies a container together with its bound text", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "hi",
      containerId: container.id,
    });
    loadScene([container, label]);

    copyStylesFrom(container);

    const copied = JSON.parse(copiedStyles);
    expect(copied.map((el: ExcalidrawElement) => el.id)).toEqual([
      "container",
      "label",
    ]);
  });

  it("pastes container and bound text styles onto another labeled container", () => {
    const source = styledRect({
      boundElements: [{ type: "text", id: "sourceLabel" }],
    });
    const sourceLabel = API.createElement({
      type: "text",
      id: "sourceLabel",
      text: "src",
      containerId: source.id,
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      strokeColor: "#2f9e44",
      textAlign: "left",
    });
    const target = API.createElement({
      type: "rectangle",
      id: "target",
      x: 300,
      boundElements: [{ type: "text", id: "targetLabel" }],
    });
    const targetLabel = API.createElement({
      type: "text",
      id: "targetLabel",
      text: "dst",
      x: 300,
      containerId: target.id,
      fontSize: 20,
      textAlign: "center",
    });
    loadScene([source, sourceLabel, target, targetLabel]);

    copyStylesFrom(source);
    pasteStylesTo(target);

    expect(getElement("target")).toMatchObject({
      strokeColor: "#e03131",
      backgroundColor: "#a5d8ff",
      fillStyle: "cross-hatch",
      strokeWidth: 4,
      strokeStyle: "dotted",
      roughness: 2,
      opacity: 60,
    });
    expect(getElement("targetLabel")).toMatchObject({
      strokeColor: "#2f9e44",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "left",
      text: "dst",
    });
  });

  it("leaves bound text untouched when the copied element had no label", () => {
    const source = styledRect();
    const target = API.createElement({
      type: "rectangle",
      id: "target",
      boundElements: [{ type: "text", id: "targetLabel" }],
    });
    const targetLabel = API.createElement({
      type: "text",
      id: "targetLabel",
      text: "dst",
      containerId: target.id,
      strokeColor: "#1e1e1e",
      fontSize: 20,
    });
    loadScene([source, target, targetLabel]);

    copyStylesFrom(source);
    pasteStylesTo(target);

    expect(getElement("target").strokeColor).toBe("#e03131");
    expect(getElement("targetLabel")).toMatchObject({
      strokeColor: "#1e1e1e",
      fontSize: 20,
    });
  });

  it("copies font properties between text elements", () => {
    const source = API.createElement({
      type: "text",
      id: "source",
      text: "src",
      fontSize: 48,
      fontFamily: FONT_FAMILY["Comic Shanns"],
      textAlign: "right",
      strokeColor: "#1971c2",
    });
    const target = API.createElement({
      type: "text",
      id: "target",
      text: "target",
      fontSize: 16,
      textAlign: "left",
    });
    loadScene([source, target]);

    copyStylesFrom(source);
    pasteStylesTo(target);

    const pasted = getElement("target");
    expect(pasted).toMatchObject({
      text: "target",
      fontSize: 48,
      fontFamily: FONT_FAMILY["Comic Shanns"],
      textAlign: "right",
      strokeColor: "#1971c2",
      lineHeight: (source as any).lineHeight,
    });
    // bounding box is recomputed for the new font size
    expect(pasted.height).toBeCloseTo(48 * (pasted as any).lineHeight);
  });

  it("falls back to default font properties when pasting a shape's styles onto text", () => {
    const source = styledRect();
    const target = API.createElement({
      type: "text",
      id: "target",
      text: "target",
      fontSize: 64,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
    });
    loadScene([source, target]);

    copyStylesFrom(source);
    pasteStylesTo(target);

    expect(getElement("target")).toMatchObject({
      strokeColor: "#e03131",
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: DEFAULT_FONT_FAMILY,
      textAlign: DEFAULT_TEXT_ALIGN,
      lineHeight: getLineHeight(DEFAULT_FONT_FAMILY),
    });
  });

  it("adapts roundness to what the target element supports", () => {
    const source = styledRect();
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    const arrow = API.createElement({ type: "arrow", id: "arrow" });
    loadScene([source, rect, arrow]);

    copyStylesFrom(source);
    pasteStylesTo(rect, arrow);

    expect(getElement("rect").roundness).toEqual({
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    });
    expect(getElement("arrow").roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
  });

  it("pastes sharp corners when the source has no roundness", () => {
    const source = styledRect({ roundness: null });
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    loadScene([source, rect]);

    copyStylesFrom(source);
    pasteStylesTo(rect);

    expect(getElement("rect").roundness).toBe(null);
  });

  it("copies arrowheads only between arrows", () => {
    const source = API.createElement({
      type: "arrow",
      id: "source",
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      startArrowhead: null,
      endArrowhead: "arrow",
    });
    const line = API.createElement({ type: "line", id: "line" });
    loadScene([source, arrow, line]);

    copyStylesFrom(source);
    pasteStylesTo(arrow, line);

    expect(getElement("arrow")).toMatchObject({
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
    expect(getElement("line")).toMatchObject({
      startArrowhead: null,
      endArrowhead: null,
    });
  });

  it("keeps frames transparent and sharp", () => {
    const source = styledRect();
    const frame = API.createElement({ type: "frame", id: "frame" });
    loadScene([source, frame]);

    copyStylesFrom(source);
    pasteStylesTo(frame);

    expect(getElement("frame")).toMatchObject({
      strokeColor: "#e03131",
      strokeStyle: "dotted",
      backgroundColor: "transparent",
      roundness: null,
    });
  });

  it("pastes via keyboard as a single undoable step", () => {
    const source = styledRect();
    const target = API.createElement({
      type: "rectangle",
      id: "target",
      strokeColor: "#1e1e1e",
    });
    loadScene([source, target]);

    API.setSelectedElements([getElement("source")]);
    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.C);
    });
    API.setSelectedElements([getElement("target")]);
    const undoStackSize = API.getUndoStack().length;
    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.V);
    });

    expect(getElement("target").strokeColor).toBe("#e03131");
    expect(API.getUndoStack().length).toBe(undoStackSize + 1);

    Keyboard.undo();
    expect(getElement("target").strokeColor).toBe("#1e1e1e");

    Keyboard.redo();
    expect(getElement("target").strokeColor).toBe("#e03131");
  });
});
