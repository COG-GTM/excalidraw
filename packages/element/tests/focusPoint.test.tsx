import React from "react";

import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { render } from "@excalidraw/excalidraw/tests/test-utils";

import type { LocalPoint } from "@excalidraw/math";

import {
  getEndpointBoundTextDragAnchor,
  getTextBindingForArrowEndpoint,
  isEndpointBoundText,
} from "../src/arrowEndpointText";
import { getGlobalFixedPointForBindableElement } from "../src/binding";

import type {
  ExcalidrawArrowElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

describe("arrow focus points", () => {
  beforeEach(async () => {
    localStorage.clear();
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const setup = () => {
    const rect1 = UI.createElement("rectangle", {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const rect2 = UI.createElement("rectangle", {
      x: 500,
      y: 0,
      width: 200,
      height: 200,
    });
    const rect3 = UI.createElement("ellipse", {
      x: 500,
      y: 400,
      width: 200,
      height: 200,
    });

    UI.clickTool("arrow");
    mouse.reset();
    mouse.downAt(100, 100);
    mouse.moveTo(600, 100);
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawArrowElement;
    return { rect1, rect2, rect3, arrow };
  };

  const focusPointOf = (
    arrow: ExcalidrawArrowElement,
    startOrEnd: "start" | "end",
  ) => {
    const binding =
      startOrEnd === "start" ? arrow.startBinding : arrow.endBinding;
    const map = h.app.scene.getNonDeletedElementsMap();
    const bindable = map.get(binding!.elementId)!;
    return getGlobalFixedPointForBindableElement(
      binding!.fixedPoint,
      bindable as any,
      map,
    );
  };

  it("drags start and end focus points within and across shapes", () => {
    const { rect2, rect3, arrow } = setup();
    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding?.elementId).toBe(rect2.id);

    API.setSelectedElements([arrow] as NonDeletedExcalidrawElement[]);

    // move the start focus point within its shape
    let [fx, fy] = focusPointOf(API.getElement(arrow), "start");
    mouse.reset();
    mouse.moveTo(fx, fy);
    mouse.downAt(fx, fy);
    mouse.moveTo(fx + 20, fy + 40);
    mouse.moveTo(fx + 40, fy + 60);
    mouse.up();

    // move the end focus point onto another shape
    API.setSelectedElements([
      API.getElement(arrow),
    ] as NonDeletedExcalidrawElement[]);
    [fx, fy] = focusPointOf(API.getElement(arrow), "end");
    mouse.reset();
    mouse.moveTo(fx, fy);
    mouse.downAt(fx, fy);
    mouse.moveTo(fx, fy + 200);
    mouse.moveTo(600, 500);
    mouse.up();

    const updated = API.getElement(arrow);
    expect(updated.startBinding).not.toBe(null);
    expect([rect2.id, rect3.id]).toContain(updated.endBinding?.elementId);
    for (const [x, y] of updated.points) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }

    // and move it off any shape
    API.setSelectedElements([updated] as NonDeletedExcalidrawElement[]);
    [fx, fy] = focusPointOf(updated, "end");
    mouse.reset();
    mouse.moveTo(fx, fy);
    mouse.downAt(fx, fy);
    mouse.moveTo(1200, 1200);
    mouse.up();
    expect(API.getElement(arrow).points.length).toBe(2);
  });

  it("hovering a focus point does not change the arrow", () => {
    const { arrow } = setup();
    API.setSelectedElements([arrow] as NonDeletedExcalidrawElement[]);
    const before = API.getElement(arrow).points;
    const [fx, fy] = focusPointOf(API.getElement(arrow), "start");
    mouse.reset();
    mouse.moveTo(fx, fy);
    mouse.moveTo(fx + 1, fy + 1);
    expect(API.getElement(arrow).points).toEqual(before);
  });
});

describe("arrow endpoint text", () => {
  const createArrow = (points: [number, number][]) =>
    API.createElement({
      type: "arrow",
      x: 100,
      y: 100,
      points: points.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
    }) as NonDeleted<ExcalidrawArrowElement>;

  it.each([
    ["right", [100, 0]],
    ["left", [-100, 0]],
    ["down", [0, 100]],
    ["up", [0, -100]],
    ["diagonal", [80, 60]],
  ] as const)("computes a text binding for an arrow pointing %s", (_, end) => {
    const arrow = createArrow([
      [0, 0],
      [end[0], end[1]],
    ]);
    const map = arrayToMap([arrow]);

    for (const startOrEnd of ["start", "end"] as const) {
      const res = getTextBindingForArrowEndpoint(arrow, startOrEnd, map, 2);
      expect(res).not.toBe(null);
      expect(res!.fixedPoint[0]).toBeGreaterThanOrEqual(0);
      expect(res!.fixedPoint[0]).toBeLessThanOrEqual(1);
      expect(res!.fixedPoint[1]).toBeGreaterThanOrEqual(0);
      expect(res!.fixedPoint[1]).toBeLessThanOrEqual(1);
    }
  });

  it("detects endpoint bound text", () => {
    const arrow = createArrow([
      [0, 0],
      [100, 0],
    ]);
    const text = API.createElement({ type: "text", text: "label" });
    const map = arrayToMap([arrow, text]);

    expect(isEndpointBoundText(text, map)).toBe(false);
    expect(getEndpointBoundTextDragAnchor(text)).toEqual({
      anchorRatio: expect.any(Number),
      anchorX: expect.any(Number),
    });

    const boundArrow = {
      ...arrow,
      endBinding: { elementId: text.id, fixedPoint: [0, 0.5], mode: "orbit" },
    } as unknown as ExcalidrawArrowElement;
    const boundText = {
      ...text,
      boundElements: [{ id: arrow.id, type: "arrow" }],
    } as typeof text;
    const boundMap = arrayToMap([boundArrow, boundText]);

    expect(isEndpointBoundText(boundText, boundMap)).toBe(true);
  });
});
