import React from "react";

import { KEYS, arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { act, render } from "@excalidraw/excalidraw/tests/test-utils";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import { convertToShape } from "../src/convertToShape";
import { LinearElementEditor } from "../src/linearElementEditor";

import type {
  ExcalidrawElbowArrowElement,
  ExcalidrawLinearElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

const gp = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);
const lp = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

const edge = (
  from: [number, number],
  to: [number, number],
  steps = 10,
): GlobalPoint[] =>
  Array.from({ length: steps }, (_, i) =>
    gp(
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    ),
  );

describe("elbow arrow fixed segments", () => {
  beforeEach(async () => {
    localStorage.clear();
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const setup = () => {
    const start = UI.createElement("rectangle", {
      x: -100,
      y: -50,
      width: 100,
      height: 100,
    });
    const end = UI.createElement("rectangle", {
      x: 200,
      y: 150,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(200, 200);
    mouse.click();

    mouse.reset();
    mouse.moveTo(100, 100);
    mouse.down();
    mouse.moveTo(115, 100);
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawElbowArrowElement;
    expect(arrow.fixedSegments?.length).toBe(1);

    return { start, end, arrow };
  };

  it("keeps fixed segments while the bound shapes move around", () => {
    const { start, end, arrow } = setup();

    const moves: [number, number][] = [
      [0, 40],
      [0, -200],
      [-150, 0],
      [400, 0],
      [0, 300],
    ];
    for (const [dx, dy] of moves) {
      API.setSelectedElements([start] as NonDeletedExcalidrawElement[]);
      const el = API.getElement(start);
      mouse.reset();
      mouse.downAt(el.x + 50, el.y + 50);
      mouse.moveTo(el.x + 50 + dx, el.y + 50 + dy);
      mouse.up();

      const updated = API.getElement(arrow);
      expect(updated.points.length).toBeGreaterThanOrEqual(2);
      for (const [x, y] of updated.points) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
    }

    API.setSelectedElements([end] as NonDeletedExcalidrawElement[]);
    const el = API.getElement(end);
    mouse.reset();
    mouse.downAt(el.x + 50, el.y + 50);
    mouse.moveTo(el.x - 250, el.y - 250);
    mouse.up();

    expect(API.getElement(arrow).startBinding?.elementId).toBe(start.id);
    expect(API.getElement(arrow).endBinding?.elementId).toBe(end.id);
  });

  it("releases a fixed segment", () => {
    const { arrow } = setup();
    const segment = arrow.fixedSegments![0];

    act(() => {
      LinearElementEditor.deleteFixedSegment(
        API.getElement(arrow),
        h.app.scene,
        segment.index,
      );
    });

    const updated = API.getElement(arrow);
    expect(updated.fixedSegments ?? []).toHaveLength(0);
    expect(updated.points[0]).toEqual(lp(0, 0));
  });

  it("drags an unbound endpoint of an elbow arrow with fixed segments", () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");
    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(250, 200);
    mouse.click();

    mouse.reset();
    mouse.moveTo(125, 100);
    mouse.down();
    mouse.moveTo(140, 100);
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawElbowArrowElement;
    expect(arrow.fixedSegments?.length).toBe(1);

    for (const [x, y] of [
      [300, 260],
      [320, -100],
      [-80, 260],
      [180, 400],
    ]) {
      const current = API.getElement(arrow);
      const [ex, ey] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
        current,
        current.points.length - 1,
        arrayToMap(h.elements),
      );
      mouse.reset();
      mouse.downAt(ex, ey);
      mouse.moveTo(x, y);
      mouse.up();
    }

    const updated = API.getElement(arrow);
    for (const [x, y] of updated.points) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe("linear element editor operations", () => {
  beforeEach(async () => {
    localStorage.clear();
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const createLine = () =>
    UI.createElement("line", {
      x: 0,
      y: 0,
      points: [lp(0, 0), lp(100, 100), lp(200, 0), lp(300, 100)],
    }) as unknown as NonDeleted<ExcalidrawLinearElement>;

  it("enters edit mode and duplicates points", () => {
    const line = createLine();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ENTER);
    });
    expect(h.state.selectedLinearElement?.isEditing).toBe(true);

    // select the first two points
    act(() => {
      h.setState({
        selectedLinearElement: {
          ...h.state.selectedLinearElement!,
          selectedPointsIndices: [0, 1],
        },
      });
    });

    act(() => {
      h.setState(
        LinearElementEditor.duplicateSelectedPoints(h.state, h.app.scene),
      );
    });
    expect(API.getElement(line).points).toHaveLength(6);

    // shift-locked drag of a point
    const [px, py] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      API.getElement(line),
      5,
      arrayToMap(h.elements),
    );
    mouse.reset();
    mouse.downAt(px, py);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(px + 100, py + 7);
    });
    mouse.up();

    // select the last point only and duplicate it (appends to the end)
    act(() => {
      h.setState({
        selectedLinearElement: {
          ...h.state.selectedLinearElement!,
          selectedPointsIndices: [5],
        },
      });
    });
    act(() => {
      h.setState(
        LinearElementEditor.duplicateSelectedPoints(h.state, h.app.scene),
      );
    });
    expect(API.getElement(line).points).toHaveLength(7);

    Keyboard.keyPress(KEYS.ESCAPE);
    expect(h.state.selectedLinearElement?.isEditing).toBeFalsy();
  });

  it("adds points and converts absolute coords", () => {
    const line = createLine();

    act(() => {
      LinearElementEditor.addPoints(API.getElement(line), h.app.scene, [
        lp(400, 0),
        lp(500, 100),
      ]);
    });
    const updated = API.getElement(line);
    expect(updated.points).toHaveLength(6);

    expect(
      LinearElementEditor.pointFromAbsoluteCoords(
        updated,
        gp(updated.x + 10, updated.y + 20),
        arrayToMap(h.elements),
      ),
    ).toEqual(lp(10, 20));

    const rotated = { ...updated, angle: Math.PI / 2 } as typeof updated;
    const local = LinearElementEditor.pointFromAbsoluteCoords(
      rotated,
      gp(rotated.x, rotated.y),
      arrayToMap([rotated]),
    );
    expect(Number.isFinite(local[0])).toBe(true);
  });

  it("drags a line point with shift to lock the angle", () => {
    UI.clickTool("line");
    mouse.reset();
    mouse.downAt(0, 0);
    mouse.moveTo(100, 10);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(200, 15);
    });
    mouse.up();

    const line = API.getSelectedElement() as ExcalidrawLinearElement;
    expect(line.points[line.points.length - 1][1]).toBeCloseTo(0);
  });
});

describe("convertToShape", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  const rectanglePoints = [
    ...edge([0, 0], [200, 0]),
    ...edge([200, 0], [200, 100]),
    ...edge([200, 100], [0, 100]),
    ...edge([0, 100], [0, 0]),
    gp(0, 0),
  ];

  const ellipsePoints = Array.from({ length: 41 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return gp(100 + 100 * Math.cos(a), 50 + 50 * Math.sin(a));
  });

  const diamondPoints = [
    ...edge([100, 0], [200, 100]),
    ...edge([200, 100], [100, 200]),
    ...edge([100, 200], [0, 100]),
    ...edge([0, 100], [100, 0]),
    gp(100, 0),
  ];

  const linePoints = edge([0, 0], [300, 10], 30);

  const arrowPoints = [
    ...edge([0, 0], [300, 0], 30),
    ...edge([300, 0], [270, -20], 5),
    ...edge([270, -20], [300, 0], 5),
    ...edge([300, 0], [270, 20], 5),
  ];

  it.each([
    ["rectangle", rectanglePoints],
    ["ellipse", ellipsePoints],
    ["diamond", diamondPoints],
    ["line", linePoints],
    ["arrow", arrowPoints],
  ] as const)("converts a hand-drawn %s", (type, points) => {
    const res = convertToShape(
      points as GlobalPoint[],
      h.state,
      new Map(),
      null,
    );
    expect(res).toBeDefined();
    expect(res!.type).toBe(type);
    if ("points" in res!) {
      expect(res.points[res.points.length - 1][0]).toBeGreaterThan(250);
    } else {
      expect(res!.width).toBeGreaterThan(150);
    }
  });

  it("assigns enclosing frames and round shapes", () => {
    const frame = API.createElement({
      type: "frame",
      x: -50,
      y: -50,
      width: 400,
      height: 400,
    });
    const res = convertToShape(
      rectanglePoints,
      { ...h.state, currentItemRoundness: "round" },
      arrayToMap([frame]),
      null,
    );
    expect(res?.frameId).toBe(frame.id);
  });
});
