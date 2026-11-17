import React from "react";
import { reseed } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

const snapshotPositions = () =>
  Object.fromEntries(
    h.elements.map((element) => [
      element.id,
      {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        points: "points" in element ? element.points : undefined,
      },
    ]),
  );

const setupScene = () => {
  const rect1 = API.createElement({
    type: "rectangle",
    id: "rect1",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const rect2 = API.createElement({
    type: "rectangle",
    id: "rect2",
    x: 300,
    y: 0,
    width: 100,
    height: 100,
  });
  const rect3 = API.createElement({
    type: "rectangle",
    id: "rect3",
    x: 0,
    y: 300,
    width: 100,
    height: 100,
  });
  const rect4 = API.createElement({
    type: "rectangle",
    id: "rect4",
    x: 300,
    y: 300,
    width: 100,
    height: 100,
  });
  // points placed by hand (as in a loaded file), not where the bindings
  // would route them
  const shortArrow = API.createElement({
    type: "arrow",
    id: "shortArrow",
    x: 103,
    y: 50,
    width: 194,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(194, 0)],
    startBinding: {
      elementId: rect1.id,
      fixedPoint: [1.0294, 0.5],
      mode: "orbit",
    },
    endBinding: {
      elementId: rect2.id,
      fixedPoint: [-0.0294, 0.5],
      mode: "orbit",
    },
  });
  const longArrow = API.createElement({
    type: "arrow",
    id: "longArrow",
    x: 403,
    y: 50,
    width: 403,
    height: 300,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(-403, 300)],
    startBinding: {
      elementId: rect2.id,
      fixedPoint: [1.0294, 0.5],
      mode: "orbit",
    },
    endBinding: {
      elementId: rect3.id,
      fixedPoint: [-0.0294, 0.5],
      mode: "orbit",
    },
  });
  // not attached to the dragged shape, but to a shape that shares an arrow with it
  const neighborArrow = API.createElement({
    type: "arrow",
    id: "neighborArrow",
    x: 103,
    y: 350,
    width: 194,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(194, 0)],
    startBinding: {
      elementId: rect3.id,
      fixedPoint: [1.0294, 0.5],
      mode: "orbit",
    },
    endBinding: {
      elementId: rect4.id,
      fixedPoint: [-0.0294, 0.5],
      mode: "orbit",
    },
  });

  const withBound = (
    element: ExcalidrawElement,
    ...arrows: ExcalidrawElement[]
  ) => ({
    ...element,
    boundElements: arrows.map((arrow) => ({
      id: arrow.id,
      type: "arrow" as const,
    })),
  });

  API.updateScene({
    elements: [
      withBound(rect1, shortArrow),
      withBound(rect2, shortArrow, longArrow),
      withBound(rect3, longArrow, neighborArrow),
      withBound(rect4, neighborArrow),
      shortArrow,
      longArrow,
      neighborArrow,
    ],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
};

describe("undo/redo of a single dragged bound shape", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    setupScene();
  });

  afterEach(() => {
    mouse.reset();
  });

  it("restores exact arrow positions after dragging one bound shape and undo", () => {
    const before = snapshotPositions();

    mouse.select(h.elements.find((element) => element.id === "rect2")!);
    mouse.downAt(350, 0);
    mouse.moveTo(350, 100);
    mouse.up();

    const dragged = snapshotPositions();
    expect(dragged.rect2.y).toBe(100);
    expect(dragged.rect1).toEqual(before.rect1);
    expect(dragged.rect3).toEqual(before.rect3);
    expect(dragged.neighborArrow).toEqual(before.neighborArrow);

    Keyboard.undo();
    expect(snapshotPositions()).toEqual(before);

    Keyboard.redo();
    expect(snapshotPositions()).toEqual(dragged);
  });
});
