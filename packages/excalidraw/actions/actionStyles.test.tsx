import { fireEvent } from "@testing-library/react";

import { CODES, ROUNDNESS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import * as actionStyles from "./actionStyles";

const { actionCopyStyles, actionPasteStyles } = actionStyles;

const { h } = window;

const getElement = <T = ExcalidrawTextElement,>(id: string) =>
  h.elements.find((el) => el.id === id)! as unknown as T;

const copyStylesFrom = (
  element: Parameters<typeof API.setSelectedElements>[0][number],
) => {
  API.setSelectedElements([element]);
  API.executeAction(actionCopyStyles);
};

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  // must run first: relies on nothing having been copied yet
  it("pasteStyles is a no-op when no styles were copied", () => {
    expect(actionStyles.copiedStyles).toBe("{}");
    const r1 = API.createElement({
      type: "rectangle",
      id: "r1",
      strokeColor: "#000000",
    });
    API.setElements([r1]);
    API.setSelectedElements([r1]);

    API.executeAction(actionPasteStyles);

    expect(getElement("r1")).toBe(r1);
  });

  it("copyStyles does not overwrite copied styles when nothing is selected", () => {
    const r1 = API.createElement({ type: "rectangle", id: "r1" });
    API.setElements([r1]);
    copyStylesFrom(r1);
    const copied = actionStyles.copiedStyles;

    API.setSelectedElements([]);
    API.executeAction(actionCopyStyles);

    expect(actionStyles.copiedStyles).toBe(copied);
    expect(h.state.toast).toEqual({ message: "Copied styles." });
  });

  it("copyStyles copies a container together with its bound text", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      boundElements: [{ type: "text", id: "boundText" }],
    });
    const boundText = API.createElement({
      type: "text",
      id: "boundText",
      containerId: "container",
      fontSize: 36,
    });
    API.setElements([container, boundText]);

    copyStylesFrom(container);

    const copied = JSON.parse(actionStyles.copiedStyles);
    expect(copied).toHaveLength(2);
    expect(copied[0].id).toBe("container");
    expect(copied[1].id).toBe("boundText");
    expect(copied[1].fontSize).toBe(36);
  });

  it("pastes stroke/fill styles onto every selected element", () => {
    const source = API.createElement({
      type: "rectangle",
      id: "source",
      strokeColor: "#e03131",
      backgroundColor: "#ffc9c9",
      fillStyle: "cross-hatch",
      strokeWidth: 4,
      strokeStyle: "dashed",
      roughness: 2,
      opacity: 40,
    });
    const t1 = API.createElement({ type: "ellipse", id: "t1" });
    const t2 = API.createElement({ type: "diamond", id: "t2" });
    const untouched = API.createElement({ type: "ellipse", id: "untouched" });
    API.setElements([source, t1, t2, untouched]);
    copyStylesFrom(source);

    API.setSelectedElements([t1, t2]);
    API.executeAction(actionPasteStyles);

    for (const id of ["t1", "t2"]) {
      expect(getElement(id)).toEqual(
        expect.objectContaining({
          strokeColor: "#e03131",
          backgroundColor: "#ffc9c9",
          fillStyle: "cross-hatch",
          strokeWidth: 4,
          strokeStyle: "dashed",
          roughness: 2,
          opacity: 40,
        }),
      );
    }
    expect(getElement("untouched")).toBe(untouched);
  });

  it("keeps compatible roundness, falls back to the element default otherwise, and clears it when the source is sharp", () => {
    const roundRect = API.createElement({
      type: "rectangle",
      id: "roundRect",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const sharpRect = API.createElement({
      type: "rectangle",
      id: "sharpRect",
      roundness: null,
    });
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      roundness: null,
    });
    const diamond = API.createElement({
      type: "diamond",
      id: "diamond",
      roundness: null,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse",
      roundness: null,
    });
    API.setElements([roundRect, sharpRect, rect, diamond, ellipse]);

    copyStylesFrom(roundRect);
    API.setSelectedElements([rect, diamond, ellipse]);
    API.executeAction(actionPasteStyles);

    expect(getElement("rect").roundness).toEqual({
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    });
    expect(getElement("diamond").roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
    expect(getElement("ellipse").roundness).toBe(null);

    copyStylesFrom(getElement("sharpRect"));
    API.setSelectedElements([getElement("rect"), getElement("diamond")]);
    API.executeAction(actionPasteStyles);

    expect(getElement("rect").roundness).toBe(null);
    expect(getElement("diamond").roundness).toBe(null);
  });

  it("pastes font properties onto text elements", () => {
    const sourceText = API.createElement({
      type: "text",
      id: "sourceText",
      text: "source",
      fontSize: 48,
      fontFamily: 3,
      textAlign: "right",
    });
    const target = API.createElement({
      type: "text",
      id: "target",
      text: "target",
      fontSize: 20,
      fontFamily: 1,
      textAlign: "left",
    });
    API.setElements([sourceText, target]);
    API.updateElement(sourceText, {
      lineHeight: 1.5 as ExcalidrawTextElement["lineHeight"],
    });

    copyStylesFrom(sourceText);
    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);

    expect(getElement("target")).toEqual(
      expect.objectContaining({
        fontSize: 48,
        fontFamily: 3,
        textAlign: "right",
        lineHeight: 1.5,
        text: "target",
      }),
    );
  });

  it("uses default font properties when pasting non-text styles onto text", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      strokeColor: "#1971c2",
    });
    const target = API.createElement({
      type: "text",
      id: "target",
      text: "target",
      fontSize: 50,
      textAlign: "right",
    });
    API.setElements([rect, target]);

    copyStylesFrom(rect);
    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);

    const text = getElement("target");
    expect(text.strokeColor).toBe("#1971c2");
    expect(text.fontSize).toBe(20);
    expect(text.textAlign).toBe("left");
  });

  it("applies the copied bound-text styles to a target container's bound text", () => {
    const sourceContainer = API.createElement({
      type: "rectangle",
      id: "sourceContainer",
      backgroundColor: "#b2f2bb",
      boundElements: [{ type: "text", id: "sourceText" }],
    });
    const sourceText = API.createElement({
      type: "text",
      id: "sourceText",
      containerId: "sourceContainer",
      strokeColor: "#2f9e44",
      fontSize: 32,
    });
    const targetContainer = API.createElement({
      type: "rectangle",
      id: "targetContainer",
      x: 300,
      boundElements: [{ type: "text", id: "targetText" }],
    });
    const targetText = API.createElement({
      type: "text",
      id: "targetText",
      containerId: "targetContainer",
      strokeColor: "#000000",
      fontSize: 16,
    });
    API.setElements([sourceContainer, sourceText, targetContainer, targetText]);

    copyStylesFrom(sourceContainer);
    API.setSelectedElements([targetContainer]);
    API.executeAction(actionPasteStyles);

    expect(getElement("targetContainer").backgroundColor).toBe("#b2f2bb");
    expect(getElement("targetText").strokeColor).toBe("#2f9e44");
    expect(getElement("targetText").fontSize).toBe(32);
  });

  it("leaves a target's bound text untouched when the copied element had no bound text", () => {
    const source = API.createElement({
      type: "ellipse",
      id: "source",
      backgroundColor: "#a5d8ff",
    });
    const targetContainer = API.createElement({
      type: "rectangle",
      id: "targetContainer",
      boundElements: [{ type: "text", id: "targetText" }],
    });
    const targetText = API.createElement({
      type: "text",
      id: "targetText",
      containerId: "targetContainer",
      strokeColor: "#000000",
    });
    API.setElements([source, targetContainer, targetText]);

    copyStylesFrom(source);
    API.setSelectedElements([targetContainer]);
    API.executeAction(actionPasteStyles);

    expect(getElement("targetContainer").backgroundColor).toBe("#a5d8ff");
    expect(getElement("targetText")).toBe(targetText);
  });

  it("copies arrowheads only between arrows", () => {
    const sourceArrow = API.createElement({
      type: "arrow",
      id: "sourceArrow",
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
    const targetArrow = API.createElement({
      type: "arrow",
      id: "targetArrow",
      startArrowhead: null,
      endArrowhead: "arrow",
    });
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    API.setElements([sourceArrow, targetArrow, rect]);

    copyStylesFrom(sourceArrow);
    API.setSelectedElements([targetArrow]);
    API.executeAction(actionPasteStyles);

    const arrow = getElement<ExcalidrawArrowElement>("targetArrow");
    expect(arrow.startArrowhead).toBe("circle");
    expect(arrow.endArrowhead).toBe("triangle");

    copyStylesFrom(getElement("rect"));
    API.setSelectedElements([getElement("targetArrow")]);
    API.executeAction(actionPasteStyles);

    const arrowAfterRect = getElement<ExcalidrawArrowElement>("targetArrow");
    expect(arrowAfterRect.startArrowhead).toBe("circle");
    expect(arrowAfterRect.endArrowhead).toBe("triangle");
  });

  it("keeps frames sharp and transparent", () => {
    const source = API.createElement({
      type: "rectangle",
      id: "source",
      backgroundColor: "#ffec99",
      strokeColor: "#f08c00",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const frame = API.createElement({ type: "frame", id: "frame" });
    API.setElements([source, frame]);

    copyStylesFrom(source);
    API.setSelectedElements([frame]);
    API.executeAction(actionPasteStyles);

    expect(getElement("frame").strokeColor).toBe("#f08c00");
    expect(getElement("frame").backgroundColor).toBe("transparent");
    expect(getElement("frame").roundness).toBe(null);
  });

  it("maps Ctrl+Alt+C / Ctrl+Alt+V (by key code) to copy/paste styles", () => {
    const source = API.createElement({
      type: "rectangle",
      id: "source",
      strokeColor: "#9c36b5",
    });
    const target = API.createElement({ type: "ellipse", id: "target" });
    API.setElements([source, target]);

    API.setSelectedElements([source]);
    fireEvent.keyDown(document, { ctrlKey: true, altKey: true, code: CODES.C });
    expect(JSON.parse(actionStyles.copiedStyles)[0].id).toBe("source");

    API.setSelectedElements([target]);
    fireEvent.keyDown(document, { ctrlKey: true, altKey: true, code: CODES.V });
    expect(getElement("target").strokeColor).toBe("#9c36b5");

    expect(
      actionCopyStyles.keyTest!(
        new KeyboardEvent("keydown", { altKey: true, code: CODES.C }),
      ),
    ).toBe(false);
    expect(
      actionPasteStyles.keyTest!(
        new KeyboardEvent("keydown", { ctrlKey: true, code: CODES.V }),
      ),
    ).toBe(false);
  });

  it("records a single undo entry for pasting styles", () => {
    const source = API.createElement({
      type: "rectangle",
      id: "source",
      strokeColor: "#e8590c",
    });
    const target = API.createElement({
      type: "ellipse",
      id: "target",
      strokeColor: "#000000",
    });
    API.updateScene({
      elements: [source, target],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    copyStylesFrom(source);
    API.setSelectedElements([getElement("target")]);
    const undoStackSize = API.getUndoStack().length;

    API.executeAction(actionPasteStyles);
    expect(getElement("target").strokeColor).toBe("#e8590c");
    expect(API.getUndoStack().length).toBe(undoStackSize + 1);

    Keyboard.undo();
    expect(getElement("target").strokeColor).toBe("#000000");

    Keyboard.redo();
    expect(getElement("target").strokeColor).toBe("#e8590c");
  });
});
