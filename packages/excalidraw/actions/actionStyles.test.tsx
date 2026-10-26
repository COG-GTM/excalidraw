import { fireEvent } from "@testing-library/react";

import { CODES, FONT_FAMILY, ROUNDNESS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionCopyStyles, actionPasteStyles } from "./actionStyles";

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

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("keyTest", () => {
    it("maps Ctrl+Alt+C to copyStyles and Ctrl+Alt+V to pasteStyles", () => {
      expect(
        actionCopyStyles.keyTest!(
          keyEvent({ ctrlKey: true, altKey: true, code: CODES.C }),
        ),
      ).toBe(true);
      expect(
        actionPasteStyles.keyTest!(
          keyEvent({ ctrlKey: true, altKey: true, code: CODES.V }),
        ),
      ).toBe(true);
    });

    it("does not match without both modifiers", () => {
      expect(
        actionCopyStyles.keyTest!(keyEvent({ ctrlKey: true, code: CODES.C })),
      ).toBe(false);
      expect(
        actionPasteStyles.keyTest!(keyEvent({ altKey: true, code: CODES.V })),
      ).toBe(false);
      expect(
        actionCopyStyles.keyTest!(
          keyEvent({ ctrlKey: true, altKey: true, code: CODES.V }),
        ),
      ).toBe(false);
    });
  });

  it("copies the selected element's styles and pastes them onto another element", () => {
    const source = API.createElement({
      id: "source",
      strokeColor: "#e03131",
      backgroundColor: "#ffc9c9",
      fillStyle: "cross-hatch",
      strokeWidth: 4,
      strokeStyle: "dashed",
      roughness: 2,
      opacity: 60,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const target = API.createElement({ id: "target", type: "diamond", x: 200 });
    API.setElements([source, target]);

    API.setSelectedElements([source]);
    API.executeAction(actionCopyStyles);
    expect(h.state.toast?.message).toBe("Copied styles.");

    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(target)).toMatchObject({
      strokeColor: "#e03131",
      backgroundColor: "#ffc9c9",
      fillStyle: "cross-hatch",
      strokeWidth: 4,
      strokeStyle: "dashed",
      roughness: 2,
      opacity: 60,
    });
    // diamonds don't support adaptive radius → falls back to their default
    expect(API.getElement(target).roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
  });

  it("keeps a compatible roundness and clears it when the source is sharp", () => {
    const rounded = API.createElement({
      id: "rounded",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const sharp = API.createElement({ id: "sharp", roundness: null, x: 200 });
    const target = API.createElement({
      id: "target",
      x: 400,
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    });
    API.setElements([rounded, sharp, target]);

    API.setSelectedElements([rounded]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);
    expect(API.getElement(target).roundness).toEqual({
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    });

    API.setSelectedElements([sharp]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);
    expect(API.getElement(target).roundness).toBe(null);
  });

  it("copies text properties onto text elements", () => {
    const sourceText = API.createElement({
      type: "text",
      id: "sourceText",
      text: "source",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
      strokeColor: "#1971c2",
    });
    const targetText = API.createElement({
      type: "text",
      id: "targetText",
      text: "target",
      x: 300,
      fontSize: 20,
      fontFamily: FONT_FAMILY.Excalifont,
      textAlign: "left",
    });
    API.setElements([sourceText, targetText]);

    API.setSelectedElements([sourceText]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([targetText]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(targetText)).toMatchObject({
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
      strokeColor: "#1971c2",
    });
  });

  it("falls back to default text props when pasting a shape's style onto text", () => {
    const shape = API.createElement({ id: "shape", strokeColor: "#2f9e44" });
    const text = API.createElement({
      type: "text",
      id: "text",
      text: "hello",
      x: 300,
      fontSize: 40,
      textAlign: "right",
    });
    API.setElements([shape, text]);

    API.setSelectedElements([shape]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([text]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(text)).toMatchObject({
      strokeColor: "#2f9e44",
      fontSize: 20,
      textAlign: "left",
    });
  });

  it("applies the bound text's styles to the target container's bound text", () => {
    const sourceContainer = API.createElement({
      id: "sourceContainer",
      backgroundColor: "#a5d8ff",
      boundElements: [{ id: "sourceLabel", type: "text" }],
    });
    const sourceLabel = API.createElement({
      type: "text",
      id: "sourceLabel",
      text: "src",
      containerId: "sourceContainer",
      fontSize: 28,
      strokeColor: "#f08c00",
    });
    const targetContainer = API.createElement({
      id: "targetContainer",
      x: 300,
      boundElements: [{ id: "targetLabel", type: "text" }],
    });
    const targetLabel = API.createElement({
      type: "text",
      id: "targetLabel",
      text: "dst",
      containerId: "targetContainer",
      fontSize: 16,
    });
    API.setElements([
      sourceContainer,
      sourceLabel,
      targetContainer,
      targetLabel,
    ]);

    API.setSelectedElements([sourceContainer]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([targetContainer]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(targetContainer).backgroundColor).toBe("#a5d8ff");
    expect(API.getElement(targetLabel)).toMatchObject({
      fontSize: 28,
      strokeColor: "#f08c00",
    });
  });

  it("leaves bound text untouched when the copied element had no bound text", () => {
    const plain = API.createElement({ id: "plain", strokeColor: "#9c36b5" });
    const container = API.createElement({
      id: "container",
      x: 300,
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "label",
      containerId: "container",
      strokeColor: "#1e1e1e",
    });
    API.setElements([plain, container, label]);

    API.setSelectedElements([plain]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([container]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(container).strokeColor).toBe("#9c36b5");
    expect(API.getElement(label).strokeColor).toBe("#1e1e1e");
  });

  it("copies arrowheads between arrows", () => {
    const sourceArrow = API.createElement({
      type: "arrow",
      id: "sourceArrow",
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
    const targetArrow = API.createElement({
      type: "arrow",
      id: "targetArrow",
      x: 300,
      startArrowhead: null,
      endArrowhead: "arrow",
    });
    API.setElements([sourceArrow, targetArrow]);

    API.setSelectedElements([sourceArrow]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([targetArrow]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(targetArrow)).toMatchObject({
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
  });

  it("never gives frames a background or roundness", () => {
    const source = API.createElement({
      id: "source",
      backgroundColor: "#ffec99",
      strokeColor: "#e8590c",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const frame = API.createElement({ type: "frame", id: "frame", x: 300 });
    API.setElements([source, frame]);

    API.setSelectedElements([source]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([frame]);
    API.executeAction(actionPasteStyles);

    expect(API.getElement(frame)).toMatchObject({
      strokeColor: "#e8590c",
      backgroundColor: "transparent",
      roundness: null,
    });
  });

  it("does not overwrite copied styles when nothing is selected", () => {
    const source = API.createElement({ id: "source", strokeColor: "#c2255c" });
    const target = API.createElement({ id: "target", x: 300 });
    API.setElements([source, target]);

    API.setSelectedElements([source]);
    API.executeAction(actionCopyStyles);

    API.clearSelection();
    API.executeAction(actionCopyStyles);

    API.setSelectedElements([target]);
    API.executeAction(actionPasteStyles);
    expect(API.getElement(target).strokeColor).toBe("#c2255c");
  });

  it("pasting records a single undo entry that restores the previous styles", () => {
    const source = API.createElement({ id: "source", strokeColor: "#e03131" });
    const target = API.createElement({
      id: "target",
      x: 300,
      strokeColor: "#1e1e1e",
    });
    API.updateScene({
      elements: [source, target],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.setSelectedElements([source]);
    API.executeAction(actionCopyStyles);
    API.setSelectedElements([target]);
    const undoStackSize = API.getUndoStack().length;
    API.executeAction(actionPasteStyles);

    expect(API.getUndoStack().length).toBe(undoStackSize + 1);
    expect(API.getElement(target).strokeColor).toBe("#e03131");

    Keyboard.undo();
    expect(API.getElement(target).strokeColor).toBe("#1e1e1e");

    Keyboard.redo();
    expect(API.getElement(target).strokeColor).toBe("#e03131");
  });

  it("copies and pastes via keyboard shortcuts", () => {
    const source = API.createElement({ id: "source", strokeColor: "#099268" });
    const target = API.createElement({ id: "target", x: 300 });
    API.setElements([source, target]);

    API.setSelectedElements([source]);
    fireEvent.keyDown(h.app.ownerDocument, {
      ctrlKey: true,
      altKey: true,
      code: CODES.C,
    });

    API.setSelectedElements([target]);
    fireEvent.keyDown(h.app.ownerDocument, {
      ctrlKey: true,
      altKey: true,
      code: CODES.V,
    });

    expect(API.getElement(target).strokeColor).toBe("#099268");
  });
});
