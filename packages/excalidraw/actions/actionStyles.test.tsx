import React from "react";

import { CODES, ROUNDNESS } from "@excalidraw/common";

import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import {
  actionCopyStyles,
  actionPasteStyles,
  copiedStyles,
} from "./actionStyles";

const { h } = window;

const copyStylesFrom = (element: NonDeletedExcalidrawElement) => {
  API.setSelectedElements([element]);
  API.executeAction(actionCopyStyles);
};

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("pasteStyles is a no-op when nothing has been copied", () => {
    expect(copiedStyles).toBe("{}");
    const rect = API.createElement({
      type: "rectangle",
      strokeColor: "#000000",
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    API.executeAction(actionPasteStyles);

    expect(API.getElement(rect)).toBe(rect);
  });

  it("copyStyles does not overwrite copied styles when nothing is selected", () => {
    const source = API.createElement({
      type: "rectangle",
      strokeColor: "#e03131",
    });
    API.setElements([source]);
    copyStylesFrom(source);
    const previous = copiedStyles;

    API.clearSelection();
    API.executeAction(actionCopyStyles);

    expect(copiedStyles).toBe(previous);
    expect(h.state.toast).toEqual({ message: "Copied styles." });
  });

  it("copyStyles includes the bound text of a container", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "label",
      containerId: container.id,
      fontSize: 36,
    });
    API.setElements([container, label]);

    copyStylesFrom(container);

    const parsed = JSON.parse(copiedStyles);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe(container.id);
    expect(parsed[1].id).toBe(label.id);
    expect(parsed[1].fontSize).toBe(36);
  });

  it("pastes container and bound text styles onto another container", () => {
    const source = API.createElement({
      type: "rectangle",
      id: "source",
      strokeColor: "#e03131",
      backgroundColor: "#a5d8ff",
      boundElements: [{ id: "sourceLabel", type: "text" }],
    });
    const sourceLabel = API.createElement({
      type: "text",
      id: "sourceLabel",
      text: "src",
      containerId: source.id,
      fontSize: 36,
      fontFamily: 3,
      textAlign: "left",
      strokeColor: "#2f9e44",
    });
    const target = API.createElement({
      type: "rectangle",
      id: "target",
      boundElements: [{ id: "targetLabel", type: "text" }],
    });
    const targetLabel = API.createElement({
      type: "text",
      id: "targetLabel",
      text: "dst",
      containerId: target.id,
      fontSize: 20,
    });
    API.setElements([source, sourceLabel, target, targetLabel]);
    copyStylesFrom(source);

    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(target)).toMatchObject({
      strokeColor: "#e03131",
      backgroundColor: "#a5d8ff",
    });
    expect(API.getElement(targetLabel)).toMatchObject({
      strokeColor: "#2f9e44",
      fontSize: 36,
      fontFamily: 3,
      textAlign: "left",
    });
  });

  it("leaves bound text unchanged when the copied element had no bound text", () => {
    const source = API.createElement({
      type: "rectangle",
      strokeColor: "#e03131",
    });
    const target = API.createElement({
      type: "rectangle",
      id: "target",
      boundElements: [{ id: "targetLabel", type: "text" }],
    });
    const targetLabel = API.createElement({
      type: "text",
      id: "targetLabel",
      text: "dst",
      containerId: target.id,
      strokeColor: "#1e1e1e",
      fontSize: 20,
    });
    API.setElements([source, target, targetLabel]);
    copyStylesFrom(source);

    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(target).strokeColor).toBe("#e03131");
    expect(API.getElement(targetLabel)).toBe(targetLabel);
  });

  it("applies text styles from a text element, falling back to defaults", () => {
    const sourceText = API.createElement({
      type: "text",
      text: "src",
      fontSize: 48,
      fontFamily: 2,
      textAlign: "right",
    });
    const targetText = API.createElement({
      type: "text",
      text: "dst",
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
    });
    const sourceRect = API.createElement({ type: "rectangle" });
    API.setElements([sourceText, targetText, sourceRect]);

    copyStylesFrom(sourceText);
    API.setSelectedElements([targetText]);
    API.executeAction(actionPasteStyles);
    expect(API.getElement(targetText)).toMatchObject({
      fontSize: 48,
      fontFamily: 2,
      textAlign: "right",
    });

    // pasting a non-text element's styles onto text falls back to defaults
    copyStylesFrom(sourceRect);
    API.setSelectedElements([API.getElement(targetText)]);
    API.executeAction(actionPasteStyles);
    const updated = API.getElement(targetText) as ExcalidrawTextElement;
    expect(updated.fontSize).toBe(20);
    expect(updated.textAlign).toBe("left");
    expect(updated.lineHeight).toBeGreaterThan(0);
  });

  it("copies arrowheads only between arrows", () => {
    const sourceArrow = API.createElement({
      type: "arrow",
      startArrowhead: "circle",
      endArrowhead: "triangle",
      strokeColor: "#e03131",
    });
    const targetArrow = API.createElement({
      type: "arrow",
      startArrowhead: null,
      endArrowhead: "arrow",
    });
    const targetLine = API.createElement({ type: "line" });
    API.setElements([sourceArrow, targetArrow, targetLine]);
    copyStylesFrom(sourceArrow);

    API.setSelectedElements([targetArrow, targetLine]);
    API.executeAction(actionPasteStyles);

    const arrow = API.getElement(targetArrow) as ExcalidrawArrowElement;
    expect(arrow.startArrowhead).toBe("circle");
    expect(arrow.endArrowhead).toBe("triangle");
    expect(arrow.strokeColor).toBe("#e03131");
    expect(API.getElement(targetLine).strokeColor).toBe("#e03131");
    const line = API.getElement(targetLine) as ExcalidrawArrowElement;
    expect(line.startArrowhead).toBe(targetLine.startArrowhead);
    expect(line.endArrowhead).toBe(targetLine.endArrowhead);
  });

  it("applies compatible roundness and falls back to the default type", () => {
    const roundRect = API.createElement({
      type: "rectangle",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const sharpRect = API.createElement({ type: "rectangle", roundness: null });
    const line = API.createElement({ type: "line", roundness: null });
    const otherSharpRect = API.createElement({
      type: "rectangle",
      roundness: null,
    });
    API.setElements([roundRect, sharpRect, line, otherSharpRect]);

    copyStylesFrom(roundRect);
    API.setSelectedElements([sharpRect, line]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(sharpRect).roundness).toEqual({
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    });
    // ADAPTIVE_RADIUS isn't applicable to lines -> default for lines
    expect(API.getElement(line).roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });

    copyStylesFrom(otherSharpRect);
    API.setSelectedElements([API.getElement(sharpRect)]);
    API.executeAction(actionPasteStyles);
    expect(API.getElement(sharpRect).roundness).toBe(null);
  });

  it("keeps frames sharp and transparent", () => {
    const source = API.createElement({
      type: "rectangle",
      backgroundColor: "#ffc9c9",
      strokeColor: "#e03131",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const frame = API.createElement({ type: "frame" });
    API.setElements([source, frame]);
    copyStylesFrom(source);

    API.setSelectedElements([frame]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(frame)).toMatchObject({
      backgroundColor: "transparent",
      roundness: null,
      strokeColor: "#e03131",
    });
  });

  it("matches the copy/paste styles shortcuts", () => {
    const event = (code: string, opts: Partial<KeyboardEvent> = {}) =>
      ({
        ctrlKey: true,
        metaKey: false,
        altKey: true,
        shiftKey: false,
        code,
        ...opts,
      } as KeyboardEvent);

    expect(actionCopyStyles.keyTest!(event(CODES.C))).toBe(true);
    expect(actionCopyStyles.keyTest!(event(CODES.C, { altKey: false }))).toBe(
      false,
    );
    expect(actionCopyStyles.keyTest!(event(CODES.V))).toBe(false);
    expect(actionPasteStyles.keyTest!(event(CODES.V))).toBe(true);
    expect(actionPasteStyles.keyTest!(event(CODES.V, { ctrlKey: false }))).toBe(
      false,
    );
  });
});
