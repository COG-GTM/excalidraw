import React from "react";
import { vi } from "vitest";

import {
  CODES,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
  ROUNDNESS,
  STROKE_WIDTH,
  getLineHeight,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  actionCopyStyles,
  actionPasteStyles,
  copiedStyles,
} from "../actions/actionStyles";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  togglePopover,
} from "../tests/test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    // affects node v16+
    await act(async () => {});
  });

  it("should copy & paste styles via keyboard", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    // Change some styles of second rectangle
    togglePopover("Stroke");
    UI.clickOnTestId("color-red");
    togglePopover("Background");
    UI.clickOnTestId("color-blue");
    // Fill style
    fireEvent.click(screen.getByTitle("Cross-hatch"));
    // Stroke width
    fireEvent.click(screen.getByTitle("Bold"));
    // Stroke style
    fireEvent.click(screen.getByTitle("Dotted"));
    // Roughness
    fireEvent.click(screen.getByTitle("Cartoonist"));
    // Opacity
    fireEvent.change(screen.getByTestId("opacity"), {
      target: { value: "60" },
    });

    mouse.reset();

    API.setSelectedElements([h.elements[1]] as NonDeletedExcalidrawElement[]);

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.C);
    });
    const secondRect = JSON.parse(copiedStyles)[0];
    expect(secondRect.id).toBe(h.elements[1].id);

    mouse.reset();
    // Paste styles to first rectangle
    API.setSelectedElements([h.elements[0]] as NonDeletedExcalidrawElement[]);
    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.V);
    });

    const firstRect = API.getSelectedElement();
    expect(firstRect.id).toBe(h.elements[0].id);
    expect(firstRect.strokeColor).toBe("#e03131");
    expect(firstRect.backgroundColor).toBe("#a5d8ff");
    expect(firstRect.fillStyle).toBe("cross-hatch");
    expect(firstRect.strokeWidth).toBe(STROKE_WIDTH.bold);
    expect(firstRect.strokeStyle).toBe("dotted");
    expect(firstRect.roughness).toBe(2); // Cartoonist: 2
    expect(firstRect.opacity).toBe(60);
  });
});

describe("actionStyles (programmatic)", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const getById = (id: string) => h.elements.find((el) => el.id === id)!;

  const copyFrom = (element: NonDeletedExcalidrawElement) => {
    API.setSelectedElements([element]);
    API.executeAction(actionCopyStyles);
  };

  const pasteTo = (...elements: NonDeletedExcalidrawElement[]) => {
    API.setSelectedElements(elements);
    API.executeAction(actionPasteStyles);
  };

  it("pasting before anything was copied leaves elements unchanged", async () => {
    vi.resetModules();
    const { actionPasteStyles: freshPasteStyles } = await import(
      "../actions/actionStyles"
    );
    const rect = API.createElement({ id: "rect" });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    const result = freshPasteStyles.perform(
      h.app.scene.getElementsIncludingDeleted(),
      h.state,
      null,
      h.app,
    );

    expect(result).toEqual({
      elements: h.elements,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  });

  it("keyTests match Ctrl/Cmd+Alt+C and Ctrl/Cmd+Alt+V by code", () => {
    const event = (init: KeyboardEventInit) =>
      new KeyboardEvent("keydown", init);

    expect(
      actionCopyStyles.keyTest!(
        event({ ctrlKey: true, altKey: true, code: CODES.C }),
      ),
    ).toBe(true);
    expect(
      actionCopyStyles.keyTest!(event({ ctrlKey: true, code: CODES.C })),
    ).toBe(false);
    expect(
      actionPasteStyles.keyTest!(
        event({ ctrlKey: true, altKey: true, code: CODES.V }),
      ),
    ).toBe(true);
    expect(
      actionPasteStyles.keyTest!(event({ altKey: true, code: CODES.V })),
    ).toBe(false);
  });

  it("copying shows a toast; copying with no selection keeps the previous styles", () => {
    const rect = API.createElement({ id: "rect", strokeColor: "#e03131" });
    API.setElements([rect]);
    copyFrom(rect);
    expect(h.state.toast?.message).toBe("Copied styles.");
    const previous = copiedStyles;
    expect(JSON.parse(previous)[0].id).toBe("rect");

    API.setSelectedElements([]);
    API.executeAction(actionCopyStyles);
    expect(copiedStyles).toBe(previous);
  });

  it("pasting creates a single undo entry that undo reverts", () => {
    const source = API.createElement({
      id: "source",
      strokeColor: "#e03131",
      opacity: 40,
    });
    const target = API.createElement({ id: "target", x: 200 });
    API.updateScene({
      elements: [source, target],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    copyFrom(source);
    const undoStackSize = API.getUndoStack().length;

    pasteTo(target);
    expect(API.getUndoStack().length).toBe(undoStackSize + 1);
    expect(getById("target")).toMatchObject({
      strokeColor: "#e03131",
      opacity: 40,
    });

    Keyboard.undo();
    expect(getById("target")).toMatchObject({
      strokeColor: target.strokeColor,
      opacity: target.opacity,
    });
  });

  it("keeps compatible roundness and falls back to the target's default otherwise", () => {
    const source = API.createElement({
      id: "source",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const rect = API.createElement({ id: "rect", x: 200, roundness: null });
    const diamond = API.createElement({
      id: "diamond",
      type: "diamond",
      x: 400,
      roundness: null,
    });
    API.setElements([source, rect, diamond]);
    copyFrom(source);

    pasteTo(rect, diamond);

    expect(getById("rect").roundness).toEqual({
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    });
    expect(getById("diamond").roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
  });

  it("removes roundness when the source has none", () => {
    const source = API.createElement({ id: "source", roundness: null });
    const target = API.createElement({
      id: "target",
      x: 200,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    API.setElements([source, target]);
    copyFrom(source);

    pasteTo(target);

    expect(getById("target").roundness).toBe(null);
  });

  it("copies font properties between text elements", () => {
    const source = API.createElement({
      id: "source",
      type: "text",
      text: "source",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
    });
    const target = API.createElement({
      id: "target",
      type: "text",
      text: "target",
      x: 300,
      fontSize: 16,
      fontFamily: FONT_FAMILY.Virgil,
      textAlign: "left",
    });
    API.setElements([source, target]);
    copyFrom(source);

    pasteTo(target);

    expect(getById("target")).toMatchObject({
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      textAlign: "right",
      lineHeight: source.lineHeight,
    });
  });

  it("applies default font properties to text when the source is not text", () => {
    const source = API.createElement({ id: "source", strokeColor: "#e03131" });
    const target = API.createElement({
      id: "target",
      type: "text",
      text: "target",
      x: 300,
      fontSize: 40,
      fontFamily: FONT_FAMILY.Virgil,
      textAlign: "center",
    });
    API.setElements([source, target]);
    copyFrom(source);

    pasteTo(target);

    expect(getById("target")).toMatchObject({
      strokeColor: "#e03131",
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: FONT_FAMILY.Excalifont,
      textAlign: "left",
      lineHeight: getLineHeight(FONT_FAMILY.Excalifont),
    });
  });

  it("copies container styles to containers and label styles to bound text", () => {
    const [sourceContainer, sourceLabel] = API.createTextContainer();
    const [targetContainer, targetLabel] = API.createTextContainer();
    API.setElements([
      sourceContainer,
      sourceLabel,
      targetContainer,
      targetLabel,
    ]);
    API.updateElement(sourceContainer, { strokeColor: "#1971c2" });
    API.updateElement(sourceLabel as ExcalidrawTextElement, {
      strokeColor: "#e03131",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
    });
    copyFrom(getById(sourceContainer.id) as NonDeletedExcalidrawElement);
    expect(JSON.parse(copiedStyles).map((el: any) => el.id)).toEqual([
      sourceContainer.id,
      sourceLabel.id,
    ]);

    pasteTo(getById(targetContainer.id) as NonDeletedExcalidrawElement);

    expect(getById(targetContainer.id).strokeColor).toBe("#1971c2");
    expect(getById(targetLabel.id)).toMatchObject({
      strokeColor: "#e03131",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
    });
  });

  it("leaves bound text untouched when the copied element had no label", () => {
    const source = API.createElement({ id: "source", strokeColor: "#e03131" });
    const [targetContainer, targetLabel] = API.createTextContainer();
    API.setElements([source, targetContainer, targetLabel]);
    copyFrom(source);
    const labelBefore = getById(targetLabel.id);

    pasteTo(getById(targetContainer.id) as NonDeletedExcalidrawElement);

    expect(getById(targetContainer.id).strokeColor).toBe("#e03131");
    expect(getById(targetLabel.id)).toBe(labelBefore);
  });

  it("copies arrowheads only between arrows", () => {
    const source = API.createElement({
      id: "source",
      type: "arrow",
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
    const targetArrow = API.createElement({
      id: "targetArrow",
      type: "arrow",
      x: 300,
      startArrowhead: null,
      endArrowhead: "arrow",
    });
    const targetRect = API.createElement({ id: "targetRect", x: 600 });
    API.setElements([source, targetArrow, targetRect]);
    copyFrom(source);

    pasteTo(targetArrow, targetRect);

    expect(getById("targetArrow")).toMatchObject({
      startArrowhead: "circle",
      endArrowhead: "triangle",
    });
    expect(getById("targetRect")).not.toHaveProperty("startArrowhead");
  });

  it("keeps frames transparent and sharp", () => {
    const source = API.createElement({
      id: "source",
      backgroundColor: "#ffc9c9",
      strokeColor: "#e03131",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const frame = API.createElement({ id: "frame", type: "frame", x: 300 });
    API.setElements([source, frame]);
    copyFrom(source);

    pasteTo(frame);

    expect(getById("frame")).toMatchObject({
      strokeColor: "#e03131",
      backgroundColor: "transparent",
      roundness: null,
    });
  });
});
