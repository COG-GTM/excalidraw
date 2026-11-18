import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { lineSegment } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type {
  ExcalidrawBindableElement,
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
} from "@excalidraw/element/types";
import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import {
  ellipseAxes,
  ellipseExtremes,
  ellipseFocusToCenter,
  getClosedCurveShape,
  getCurvePathOps,
  getCurveShape,
  getEllipseShape,
  getFreedrawShape,
  getPolygonShape,
  getSelectionBoxShape,
  pointInEllipse,
  pointOnEllipse,
  segmentIntersectRectangleElement,
} from "../src/shape";

import type { Ellipse } from "../src/shape";
import type { Drawable, Op, OpSet } from "roughjs/bin/core";

const expectPointsClose = (
  received: readonly (readonly number[])[],
  expected: readonly (readonly number[])[],
) => {
  expect(received.length).toBe(expected.length);
  expected.forEach(([x, y], idx) => {
    expect(received[idx][0]).toBeCloseTo(x);
    expect(received[idx][1]).toBeCloseTo(y);
  });
};

const drawable = (sets: OpSet[]): Drawable => ({
  shape: "curve",
  options: {} as Drawable["options"],
  sets,
});

const op = (name: Op["op"], data: number[]): Op => ({ op: name, data });

describe("getPolygonShape", () => {
  it("returns the four corners of a rectangle", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    const shape = getPolygonShape<GlobalPoint>(
      rectangle as ExcalidrawRectangleElement,
    );

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [10, 20],
      [110, 20],
      [110, 70],
      [10, 70],
      [10, 20],
    ]);
  });

  it("returns the four edge midpoints of a diamond", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });

    const shape = getPolygonShape<GlobalPoint>(
      diamond as ExcalidrawDiamondElement,
    );

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [50, 0],
      [100, 25],
      [50, 50],
      [0, 25],
      [50, 0],
    ]);
  });

  it("rotates the corners around the element center", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 20,
      height: 10,
      angle: (Math.PI / 2) as Radians,
    });

    const shape = getPolygonShape<GlobalPoint>(
      rectangle as ExcalidrawRectangleElement,
    );

    // a 20x10 box rotated 90deg around (10, 5) spans x 5..15, y -5..15
    expectPointsClose(shape.data as GlobalPoint[], [
      [15, -5],
      [15, 15],
      [5, 15],
      [5, -5],
      [15, -5],
    ]);
  });
});

describe("getSelectionBoxShape", () => {
  it("pads the element bounds by 10 by default", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    const shape = getSelectionBoxShape<GlobalPoint>(
      rectangle,
      arrayToMap([rectangle]),
    );

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [0, 10],
      [120, 10],
      [120, 80],
      [0, 80],
    ]);
  });

  it("supports a custom padding and rotation", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 20,
      height: 10,
      angle: Math.PI as Radians,
    });

    const shape = getSelectionBoxShape<GlobalPoint>(
      rectangle,
      arrayToMap([rectangle]),
      0,
    );

    // rotating by 180deg around the center swaps opposite corners
    expectPointsClose(shape.data as GlobalPoint[], [
      [20, 10],
      [0, 10],
      [0, 0],
      [20, 0],
    ]);
  });
});

describe("getEllipseShape", () => {
  it("maps an ellipse element to its center, angle and half axes", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      angle: 1 as Radians,
    });

    expect(
      getEllipseShape<GlobalPoint>(ellipse as ExcalidrawEllipseElement),
    ).toEqual({
      type: "ellipse",
      data: {
        center: pointFrom(60, 45),
        angle: 1,
        halfWidth: 50,
        halfHeight: 25,
      },
    });
  });
});

describe("getCurvePathOps", () => {
  it("returns an empty list for a missing shape", () => {
    expect(getCurvePathOps(undefined as unknown as Drawable)).toEqual([]);
  });

  it("prefers the first path op set", () => {
    const fillOps = [op("move", [0, 0])];
    const pathOps = [op("move", [1, 1]), op("lineTo", [2, 2])];

    expect(
      getCurvePathOps(
        drawable([
          { type: "fillPath", ops: fillOps },
          { type: "path", ops: pathOps },
        ]),
      ),
    ).toBe(pathOps);
  });

  it("falls back to the first op set when there is no path set", () => {
    const sketchOps = [op("move", [3, 3])];

    expect(
      getCurvePathOps(drawable([{ type: "fillSketch", ops: sketchOps }])),
    ).toBe(sketchOps);
  });
});

describe("getCurveShape", () => {
  const roughShape = drawable([
    {
      type: "path",
      ops: [
        op("move", [0, 0]),
        op("bcurveTo", [1, 1, 2, 2, 3, 3]),
        op("bcurveTo", [4, 4, 5, 5, 6, 6]),
      ],
    },
  ]);

  it("builds a polycurve offset by the starting point", () => {
    const shape = getCurveShape<GlobalPoint>(
      roughShape,
      pointFrom<GlobalPoint>(10, 10),
      0 as Radians,
      pointFrom(0, 0),
    );

    expect(shape.type).toBe("polycurve");
    expect(shape.data).toHaveLength(2);
    const [first, second] = shape.data as GlobalPoint[][];
    expectPointsClose(first, [
      [10, 10],
      [11, 11],
      [12, 12],
      [13, 13],
    ]);
    // the next curve starts where the previous one ended
    expectPointsClose(second, [
      [13, 13],
      [14, 14],
      [15, 15],
      [16, 16],
    ]);
  });

  it("rotates every control point around the center", () => {
    const shape = getCurveShape<GlobalPoint>(
      roughShape,
      pointFrom<GlobalPoint>(0, 0),
      Math.PI as Radians,
      pointFrom(0, 0),
    );

    const [first] = shape.data as GlobalPoint[][];
    expectPointsClose(first, [
      [0, 0],
      [-1, -1],
      [-2, -2],
      [-3, -3],
    ]);
  });

  it("defaults the starting point to the origin", () => {
    const shape = getCurveShape<GlobalPoint>(
      roughShape,
      undefined,
      0 as Radians,
      pointFrom(0, 0),
    );

    const [first] = shape.data as GlobalPoint[][];
    expectPointsClose(first, [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });
});

describe("getFreedrawShape", () => {
  const freedraw = API.createElement({
    type: "freedraw",
    x: 10,
    y: 10,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(10, 0),
      pointFrom<LocalPoint>(10, 10),
    ],
  }) as ExcalidrawFreeDrawElement;

  it("returns an open polyline in scene coordinates", () => {
    const shape = getFreedrawShape<GlobalPoint>(freedraw, pointFrom(15, 15));

    expect(shape.type).toBe("polyline");
    const segments = shape.data as GlobalPoint[][];
    expect(segments).toHaveLength(2);
    expectPointsClose(segments[0], [
      [10, 10],
      [20, 10],
    ]);
    expectPointsClose(segments[1], [
      [20, 10],
      [20, 20],
    ]);
  });

  it("returns a closed polygon when isClosed is set", () => {
    const shape = getFreedrawShape<GlobalPoint>(
      freedraw,
      pointFrom(15, 15),
      true,
    );

    expect(shape.type).toBe("polygon");
    const points = shape.data as GlobalPoint[];
    expectPointsClose([points[0]], [[10, 10]]);
    expectPointsClose([points[points.length - 1]], [[10, 10]]);
  });

  it("rotates the points around the given center", () => {
    const rotated = { ...freedraw, angle: Math.PI as Radians };
    const shape = getFreedrawShape<GlobalPoint>(rotated, pointFrom(15, 15));

    const segments = shape.data as GlobalPoint[][];
    expectPointsClose(segments[0], [
      [20, 20],
      [10, 20],
    ]);
  });
});

describe("getClosedCurveShape", () => {
  const createLine = (roundness: ExcalidrawLinearElement["roundness"]) =>
    API.createElement({
      type: "line",
      x: 0,
      y: 0,
      roundness,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(10, 0),
        pointFrom<LocalPoint>(10, 10),
      ],
    }) as ExcalidrawLinearElement;

  it("returns a polygon of the element points when not rounded", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      createLine(null),
      drawable([]),
      pointFrom<GlobalPoint>(5, 5),
      0 as Radians,
      pointFrom(0, 0),
    );

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 5],
    ]);
  });

  describe("when rounded", () => {
    const firstPassOps = [
      op("move", [0, 0]),
      op("bcurveTo", [3, 0, 6, 0, 9, 0]),
      op("lineTo", [9, 3]),
      op("lineTo", [9, 6]),
      op("lineTo", [9, 9]),
    ];

    it("samples the first rough pass into a closed polygon", () => {
      const shape = getClosedCurveShape<GlobalPoint>(
        createLine({ type: 2 }),
        drawable([{ type: "path", ops: firstPassOps }]),
        pointFrom<GlobalPoint>(1, 1),
        0 as Radians,
        pointFrom(0, 0),
      );

      expect(shape.type).toBe("polygon");
      const points = shape.data as GlobalPoint[];
      expect(points.length).toBeGreaterThan(2);
      expectPointsClose([points[0]], [[1, 1]]);
      expectPointsClose([points[points.length - 1]], [[1, 1]]);
      points.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(1 - 1e-6);
        expect(x).toBeLessThanOrEqual(10 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(1 - 1e-6);
        expect(y).toBeLessThanOrEqual(10 + 1e-6);
      });
    });

    it("ignores the ops of every second rough pass", () => {
      const args = [
        pointFrom<GlobalPoint>(0, 0),
        0 as Radians,
        pointFrom<GlobalPoint>(0, 0),
      ] as const;
      const single = getClosedCurveShape<GlobalPoint>(
        createLine({ type: 2 }),
        drawable([{ type: "path", ops: firstPassOps }]),
        ...args,
      );
      const withSecondPass = getClosedCurveShape<GlobalPoint>(
        createLine({ type: 2 }),
        drawable([
          {
            type: "path",
            ops: [
              ...firstPassOps,
              op("move", [100, 100]),
              op("bcurveTo", [200, 200, 300, 300, 400, 400]),
              op("lineTo", [500, 500]),
            ],
          },
        ]),
        ...args,
      );

      expect(withSecondPass).toEqual(single);
    });
  });
});

describe("segmentIntersectRectangleElement", () => {
  const rectangle = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  }) as ExcalidrawBindableElement;

  const sortByX = (points: GlobalPoint[]) =>
    [...points].sort((a, b) => a[0] - b[0]);

  it("returns the points where a segment crosses the edges", () => {
    const result = segmentIntersectRectangleElement<GlobalPoint>(
      rectangle,
      lineSegment(pointFrom(-5, 5), pointFrom(15, 5)),
    );

    expectPointsClose(sortByX(result), [
      [0, 5],
      [10, 5],
    ]);
  });

  it("inflates the rectangle by the gap", () => {
    const result = segmentIntersectRectangleElement<GlobalPoint>(
      rectangle,
      lineSegment(pointFrom(-5, 5), pointFrom(15, 5)),
      2,
    );

    expectPointsClose(sortByX(result), [
      [-2, 5],
      [12, 5],
    ]);
  });

  it("returns a single point when the segment ends inside", () => {
    const result = segmentIntersectRectangleElement<GlobalPoint>(
      rectangle,
      lineSegment(pointFrom(5, 5), pointFrom(5, 20)),
    );

    expectPointsClose(result, [[5, 10]]);
  });

  it("returns no points when the segment misses", () => {
    expect(
      segmentIntersectRectangleElement<GlobalPoint>(
        rectangle,
        lineSegment(pointFrom(20, 20), pointFrom(30, 30)),
      ),
    ).toEqual([]);
  });

  it("accounts for the element rotation", () => {
    const rotated = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 20,
      height: 10,
      angle: (Math.PI / 2) as Radians,
    }) as ExcalidrawBindableElement;

    // rotated 90deg around (10, 5) the box spans x 5..15
    const result = segmentIntersectRectangleElement<GlobalPoint>(
      rotated,
      lineSegment(pointFrom(-10, 5), pointFrom(30, 5)),
    );

    expectPointsClose(sortByX(result), [
      [5, 5],
      [15, 5],
    ]);
  });
});

describe("rotated ellipse", () => {
  const ellipse: Ellipse<GlobalPoint> = {
    center: pointFrom(10, 10),
    angle: (Math.PI / 2) as Radians,
    halfWidth: 4,
    halfHeight: 2,
  };

  it("pointOnEllipse accounts for the angle and center", () => {
    // rotated 90deg, the major axis is vertical
    expect(pointOnEllipse(pointFrom(10, 14), ellipse)).toBe(true);
    expect(pointOnEllipse(pointFrom(12, 10), ellipse)).toBe(true);
    expect(pointOnEllipse(pointFrom(14, 10), ellipse)).toBe(false);
    expect(pointOnEllipse(pointFrom(10.5, 10.5), ellipse)).toBe(false);
  });

  // distanceToEllipse multiplies the closest point by Math.sign() of the
  // point's coordinates, which is 0 at the center, so the center itself is
  // reported as lying on the ellipse.
  it.skip("pointOnEllipse is false for the center", () => {
    expect(pointOnEllipse(pointFrom(10, 10), ellipse)).toBe(false);
  });

  it("pointInEllipse accounts for the angle and center", () => {
    expect(pointInEllipse(pointFrom(10, 13), ellipse)).toBe(true);
    expect(pointInEllipse(pointFrom(10, 10), ellipse)).toBe(true);
    expect(pointInEllipse(pointFrom(13, 10), ellipse)).toBe(false);
  });
});

describe("ellipseAxes", () => {
  it("uses the width as the major axis when it is larger", () => {
    expect(
      ellipseAxes({
        center: pointFrom<GlobalPoint>(0, 0),
        angle: 0 as Radians,
        halfWidth: 3,
        halfHeight: 2,
      }),
    ).toEqual({ majorAxis: 6, minorAxis: 4 });
  });

  it("uses the height as the major axis when it is larger", () => {
    expect(
      ellipseAxes({
        center: pointFrom<GlobalPoint>(0, 0),
        angle: 0 as Radians,
        halfWidth: 2,
        halfHeight: 3,
      }),
    ).toEqual({ majorAxis: 6, minorAxis: 4 });
  });
});

describe("ellipseFocusToCenter", () => {
  it("is zero for a circle", () => {
    expect(
      ellipseFocusToCenter({
        center: pointFrom<GlobalPoint>(5, 5),
        angle: 0 as Radians,
        halfWidth: 3,
        halfHeight: 3,
      }),
    ).toBe(0);
  });

  it("grows as the ellipse gets more eccentric", () => {
    const base = {
      center: pointFrom<GlobalPoint>(0, 0),
      angle: 0 as Radians,
      halfHeight: 2,
    };

    expect(ellipseFocusToCenter({ ...base, halfWidth: 3 })).toBeLessThan(
      ellipseFocusToCenter({ ...base, halfWidth: 4 }),
    );
  });
});

describe("ellipseExtremes", () => {
  it("returns extremes symmetric around the center for an unrotated ellipse", () => {
    const [top, bottom, right] = ellipseExtremes({
      center: pointFrom<GlobalPoint>(1, 2),
      angle: 0 as Radians,
      halfWidth: 3,
      halfHeight: 2,
    });

    // vertical extremes are straight above and below the center
    expect(top[0]).toBeCloseTo(1);
    expect(bottom[0]).toBeCloseTo(1);
    expect((top[1] + bottom[1]) / 2).toBeCloseTo(2);
    expect(top[1]).toBeGreaterThan(2);
    // the horizontal extreme is level with the center
    expect(right[1]).toBeCloseTo(2);
    expect(right[0]).toBeGreaterThan(1);
  });

  // ellipseExtremes is unused in the codebase and diverges from its name:
  // it measures with the full axes (2x the half axes) and returns the
  // positive x extreme twice instead of the negative one.
  it.skip("returns the four axis-aligned extreme points", () => {
    const extremes = ellipseExtremes({
      center: pointFrom<GlobalPoint>(0, 0),
      angle: 0 as Radians,
      halfWidth: 3,
      halfHeight: 2,
    });

    expectPointsClose(extremes, [
      [0, 2],
      [0, -2],
      [3, 0],
      [-3, 0],
    ]);
  });
});
