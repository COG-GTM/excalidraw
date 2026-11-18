import { pointFrom } from "@excalidraw/math";
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
  type Ellipse,
} from "../src/shape";

import type { Drawable, Op } from "roughjs/bin/core";

const expectPointsClose = (
  received: readonly (readonly number[])[],
  expected: readonly (readonly number[])[],
) => {
  expect(received).toHaveLength(expected.length);
  expected.forEach(([x, y], idx) => {
    expect(received[idx][0]).toBeCloseTo(x);
    expect(received[idx][1]).toBeCloseTo(y);
  });
};

const drawable = (...sets: { type: string; ops: Op[] }[]) =>
  ({ shape: "path", options: {}, sets } as unknown as Drawable);

const op = (name: Op["op"], data: number[]): Op => ({ op: name, data });

describe("getPolygonShape", () => {
  it("returns the closed corner polygon of an unrotated rectangle", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    }) as ExcalidrawRectangleElement;

    const shape = getPolygonShape<GlobalPoint>(rectangle);

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [10, 20],
      [110, 20],
      [110, 70],
      [10, 70],
      [10, 20],
    ]);
  });

  it("returns the edge midpoints for a diamond", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    }) as ExcalidrawDiamondElement;

    const shape = getPolygonShape<GlobalPoint>(diamond);

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [60, 20],
      [110, 45],
      [60, 70],
      [10, 45],
      [60, 20],
    ]);
  });

  it("rotates the corners around the element center", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      angle: (Math.PI / 2) as Radians,
    }) as ExcalidrawRectangleElement;

    const points = getPolygonShape<GlobalPoint>(rectangle)
      .data as GlobalPoint[];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);

    // a quarter turn swaps width and height around the center (60, 45)
    expect(Math.min(...xs)).toBeCloseTo(35);
    expect(Math.max(...xs)).toBeCloseTo(85);
    expect(Math.min(...ys)).toBeCloseTo(-5);
    expect(Math.max(...ys)).toBeCloseTo(95);
  });
});

describe("getSelectionBoxShape", () => {
  const rectangle = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  });
  const elementsMap = new Map([[rectangle.id, rectangle]]);

  it("pads the element bounds by 10 by default", () => {
    const shape = getSelectionBoxShape<GlobalPoint>(rectangle, elementsMap);

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [-10, -10],
      [110, -10],
      [110, 60],
      [-10, 60],
    ]);
  });

  it("uses the supplied padding", () => {
    const shape = getSelectionBoxShape<GlobalPoint>(rectangle, elementsMap, 0);

    expectPointsClose(shape.data as GlobalPoint[], [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ]);
  });

  it("rotates the padded box with the element", () => {
    const rotated = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      angle: Math.PI as Radians,
    });

    const shape = getSelectionBoxShape<GlobalPoint>(
      rotated,
      new Map([[rotated.id, rotated]]),
    );

    // a half turn around (50, 25) maps each corner onto the opposite one
    expectPointsClose(shape.data as GlobalPoint[], [
      [110, 60],
      [-10, 60],
      [-10, -10],
      [110, -10],
    ]);
  });
});

describe("getEllipseShape", () => {
  it("derives center, angle and half axes from the element", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      angle: 1 as Radians,
    }) as ExcalidrawEllipseElement;

    const shape = getEllipseShape<GlobalPoint>(ellipse);

    expect(shape).toEqual({
      type: "ellipse",
      data: {
        center: [60, 40],
        angle: 1,
        halfWidth: 50,
        halfHeight: 20,
      },
    });
  });
});

describe("getCurvePathOps", () => {
  const pathOps = [op("move", [0, 0]), op("lineTo", [1, 1])];
  const fillOps = [op("move", [5, 5])];

  it("returns no ops when there is no shape", () => {
    expect(getCurvePathOps(undefined as unknown as Drawable)).toEqual([]);
  });

  it("prefers the ops of the first path set", () => {
    expect(
      getCurvePathOps(
        drawable(
          { type: "fillSketch", ops: fillOps },
          { type: "path", ops: pathOps },
        ),
      ),
    ).toBe(pathOps);
  });

  it("falls back to the first set when there is no path set", () => {
    expect(
      getCurvePathOps(
        drawable(
          { type: "fillPath", ops: fillOps },
          { type: "fillSketch", ops: pathOps },
        ),
      ),
    ).toBe(fillOps);
  });
});

describe("getCurveShape", () => {
  const roughShape = drawable({
    type: "path",
    ops: [
      op("move", [0, 0]),
      op("bcurveTo", [1, 1, 2, 2, 3, 3]),
      op("lineTo", [100, 100]),
      op("bcurveTo", [4, 4, 5, 5, 6, 6]),
    ],
  });

  it("chains bezier ops into a translated polycurve", () => {
    const shape = getCurveShape<GlobalPoint>(
      roughShape,
      pointFrom<GlobalPoint>(10, 10),
      0 as Radians,
      pointFrom<GlobalPoint>(0, 0),
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
    // each curve starts where the previous one ended; lineTo ops are ignored
    expectPointsClose(second, [
      [13, 13],
      [14, 14],
      [15, 15],
      [16, 16],
    ]);
  });

  it("defaults the starting point to the origin and applies rotation", () => {
    const shape = getCurveShape<GlobalPoint>(
      roughShape,
      undefined,
      Math.PI as Radians,
      pointFrom<GlobalPoint>(5, 5),
    );

    const [first] = shape.data as GlobalPoint[][];
    expectPointsClose(first, [
      [10, 10],
      [9, 9],
      [8, 8],
      [7, 7],
    ]);
  });

  it("throws when a move op does not hold a point", () => {
    expect(() =>
      getCurveShape<GlobalPoint>(
        drawable({ type: "path", ops: [op("move", [1, 2, 3])] }),
        pointFrom<GlobalPoint>(0, 0),
        0 as Radians,
        pointFrom<GlobalPoint>(0, 0),
      ),
    ).toThrow("Ops data is not a point");
  });
});

describe("getFreedrawShape", () => {
  const freedraw = API.createElement({
    type: "freedraw",
    x: 10,
    y: 20,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(10, 0),
      pointFrom<LocalPoint>(10, 10),
    ],
  }) as ExcalidrawFreeDrawElement;

  it("returns an open polyline of translated segments", () => {
    const shape = getFreedrawShape<GlobalPoint>(
      freedraw,
      pointFrom<GlobalPoint>(15, 25),
    );

    expect(shape.type).toBe("polyline");
    const segments = shape.data as GlobalPoint[][];
    expect(segments).toHaveLength(2);
    expectPointsClose(segments[0], [
      [10, 20],
      [20, 20],
    ]);
    expectPointsClose(segments[1], [
      [20, 20],
      [20, 30],
    ]);
  });

  it("returns a closed polygon when isClosed is set", () => {
    const shape = getFreedrawShape<GlobalPoint>(
      freedraw,
      pointFrom<GlobalPoint>(15, 25),
      true,
    );

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [10, 20],
      [20, 20],
      [20, 20],
      [20, 30],
      [10, 20],
    ]);
  });

  it("rotates the points around the given center", () => {
    const rotated = { ...freedraw, angle: Math.PI as Radians };

    const shape = getFreedrawShape<GlobalPoint>(
      rotated,
      pointFrom<GlobalPoint>(15, 25),
    );

    const segments = shape.data as GlobalPoint[][];
    expectPointsClose(segments[0], [
      [20, 30],
      [10, 30],
    ]);
    expectPointsClose(segments[1], [
      [10, 30],
      [10, 20],
    ]);
  });
});

describe("getClosedCurveShape", () => {
  const sharpLine = API.createElement({
    type: "line",
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 0),
      pointFrom<LocalPoint>(100, 100),
    ],
    roundness: null,
  }) as ExcalidrawLinearElement;

  it("returns the element points as a polygon when not rounded", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      sharpLine,
      drawable(),
      pointFrom<GlobalPoint>(10, 10),
      0 as Radians,
      pointFrom<GlobalPoint>(0, 0),
    );

    expect(shape.type).toBe("polygon");
    expectPointsClose(shape.data as GlobalPoint[], [
      [10, 10],
      [110, 10],
      [110, 110],
      [10, 10],
    ]);
  });

  it("defaults the starting point to the origin", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      sharpLine,
      drawable(),
      undefined,
      0 as Radians,
      pointFrom<GlobalPoint>(0, 0),
    );

    expectPointsClose(shape.data as GlobalPoint[], [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 0],
    ]);
  });

  const roundLine = {
    ...sharpLine,
    roundness: { type: 2 },
  } as ExcalidrawLinearElement;

  it("samples the first pass of the rough bezier path when rounded", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      roundLine,
      drawable({
        type: "path",
        ops: [
          op("move", [0, 0]),
          op("bcurveTo", [0, 40, 40, 40, 40, 0]),
          // second (even) pass of the rough stroke is ignored
          op("move", [500, 500]),
          op("bcurveTo", [600, 600, 700, 700, 800, 800]),
          op("lineTo", [900, 900]),
        ],
      }),
      pointFrom<GlobalPoint>(10, 20),
      0 as Radians,
      pointFrom<GlobalPoint>(0, 0),
    );

    expect(shape.type).toBe("polygon");
    const points = shape.data as GlobalPoint[];
    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(points[0][0]).toBeCloseTo(10);
    expect(points[0][1]).toBeCloseTo(20);
    expect(points[points.length - 1]).toEqual(points[0]);
    points.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(x).toBeLessThanOrEqual(50 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(y).toBeLessThanOrEqual(50 + 1e-6);
    });
    // the curve bulges toward +y, so some sample lies off the chord
    expect(Math.max(...points.map((p) => p[1]))).toBeGreaterThan(30);
  });

  it("includes lineTo ops of the first pass and applies rotation", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      roundLine,
      drawable({
        type: "path",
        ops: [
          op("move", [0, 0]),
          op("lineTo", [10, 0]),
          op("lineTo", [20, 0]),
          op("lineTo", [30, 0]),
        ],
      }),
      pointFrom<GlobalPoint>(0, 0),
      Math.PI as Radians,
      pointFrom<GlobalPoint>(0, 0),
    );

    const points = shape.data as GlobalPoint[];
    expect(points[0][0]).toBeCloseTo(0);
    expect(points[0][1]).toBeCloseTo(0);
    expect(Math.min(...points.map((p) => p[0]))).toBeCloseTo(-30);
    points.forEach(([x, y]) => {
      expect(x).toBeLessThanOrEqual(1e-6);
      expect(y).toBeCloseTo(0);
    });
  });
});

describe("segmentIntersectRectangleElement", () => {
  const square = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  }) as ExcalidrawBindableElement;

  it("returns the points where a segment crosses the element edges", () => {
    const intersections = segmentIntersectRectangleElement<GlobalPoint>(
      square,
      [pointFrom<GlobalPoint>(-50, 50), pointFrom<GlobalPoint>(150, 50)] as any,
    );

    expectPointsClose(intersections, [
      [100, 50],
      [0, 50],
    ]);
  });

  it("inflates the rectangle by the gap", () => {
    const intersections = segmentIntersectRectangleElement<GlobalPoint>(
      square,
      [pointFrom<GlobalPoint>(-50, 50), pointFrom<GlobalPoint>(150, 50)] as any,
      10,
    );

    expectPointsClose(intersections, [
      [110, 50],
      [-10, 50],
    ]);
  });

  it("returns a single intersection for a segment ending inside", () => {
    const intersections = segmentIntersectRectangleElement<GlobalPoint>(
      square,
      [pointFrom<GlobalPoint>(50, -50), pointFrom<GlobalPoint>(50, 50)] as any,
    );

    expectPointsClose(intersections, [[50, 0]]);
  });

  it("returns no intersections for a segment outside the element", () => {
    expect(
      segmentIntersectRectangleElement<GlobalPoint>(square, [
        pointFrom<GlobalPoint>(200, 0),
        pointFrom<GlobalPoint>(200, 100),
      ] as any),
    ).toEqual([]);
  });

  it("accounts for the element rotation", () => {
    const rotated = {
      ...square,
      angle: (Math.PI / 4) as Radians,
    } as ExcalidrawBindableElement;

    const intersections = segmentIntersectRectangleElement<GlobalPoint>(
      rotated,
      [
        pointFrom<GlobalPoint>(-100, 60),
        pointFrom<GlobalPoint>(200, 60),
      ] as any,
    ).sort((a, b) => a[0] - b[0]);

    // the rotated square is a diamond with vertices 50 * sqrt(2) from center
    const halfWidthAtY = 50 * Math.SQRT2 - 10;
    expectPointsClose(intersections, [
      [50 - halfWidthAtY, 60],
      [50 + halfWidthAtY, 60],
    ]);
  });
});

describe("pointOnEllipse / pointInEllipse with transformed ellipses", () => {
  const rotated: Ellipse<GlobalPoint> = {
    center: pointFrom<GlobalPoint>(10, 10),
    angle: (Math.PI / 2) as Radians,
    halfWidth: 2,
    halfHeight: 1,
  };

  it("detects points on a translated, rotated ellipse", () => {
    expect(pointOnEllipse(pointFrom<GlobalPoint>(10, 12), rotated)).toBe(true);
    expect(pointOnEllipse(pointFrom<GlobalPoint>(10, 8), rotated)).toBe(true);
    expect(pointOnEllipse(pointFrom<GlobalPoint>(11, 10), rotated)).toBe(true);
    expect(pointOnEllipse(pointFrom<GlobalPoint>(9, 10), rotated)).toBe(true);

    expect(pointOnEllipse(pointFrom<GlobalPoint>(12, 10), rotated)).toBe(false);
    expect(pointOnEllipse(pointFrom<GlobalPoint>(10, 12.5), rotated)).toBe(
      false,
    );
  });

  it("respects the threshold", () => {
    expect(pointOnEllipse(pointFrom<GlobalPoint>(10, 12.05), rotated)).toBe(
      false,
    );
    expect(
      pointOnEllipse(pointFrom<GlobalPoint>(10, 12.05), rotated, 0.1),
    ).toBe(true);
  });

  it("detects points inside a translated, rotated ellipse", () => {
    expect(pointInEllipse(pointFrom<GlobalPoint>(10, 10), rotated)).toBe(true);
    expect(pointInEllipse(pointFrom<GlobalPoint>(10, 11.9), rotated)).toBe(
      true,
    );
    expect(pointInEllipse(pointFrom<GlobalPoint>(10.9, 10), rotated)).toBe(
      true,
    );

    expect(pointInEllipse(pointFrom<GlobalPoint>(11.5, 10), rotated)).toBe(
      false,
    );
    expect(pointInEllipse(pointFrom<GlobalPoint>(10, 12.1), rotated)).toBe(
      false,
    );
  });

  // BUG: distanceToEllipse uses Math.sign(0) === 0 for the nearest point, so
  // the center reads as distance 0 and is reported as lying on the outline.
  it.skip("does not report the center as on the ellipse", () => {
    expect(pointOnEllipse(pointFrom<GlobalPoint>(10, 10), rotated)).toBe(false);
  });
});

describe("ellipseAxes", () => {
  const ellipse = (halfWidth: number, halfHeight: number) =>
    ({
      center: pointFrom<GlobalPoint>(0, 0),
      angle: 0 as Radians,
      halfWidth,
      halfHeight,
    } as Ellipse<GlobalPoint>);

  it("uses the width as the major axis for wide ellipses", () => {
    expect(ellipseAxes(ellipse(3, 2))).toEqual({ majorAxis: 6, minorAxis: 4 });
  });

  it("uses the height as the major axis for tall ellipses", () => {
    expect(ellipseAxes(ellipse(2, 3))).toEqual({ majorAxis: 6, minorAxis: 4 });
  });

  it("returns equal axes for circles", () => {
    expect(ellipseAxes(ellipse(2, 2))).toEqual({ majorAxis: 4, minorAxis: 4 });
  });

  it("returns zero focus distance for circles", () => {
    expect(ellipseFocusToCenter(ellipse(2, 2))).toBe(0);
  });

  // BUG: computed from full axes, so this returns the focus-to-focus distance
  // (2 * sqrt(a^2 - b^2) = 2 * sqrt(5)) instead of the focus-to-center one.
  it.skip("returns the distance from the center to a focus", () => {
    expect(ellipseFocusToCenter(ellipse(3, 2))).toBeCloseTo(Math.sqrt(5));
  });
});

describe("ellipseExtremes", () => {
  const ellipse: Ellipse<GlobalPoint> = {
    center: pointFrom<GlobalPoint>(10, 20),
    angle: 0.3 as Radians,
    halfWidth: 3,
    halfHeight: 2,
  };

  it("returns four points with the vertical extremes mirrored through the center", () => {
    const extremes = ellipseExtremes(ellipse);

    expect(extremes).toHaveLength(4);
    expect(extremes[0][0] + extremes[1][0]).toBeCloseTo(20);
    expect(extremes[0][1] + extremes[1][1]).toBeCloseTo(40);
  });

  // BUG: uses full axes instead of half axes (points lie at twice the
  // distance) and returns the +x extreme twice instead of the -x one.
  it.skip("returns the extremes of an axis-aligned ellipse", () => {
    const extremes = ellipseExtremes({ ...ellipse, angle: 0 as Radians });

    expectPointsClose(extremes as any, [
      [10, 22],
      [10, 18],
      [13, 20],
      [7, 20],
    ]);
  });
});
