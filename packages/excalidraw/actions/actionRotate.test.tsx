import React from "react";
import { queryByTestId } from "@testing-library/react";

import {
  CaptureUpdateAction,
  computeBoundTextPosition,
} from "@excalidraw/element";

import type { ExcalidrawTextElementWithContainer } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionRotate90Clockwise } from "./actionRotate";

const { h } = window;
const mouse = new Pointer("mouse");

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

describe("actionRotate90Clockwise", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("rotates a single element around its own center", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    API.executeAction(actionRotate90Clockwise);

    const rotated = getElement("rect");
    expect(rotated.angle).toBeCloseTo(Math.PI / 2);
    expect(rotated.x).toBe(100);
    expect(rotated.y).toBe(100);
    expect(rotated.width).toBe(200);
    expect(rotated.height).toBe(100);
  });

  it("normalizes the angle to [0, 2π)", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      width: 100,
      height: 100,
      angle: ((3 * Math.PI) / 2) as any,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    API.executeAction(actionRotate90Clockwise);
    expect(getElement("rect").angle).toBeCloseTo(0);

    API.executeAction(actionRotate90Clockwise);
    API.executeAction(actionRotate90Clockwise);
    API.executeAction(actionRotate90Clockwise);
    const { angle } = getElement("rect");
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
    expect(angle).toBeCloseTo((3 * Math.PI) / 2);
  });

  it("rotates a multi-element selection around the common bounding box center", () => {
    // common bounding box: (0, 0) -> (300, 100), center (150, 50)
    const left = API.createElement({
      type: "rectangle",
      id: "left",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const right = API.createElement({
      type: "ellipse",
      id: "right",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([left, right]);
    API.setSelectedElements([left, right]);

    API.executeAction(actionRotate90Clockwise);

    // centers (50, 50) and (250, 50) rotate 90° cw around (150, 50)
    // to (150, -50) and (150, 150)
    const l = getElement("left");
    const r = getElement("right");
    expect(l.angle).toBeCloseTo(Math.PI / 2);
    expect(r.angle).toBeCloseTo(Math.PI / 2);
    expect(l.x).toBeCloseTo(100);
    expect(l.y).toBeCloseTo(-100);
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(100);
  });

  it("leaves locked elements unchanged", () => {
    const unlocked = API.createElement({
      type: "rectangle",
      id: "unlocked",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      x: 300,
      y: 300,
      width: 100,
      height: 50,
      locked: true,
    });
    API.setElements([unlocked, locked]);
    API.setSelectedElements([unlocked, locked]);
    const lockedVersion = getElement("locked").version;

    API.executeAction(actionRotate90Clockwise);

    // only the unlocked element rotates, around its own center
    expect(getElement("unlocked")).toMatchObject({ x: 0, y: 0 });
    expect(getElement("unlocked").angle).toBeCloseTo(Math.PI / 2);
    expect(getElement("locked")).toMatchObject({
      x: 300,
      y: 300,
      angle: 0,
      version: lockedVersion,
    });
  });

  it("rotates bound text with its container", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      boundElements: [{ type: "text", id: "text" }],
    });
    const text = API.createElement({
      type: "text",
      id: "text",
      text: "hello",
      containerId: "container",
    });
    const other = API.createElement({
      type: "rectangle",
      id: "other",
      x: 300,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([container, text, other]);
    API.setSelectedElements([container, other]);

    API.executeAction(actionRotate90Clockwise);

    const rotatedContainer = getElement("container");
    const rotatedText = getElement("text");
    expect(rotatedContainer.angle).toBeCloseTo(Math.PI / 2);
    expect(rotatedText.angle).toBeCloseTo(Math.PI / 2);
    // bound text is repositioned inside the rotated container
    // container center (100, 50) rotates 90° cw around (200, 50) to (200, -50)
    expect(rotatedContainer.x).toBeCloseTo(100);
    expect(rotatedContainer.y).toBeCloseTo(-100);
    const expected = computeBoundTextPosition(
      rotatedContainer,
      rotatedText as ExcalidrawTextElementWithContainer,
      h.app.scene.getNonDeletedElementsMap(),
    );
    expect(rotatedText.x).toBeCloseTo(expected.x);
    expect(rotatedText.y).toBeCloseTo(expected.y);
  });

  describe("predicate", () => {
    it("is false when nothing is selected", () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.setSelectedElements([]);

      expect(actionRotate90Clockwise.predicate!(h.elements, h.state)).toBe(
        false,
      );
    });

    it("is false when only locked elements are selected", () => {
      const rect = API.createElement({ type: "rectangle", locked: true });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      expect(actionRotate90Clockwise.predicate!(h.elements, h.state)).toBe(
        false,
      );
    });

    it("is true when an unlocked element is selected", () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      expect(actionRotate90Clockwise.predicate!(h.elements, h.state)).toBe(
        true,
      );
    });

    it("hides the context menu item when nothing is selected", () => {
      const rect = API.createElement({ type: "rectangle", x: 0, y: 0 });
      API.setElements([rect]);
      API.setSelectedElements([]);

      mouse.rightClickAt(500, 500);

      const contextMenu = UI.queryContextMenu();
      expect(contextMenu).not.toBeNull();
      expect(queryByTestId(contextMenu!, "rotate90Clockwise")).toBeNull();
    });
  });

  it("undoes the rotation in one step", () => {
    const a = API.createElement({
      type: "rectangle",
      id: "a",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    const b = API.createElement({
      type: "diamond",
      id: "b",
      x: 200,
      y: 100,
      width: 80,
      height: 80,
      angle: 0.5 as any,
    });
    API.updateScene({
      elements: [a, b],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([a, b]);

    API.executeAction(actionRotate90Clockwise);
    expect(getElement("a").angle).toBeCloseTo(Math.PI / 2);
    expect(getElement("b").angle).toBeCloseTo(0.5 + Math.PI / 2);

    Keyboard.undo();

    expect(getElement("a")).toMatchObject({ x: 0, y: 0, angle: 0 });
    expect(getElement("b")).toMatchObject({ x: 200, y: 100, angle: 0.5 });
  });
});
