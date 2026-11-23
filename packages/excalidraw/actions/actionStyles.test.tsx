import { fireEvent } from "@testing-library/react";

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
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  actionCopyStyles,
  actionPasteStyles,
  copiedStyles,
} from "./actionStyles";

const { h } = window;

const elements = () => h.app.scene.getElementsIncludingDeleted();

const getElement = <T extends ExcalidrawElement = ExcalidrawElement>(
  id: string,
) => h.elements.find((el) => el.id === id)! as T;

const copyFrom = (element: ExcalidrawElement) => {
  API.setSelectedElements([getElement(element.id)]);
  API.executeAction(actionCopyStyles);
};

const pasteTo = (...elements: ExcalidrawElement[]) => {
  API.setSelectedElements(elements.map((el) => getElement(el.id)));
  API.executeAction(actionPasteStyles);
};

const styledRect = (id: string) =>
  API.createElement({
    type: "rectangle",
    id,
    strokeColor: "#e03131",
    backgroundColor: "#a5d8ff",
    fillStyle: "cross-hatch",
    strokeWidth: 4,
    strokeStyle: "dashed",
    roughness: 2,
    opacity: 40,
    roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
  });

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  // must run first: `copiedStyles` is module state shared across tests
  it("pasting before anything was copied leaves elements unchanged", () => {
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    const result = actionPasteStyles.perform(elements(), h.state, null, h.app);

    expect(copiedStyles).toBe("{}");
    expect(result).toEqual({
      elements: h.elements,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  });

  it("copying without a selection keeps the previous copied styles", () => {
    API.setElements([API.createElement({ type: "rectangle" })]);
    API.setSelectedElements([]);

    API.executeAction(actionCopyStyles);

    expect(copiedStyles).toBe("{}");
    expect(h.state.toast?.message).toBe(t("toast.copyStyles"));
  });

  it("copies the bound text of a container alongside the container", () => {
    const [container, text] = API.createTextContainer();
    API.setElements([container, text]);

    copyFrom(container);

    const copied = JSON.parse(copiedStyles);
    expect(copied.map((el: ExcalidrawElement) => el.id)).toEqual([
      container.id,
      text.id,
    ]);
    expect(h.state.toast?.message).toBe(t("toast.copyStyles"));
  });

  it("pastes stroke, fill, opacity, roughness and roundness onto selected elements", () => {
    const source = styledRect("source");
    const target = API.createElement({ type: "rectangle", id: "target" });
    const other = API.createElement({ type: "rectangle", id: "other" });
    API.setElements([source, target, other]);

    copyFrom(source);
    pasteTo(target);

    expect(getElement("target")).toMatchObject({
      strokeColor: "#e03131",
      backgroundColor: "#a5d8ff",
      fillStyle: "cross-hatch",
      strokeWidth: 4,
      strokeStyle: "dashed",
      roughness: 2,
      opacity: 40,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    expect(getElement("other").strokeColor).toBe(other.strokeColor);
  });

  it("maps roundness to the target type or clears it", () => {
    const source = styledRect("source");
    const diamond = API.createElement({
      type: "diamond",
      id: "diamond",
      roundness: null,
    });
    const ellipse = API.createElement({ type: "ellipse", id: "ellipse" });
    const sharp = API.createElement({
      type: "rectangle",
      id: "sharp",
      roundness: null,
    });
    const rounded = API.createElement({
      type: "rectangle",
      id: "rounded",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    API.setElements([source, diamond, ellipse, sharp, rounded]);

    copyFrom(source);
    pasteTo(diamond, ellipse);
    expect(getElement("diamond").roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
    expect(getElement("ellipse").roundness).toBe(null);

    copyFrom(sharp);
    pasteTo(rounded);
    expect(getElement("rounded").roundness).toBe(null);
  });

  it("pastes font properties between text elements", () => {
    const source = API.createElement({
      type: "text",
      id: "source",
      text: "source",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
    });
    const target = API.createElement({
      type: "text",
      id: "target",
      text: "target",
    });
    API.setElements([source, target]);

    copyFrom(source);
    pasteTo(target);

    expect(getElement<ExcalidrawTextElement>("target")).toMatchObject({
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
      lineHeight: source.lineHeight,
    });
  });

  it("falls back to default font properties when the source is not text", () => {
    const source = styledRect("source");
    const target = API.createElement({
      type: "text",
      id: "target",
      text: "target",
      fontSize: 50,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
    });
    API.setElements([source, target]);

    copyFrom(source);
    pasteTo(target);

    expect(getElement<ExcalidrawTextElement>("target")).toMatchObject({
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: DEFAULT_FONT_FAMILY,
      textAlign: DEFAULT_TEXT_ALIGN,
      lineHeight: getLineHeight(DEFAULT_FONT_FAMILY),
      strokeColor: "#e03131",
    });
  });

  it("styles bound text from the copied bound text, or leaves it alone if none was copied", () => {
    const [sourceContainer, sourceText] = API.createTextContainer();
    const [targetContainer, targetText] = API.createTextContainer();
    const plain = styledRect("plain");
    API.setElements([
      sourceContainer,
      {
        ...(sourceText as ExcalidrawTextElement),
        strokeColor: "#2f9e44",
        fontSize: 40,
      },
      targetContainer,
      targetText,
      plain,
    ]);

    copyFrom(sourceContainer);
    pasteTo(targetContainer);

    expect(getElement<ExcalidrawTextElement>(targetText.id)).toMatchObject({
      strokeColor: "#2f9e44",
      fontSize: 40,
    });

    copyFrom(plain);
    pasteTo(targetContainer);

    expect(getElement(targetContainer.id).strokeColor).toBe("#e03131");
    expect(getElement<ExcalidrawTextElement>(targetText.id)).toMatchObject({
      strokeColor: "#2f9e44",
      fontSize: 40,
    });
  });

  it("pastes arrowheads only between arrows", () => {
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
    API.setElements([source, arrow, line]);

    copyFrom(source);
    pasteTo(arrow, line);

    expect(getElement<ExcalidrawArrowElement>("arrow")).toMatchObject({
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
    expect(getElement("line")).not.toHaveProperty("startArrowhead", "circle");
  });

  it("never gives frames a background or roundness", () => {
    const source = styledRect("source");
    const frame = API.createElement({ type: "frame", id: "frame" });
    API.setElements([source, frame]);

    copyFrom(source);
    pasteTo(frame);

    expect(getElement("frame")).toMatchObject({
      strokeColor: "#e03131",
      backgroundColor: "transparent",
      roundness: null,
    });
  });

  it("maps Ctrl+Alt+C / Ctrl+Alt+V by event code", () => {
    const event = (code: string, alt = true) =>
      new KeyboardEvent("keydown", { code, ctrlKey: true, altKey: alt });

    expect(actionCopyStyles.keyTest!(event(CODES.C))).toBe(true);
    expect(actionCopyStyles.keyTest!(event(CODES.C, false))).toBe(false);
    expect(actionCopyStyles.keyTest!(event(CODES.V))).toBe(false);
    expect(actionPasteStyles.keyTest!(event(CODES.V))).toBe(true);
    expect(actionPasteStyles.keyTest!(event(CODES.V, false))).toBe(false);
  });

  it("records pasting as one undoable step", async () => {
    const source = styledRect("source");
    const target = API.createElement({ type: "rectangle", id: "target" });
    API.updateScene({
      elements: [source, target],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    copyFrom(source);
    API.setSelectedElements([getElement("target")]);
    fireEvent.keyDown(document, {
      code: CODES.V,
      ctrlKey: true,
      altKey: true,
    });
    expect(getElement("target").strokeColor).toBe("#e03131");

    await act(async () => {
      Keyboard.undo();
    });
    expect(getElement("target").strokeColor).toBe(target.strokeColor);
    expect(getElement("target").isDeleted).toBe(false);

    await act(async () => {
      Keyboard.redo();
    });
    expect(getElement("target").strokeColor).toBe("#e03131");
  });
});
