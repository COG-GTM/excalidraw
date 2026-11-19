import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionSwapStrokeAndBackgroundColors } from "./actionSwapColors";

const { h } = window;

const getColors = (id: string) => {
  const element = h.elements.find((el) => el.id === id)!;
  return {
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
  };
};

const isEnabled = () =>
  h.app.actionManager.isActionEnabled(actionSwapStrokeAndBackgroundColors);

describe("actionSwapStrokeAndBackgroundColors", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("swaps stroke and background colors on every selected element", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      strokeColor: "#1e1e1e",
      backgroundColor: "#ffc9c9",
    });
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse",
      strokeColor: "#1971c2",
      backgroundColor: "#b2f2bb",
    });
    const unselected = API.createElement({
      type: "diamond",
      id: "unselected",
      strokeColor: "#e03131",
      backgroundColor: "#a5d8ff",
    });
    API.setElements([rect, ellipse, unselected]);
    API.setSelectedElements([rect, ellipse]);

    API.executeAction(actionSwapStrokeAndBackgroundColors);

    expect(getColors("rect")).toEqual({
      strokeColor: "#ffc9c9",
      backgroundColor: "#1e1e1e",
    });
    expect(getColors("ellipse")).toEqual({
      strokeColor: "#b2f2bb",
      backgroundColor: "#1971c2",
    });
    expect(getColors("unselected")).toEqual({
      strokeColor: "#e03131",
      backgroundColor: "#a5d8ff",
    });
  });

  it("gives transparent-background elements the old stroke as fill and a transparent stroke", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    API.executeAction(actionSwapStrokeAndBackgroundColors);

    expect(getColors("rect")).toEqual({
      strokeColor: "transparent",
      backgroundColor: "#1e1e1e",
    });
  });

  it("leaves text bound inside a container unchanged", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      strokeColor: "#1e1e1e",
      backgroundColor: "#ffec99",
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "hello",
      containerId: container.id,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
    });
    API.setElements([container, label]);
    API.setSelectedElements([container, label]);

    API.executeAction(actionSwapStrokeAndBackgroundColors);

    expect(getColors("container")).toEqual({
      strokeColor: "#ffec99",
      backgroundColor: "#1e1e1e",
    });
    expect(getColors("label")).toEqual({
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
    });
  });

  it("leaves locked elements unchanged", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      strokeColor: "#1e1e1e",
      backgroundColor: "#ffc9c9",
    });
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      strokeColor: "#1971c2",
      backgroundColor: "#b2f2bb",
      locked: true,
    });
    API.setElements([rect, locked]);
    API.setSelectedElements([rect, locked]);

    API.executeAction(actionSwapStrokeAndBackgroundColors);

    expect(getColors("rect")).toEqual({
      strokeColor: "#ffc9c9",
      backgroundColor: "#1e1e1e",
    });
    expect(getColors("locked")).toEqual({
      strokeColor: "#1971c2",
      backgroundColor: "#b2f2bb",
    });
  });

  it("is enabled only when an unlocked, non-bound-text element is selected", () => {
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      locked: true,
    });
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    API.setElements([locked, rect]);

    expect(isEnabled()).toBe(false);

    API.setSelectedElements([locked]);
    expect(isEnabled()).toBe(false);

    API.setSelectedElements([rect]);
    expect(isEnabled()).toBe(true);
  });

  it("does nothing when nothing swappable is selected", () => {
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      strokeColor: "#1971c2",
      backgroundColor: "#b2f2bb",
      locked: true,
    });
    API.setElements([locked]);
    API.setSelectedElements([locked]);
    const before: readonly ExcalidrawElement[] = h.elements;

    API.executeAction(actionSwapStrokeAndBackgroundColors);

    expect(h.elements).toBe(before);
  });

  it("is a single undoable step that restores both colors", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      strokeColor: "#1e1e1e",
      backgroundColor: "#ffc9c9",
    });
    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([rect]);

    API.executeAction(actionSwapStrokeAndBackgroundColors);
    expect(getColors("rect")).toEqual({
      strokeColor: "#ffc9c9",
      backgroundColor: "#1e1e1e",
    });
    expect(API.getUndoStack().length).toBe(1);

    API.executeAction(actionSwapStrokeAndBackgroundColors);
    expect(API.getUndoStack().length).toBe(2);

    Keyboard.undo();
    expect(getColors("rect")).toEqual({
      strokeColor: "#ffc9c9",
      backgroundColor: "#1e1e1e",
    });

    Keyboard.undo();
    expect(getColors("rect")).toEqual({
      strokeColor: "#1e1e1e",
      backgroundColor: "#ffc9c9",
    });
  });
});
