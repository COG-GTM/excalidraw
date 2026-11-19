import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { LocalPoint, Radians } from "@excalidraw/math";
import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionMatchSize } from "./actionMatchSize";

const { h } = window;

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

describe("actionMatchSize", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("resizes selected elements to the largest one by area, keeping top-left", () => {
    const small = API.createElement({
      type: "rectangle",
      id: "small",
      x: 10,
      y: 20,
      width: 50,
      height: 40,
    });
    const largest = API.createElement({
      type: "ellipse",
      id: "largest",
      x: 300,
      y: 300,
      width: 200,
      height: 150,
    });
    // wider than the largest, but smaller area
    const wide = API.createElement({
      type: "diamond",
      id: "wide",
      x: -100,
      y: 500,
      width: 400,
      height: 10,
    });
    API.setElements([small, largest, wide]);
    API.setSelectedElements([small, largest, wide]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    for (const id of ["small", "largest", "wide"]) {
      expect(getElement(id).width).toBeCloseTo(200);
      expect(getElement(id).height).toBeCloseTo(150);
    }
    expect(getElement("small").x).toBeCloseTo(10);
    expect(getElement("small").y).toBeCloseTo(20);
    expect(getElement("wide").x).toBeCloseTo(-100);
    expect(getElement("wide").y).toBeCloseTo(500);
    expect(getElement("largest").x).toBe(300);
    expect(getElement("largest").y).toBe(300);
  });

  it("rescales linear element points to the target size", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      width: 200,
      height: 100,
    });
    const line = API.createElement({
      type: "line",
      id: "line",
      x: 500,
      y: 500,
      width: 50,
      height: 50,
    });
    API.setElements([rect, line]);
    API.setSelectedElements([rect, line]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    const resized = getElement("line");
    expect(resized.width).toBeCloseTo(200);
    expect(resized.height).toBeCloseTo(100);
  });

  it("skips locked elements", () => {
    const largest = API.createElement({
      type: "rectangle",
      id: "largest",
      width: 300,
      height: 300,
    });
    const a = API.createElement({
      type: "rectangle",
      id: "a",
      x: 400,
      width: 50,
      height: 50,
    });
    const b = API.createElement({
      type: "rectangle",
      id: "b",
      x: 600,
      width: 50,
      height: 50,
    });
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      x: 800,
      width: 20,
      height: 20,
      locked: true,
    });
    API.setElements([largest, a, b, locked]);
    API.setSelectedElements([largest, a, b, locked]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    expect(getElement("a").width).toBe(300);
    expect(getElement("b").height).toBe(300);
    expect(getElement("locked").width).toBe(20);
    expect(getElement("locked").height).toBe(20);
  });

  it("ignores a locked element even when it is the largest", () => {
    const lockedLarge = API.createElement({
      type: "rectangle",
      id: "lockedLarge",
      width: 1000,
      height: 1000,
      locked: true,
    });
    const a = API.createElement({
      type: "rectangle",
      id: "a",
      width: 100,
      height: 80,
    });
    const b = API.createElement({
      type: "rectangle",
      id: "b",
      width: 30,
      height: 30,
    });
    API.setElements([lockedLarge, a, b]);
    API.setSelectedElements([lockedLarge, a, b]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    expect(getElement("b").width).toBe(100);
    expect(getElement("b").height).toBe(80);
    expect(getElement("lockedLarge").width).toBe(1000);
  });

  it("skips text bound to a container", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      width: 100,
      height: 60,
    });
    const boundText = API.createElement({
      type: "text",
      id: "boundText",
      text: "hi",
      width: 400,
      height: 400,
      containerId: container.id,
    });
    h.app.scene.mutateElement(container, {
      boundElements: [{ type: "text", id: boundText.id }],
    });
    const other = API.createElement({
      type: "rectangle",
      id: "other",
      x: 300,
      width: 200,
      height: 120,
    });
    API.setElements([container, boundText, other]);
    API.setSelectedElements([container, boundText, other]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    // bound text (largest raw area) is neither the target nor resized
    expect(getElement("container").width).toBe(200);
    expect(getElement("container").height).toBe(120);
    expect(getElement("other").width).toBe(200);
    expect(getElement("boundText").width).not.toBe(200);
  });

  it("predicate requires two or more eligible selected elements", () => {
    const a = API.createElement({ type: "rectangle", id: "a" });
    const b = API.createElement({ type: "rectangle", id: "b", x: 200 });
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      x: 400,
      locked: true,
    });
    API.setElements([a, b, locked]);

    const isEnabled = () => actionMatchSize.predicate(h.elements, h.state);

    API.setSelectedElements([]);
    expect(isEnabled()).toBe(false);

    API.setSelectedElements([a]);
    expect(isEnabled()).toBe(false);

    API.setSelectedElements([a, locked]);
    expect(isEnabled()).toBe(false);

    API.setSelectedElements([a, b]);
    expect(isEnabled()).toBe(true);
  });

  it("is a no-op with fewer than two eligible elements", () => {
    const a = API.createElement({
      type: "rectangle",
      id: "a",
      width: 10,
      height: 10,
    });
    const b = API.createElement({
      type: "rectangle",
      id: "b",
      width: 100,
      height: 100,
    });
    API.setElements([a, b]);
    API.setSelectedElements([a]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    expect(getElement("a").width).toBe(10);
    expect(getElement("b").width).toBe(100);
  });

  it("uses the English 'Match size' label", () => {
    expect(actionMatchSize.label).toBe("labels.matchSize");
  });

  it("is undone in a single step", () => {
    const a = API.createElement({
      type: "rectangle",
      id: "a",
      x: 10,
      y: 10,
      width: 40,
      height: 30,
    });
    const b = API.createElement({
      type: "rectangle",
      id: "b",
      x: 200,
      y: 10,
      width: 20,
      height: 20,
    });
    const c = API.createElement({
      type: "rectangle",
      id: "c",
      x: 400,
      y: 10,
      width: 120,
      height: 90,
    });
    API.updateScene({
      elements: [a, b, c],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([a, b, c]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    expect(getElement("a").width).toBe(120);
    expect(getElement("b").width).toBe(120);

    Keyboard.undo();

    expect(getElement("a").width).toBe(40);
    expect(getElement("a").height).toBe(30);
    expect(getElement("b").width).toBe(20);
    expect(getElement("b").height).toBe(20);
    expect(getElement("c").width).toBe(120);

    Keyboard.redo();

    expect(getElement("a").width).toBe(120);
    expect(getElement("b").height).toBe(90);
  });

  it("matches axis-aligned lines by length", () => {
    const short = API.createElement({
      type: "line",
      id: "short",
      x: 10,
      y: 10,
      width: 100,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    });
    const long = API.createElement({
      type: "line",
      id: "long",
      x: 10,
      y: 100,
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
    });
    const vertical = API.createElement({
      type: "line",
      id: "vertical",
      x: 400,
      y: 10,
      width: 0,
      height: 50,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 50)],
    });
    API.setElements([short, long, vertical]);
    API.setSelectedElements([short, long, vertical]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    const resizedShort = getElement("short") as ExcalidrawLinearElement;
    expect(resizedShort.width).toBe(200);
    expect(resizedShort.height).toBe(0);
    expect(resizedShort.points).toEqual([pointFrom(0, 0), pointFrom(200, 0)]);
    expect(resizedShort.x).toBe(10);
    expect(resizedShort.y).toBe(10);
    // the target has no height to match, so the vertical line is unchanged
    const resizedVertical = getElement("vertical") as ExcalidrawLinearElement;
    expect(resizedVertical.width).toBe(0);
    expect(resizedVertical.height).toBe(50);
  });

  it("matches vertical lines to the longest one", () => {
    const short = API.createElement({
      type: "line",
      id: "short",
      x: 10,
      y: 10,
      width: 0,
      height: 40,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 40)],
    });
    const long = API.createElement({
      type: "line",
      id: "long",
      x: 100,
      y: 10,
      width: 0,
      height: 120,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 120)],
    });
    API.setElements([short, long]);
    API.setSelectedElements([short, long]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    const resized = getElement("short") as ExcalidrawLinearElement;
    expect(resized.width).toBe(0);
    expect(resized.height).toBe(120);
    expect(resized.points).toEqual([pointFrom(0, 0), pointFrom(0, 120)]);
  });

  it("keeps a rotated element's on-canvas top-left corner", () => {
    const getTopLeft = (id: string) => {
      const el = getElement(id);
      return pointRotateRads(
        pointFrom(el.x, el.y),
        pointFrom(el.x + el.width / 2, el.y + el.height / 2),
        el.angle,
      );
    };
    const rotated = API.createElement({
      type: "rectangle",
      id: "rotated",
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      angle: (Math.PI / 4) as Radians,
    });
    const largest = API.createElement({
      type: "rectangle",
      id: "largest",
      x: 500,
      width: 200,
      height: 150,
    });
    API.setElements([rotated, largest]);
    API.setSelectedElements([rotated, largest]);
    const [beforeX, beforeY] = getTopLeft("rotated");

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    const [afterX, afterY] = getTopLeft("rotated");
    expect(getElement("rotated").width).toBeCloseTo(200);
    expect(getElement("rotated").height).toBeCloseTo(150);
    expect(getElement("rotated").angle).toBeCloseTo(Math.PI / 4);
    expect(afterX).toBeCloseTo(beforeX);
    expect(afterY).toBeCloseTo(beforeY);
  });

  it("removes children a shrunken frame no longer contains", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 0,
      y: 0,
      width: 400,
      height: 50,
    });
    const inside = API.createElement({
      type: "rectangle",
      id: "inside",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });
    const outside = API.createElement({
      type: "rectangle",
      id: "outside",
      x: 300,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });
    const largest = API.createElement({
      type: "rectangle",
      id: "largest",
      x: 600,
      y: 0,
      width: 150,
      height: 150,
    });
    API.setElements([inside, outside, frame, largest]);
    API.setSelectedElements([frame, largest]);

    act(() => {
      h.app.actionManager.executeAction(actionMatchSize);
    });

    expect(getElement("frame").width).toBe(150);
    expect(getElement("frame").height).toBe(150);
    expect(getElement("inside").frameId).toBe("frame");
    expect(getElement("outside").frameId).toBe(null);
  });
});
