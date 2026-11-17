import { arrayToMap } from "@excalidraw/common";
import { pointFrom, lineSegment } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type {
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
} from "@excalidraw/element/types";
import type {
  Curve,
  GlobalPoint,
  LineSegment,
  LocalPoint,
  Radians,
} from "@excalidraw/math";

import {
  ellipseAxes,
  ellipseFocusToCenter,
  getClosedCurveShape,
  getCurvePathOps,
  getCurveShape,
  getEllipseShape,
  getFreedrawShape,
  getPolygonShape,
  getSelectionBoxShape,
  segmentIntersectRectangleElement,
  type Ellipse,
} from "../src/shape";

import "../src/test-utils";

import type { Drawable, Op } from "roughjs/bin/core";

const drawable = (sets: { type: string; ops: Op[] }[]): Drawable =>
  ({ shape: "path", options: {}, sets } as unknown as Drawable);

const moveOp = (x: number, y: number): Op => ({ op: "move", data: [x, y] });
const lineToOp = (x: number, y: number): Op => ({ op: "lineTo", data: [x, y] });
const bcurveOp = (...data: number[]): Op => ({ op: "bcurveTo", data });

describe("getPolygonShape", () => {
  it("returns the four corners of an unrotated rectangle", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    const shape = getPolygonShape<GlobalPoint>(
      rect as ExcalidrawRectangleElement,
    );

    expect(shape.type).toBe("polygon");
    expect(shape.data).toCloselyEqualPoints([
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
      height: 60,
    });

    const shape = getPolygonShape<GlobalPoint>(
      diamond as ExcalidrawDiamondElement,
    );

    expect(shape.type).toBe("polygon");
    expect(shape.data).toCloselyEqualPoints([
      [50, 0],
      [100, 30],
      [50, 60],
      [0, 30],
      [50, 0],
    ]);
  });

  it("rotates the corners around the element center", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      angle: Math.PI / 2,
    });

    const shape = getPolygonShape<GlobalPoint>(
      rect as ExcalidrawRectangleElement,
    );

    // center (50, 25), 90° rotation maps (x, y) -> (cx - (y - cy), cy + (x - cx))
    expect(shape.data).toCloselyEqualPoints([
      [75, -25],
      [75, 75],
      [25, 75],
      [25, -25],
      [75, -25],
    ]);
  });
});

describe("getSelectionBoxShape", () => {
  const rect = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  });
  const elementsMap = arrayToMap([rect]);

  it("pads the element bounds by 10 by default", () => {
    const shape = getSelectionBoxShape<GlobalPoint>(rect, elementsMap);

    expect(shape.type).toBe("polygon");
    expect(shape.data).toCloselyEqualPoints([
      [-10, -10],
      [110, -10],
      [110, 60],
      [-10, 60],
    ]);
  });

  it("uses the supplied padding", () => {
    const shape = getSelectionBoxShape<GlobalPoint>(rect, elementsMap, 0);

    expect(shape.data).toCloselyEqualPoints([
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
      height: 100,
      angle: Math.PI,
    });

    const shape = getSelectionBoxShape<GlobalPoint>(
      rotated,
      arrayToMap([rotated]),
      5,
    );

    // 180° rotation around (50, 50) swaps opposite corners
    expect(shape.data).toCloselyEqualPoints([
      [105, 105],
      [-5, 105],
      [-5, -5],
      [105, -5],
    ]);
  });
});

describe("getEllipseShape", () => {
  it("derives center, angle and half axes from the element", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 10,
      y: 20,
      width: 80,
      height: 40,
      angle: 1,
    });

    expect(
      getEllipseShape<GlobalPoint>(ellipse as ExcalidrawEllipseElement),
    ).toEqual({
      type: "ellipse",
      data: {
        center: [50, 40],
        angle: 1,
        halfWidth: 40,
        halfHeight: 20,
      },
    });
  });
});

describe("getCurvePathOps", () => {
  it("returns an empty array when there is no shape", () => {
    expect(getCurvePathOps(undefined as unknown as Drawable)).toEqual([]);
  });

  it("returns the ops of the first path set", () => {
    const fillOps = [moveOp(1, 1)];
    const pathOps = [moveOp(0, 0), lineToOp(10, 10)];

    expect(
      getCurvePathOps(
        drawable([
          { type: "fillPath", ops: fillOps },
          { type: "path", ops: pathOps },
        ]),
      ),
    ).toBe(pathOps);
  });

  it("falls back to the first set when there is no path set", () => {
    const fillOps = [moveOp(1, 1)];

    expect(
      getCurvePathOps(
        drawable([
          { type: "fillSketch", ops: fillOps },
          { type: "fillPath", ops: [moveOp(2, 2)] },
        ]),
      ),
    ).toBe(fillOps);
  });
});

describe("getCurveShape", () => {
  it("builds a polycurve from move and bcurveTo ops, offset by the starting point", () => {
    const shape = getCurveShape<GlobalPoint>(
      drawable([
        {
          type: "path",
          ops: [
            moveOp(0, 0),
            bcurveOp(1, 1, 2, 2, 3, 3),
            bcurveOp(4, 4, 5, 5, 6, 6),
            lineToOp(100, 100),
          ],
        },
      ]),
      pointFrom<GlobalPoint>(10, 20),
      0 as Radians,
      pointFrom(0, 0),
    );

    expect(shape.type).toBe("polycurve");
    expect(shape.data).toHaveLength(2);
    expect((shape.data as Curve<GlobalPoint>[])[0]).toCloselyEqualPoints([
      [10, 20],
      [11, 21],
      [12, 22],
      [13, 23],
    ]);
    // second curve starts where the first one ended
    expect((shape.data as Curve<GlobalPoint>[])[1]).toCloselyEqualPoints([
      [13, 23],
      [14, 24],
      [15, 25],
      [16, 26],
    ]);
  });

  it("rotates every control point around the center", () => {
    const shape = getCurveShape<GlobalPoint>(
      drawable([
        { type: "path", ops: [moveOp(10, 0), bcurveOp(10, 0, 0, 10, 0, 10)] },
      ]),
      pointFrom<GlobalPoint>(0, 0),
      Math.PI as Radians,
      pointFrom(0, 0),
    );

    expect((shape.data as Curve<GlobalPoint>[])[0]).toCloselyEqualPoints([
      [-10, 0],
      [-10, 0],
      [0, -10],
      [0, -10],
    ]);
  });

  it("returns an empty polycurve when there is no drawable", () => {
    const shape = getCurveShape<GlobalPoint>(
      undefined as unknown as Drawable,
      undefined,
      0 as Radians,
      pointFrom(0, 0),
    );

    expect(shape).toEqual({ type: "polycurve", data: [] });
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
  });

  it("returns an open polyline of absolute segments by default", () => {
    const shape = getFreedrawShape<GlobalPoint>(freedraw, pointFrom(15, 15));

    expect(shape.type).toBe("polyline");
    expect(shape.data).toHaveLength(2);
    expect((shape.data as LineSegment<GlobalPoint>[])[0]).toCloselyEqualPoints([
      [10, 10],
      [20, 10],
    ]);
    expect((shape.data as LineSegment<GlobalPoint>[])[1]).toCloselyEqualPoints([
      [20, 10],
      [20, 20],
    ]);
  });

  it("returns a closed polygon when isClosed is true", () => {
    const shape = getFreedrawShape<GlobalPoint>(
      freedraw,
      pointFrom(15, 15),
      true,
    );

    expect(shape.type).toBe("polygon");
    const data = shape.data as GlobalPoint[];
    expect(data[0]).toEqual(data[data.length - 1]);
    expect(data).toContainEqual([20, 20]);
  });

  it("rotates the points around the given center", () => {
    const rotated = { ...freedraw, angle: Math.PI as Radians };

    const shape = getFreedrawShape<GlobalPoint>(rotated, pointFrom(15, 15));

    expect((shape.data as LineSegment<GlobalPoint>[])[0]).toCloselyEqualPoints([
      [20, 20],
      [10, 20],
    ]);
  });
});

describe("getClosedCurveShape", () => {
  const line = (roundness: ExcalidrawLinearElement["roundness"]) =>
    ({
      ...API.createElement({
        type: "line",
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(10, 0),
          pointFrom<LocalPoint>(10, 10),
          pointFrom<LocalPoint>(0, 0),
        ],
      }),
      roundness,
    } as ExcalidrawLinearElement);

  it("returns a polygon from the element points when it has no roundness", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      line(null),
      drawable([]),
      pointFrom<GlobalPoint>(5, 5),
      0 as Radians,
      pointFrom(0, 0),
    );

    expect(shape.type).toBe("polygon");
    expect(shape.data).toCloselyEqualPoints([
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 5],
    ]);
  });

  it("samples the rough path ops of rounded elements into a polygon", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      line({ type: 2 }),
      drawable([
        {
          type: "path",
          ops: [
            moveOp(0, 0),
            bcurveOp(0, 0, 10, 0, 10, 0),
            lineToOp(10, 5),
            lineToOp(10, 10),
            lineToOp(0, 0),
            // second (even) stroke of the double-drawn rough path is ignored
            moveOp(500, 500),
            bcurveOp(600, 600, 700, 700, 800, 800),
            lineToOp(900, 900),
          ],
        },
      ]),
      pointFrom<GlobalPoint>(0, 0),
      0 as Radians,
      pointFrom(0, 0),
    );

    expect(shape.type).toBe("polygon");
    const data = shape.data as GlobalPoint[];
    expect(data.length).toBeGreaterThan(2);
    expect(data[0]).toEqual(data[data.length - 1]);
    for (const [x, y] of data) {
      expect(x).toBeGreaterThanOrEqual(-0.001);
      expect(x).toBeLessThanOrEqual(10.001);
      expect(y).toBeGreaterThanOrEqual(-0.001);
      expect(y).toBeLessThanOrEqual(10.001);
    }
  });

  it("offsets and rotates the sampled points", () => {
    const shape = getClosedCurveShape<GlobalPoint>(
      line({ type: 2 }),
      drawable([
        {
          type: "path",
          ops: [
            moveOp(0, 0),
            bcurveOp(0, 0, 10, 0, 10, 0),
            bcurveOp(10, 0, 10, 10, 10, 10),
          ],
        },
      ]),
      pointFrom<GlobalPoint>(100, 100),
      Math.PI as Radians,
      pointFrom(100, 100),
    );

    for (const [x, y] of shape.data as GlobalPoint[]) {
      expect(x).toBeLessThanOrEqual(100.001);
      expect(x).toBeGreaterThanOrEqual(89.999);
      expect(y).toBeLessThanOrEqual(100.001);
      expect(y).toBeGreaterThanOrEqual(89.999);
    }
  });
});

describe("segmentIntersectRectangleElement", () => {
  const rect = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  }) as ExcalidrawRectangleElement;

  it("returns both edge intersections of a segment crossing the element", () => {
    const hits = segmentIntersectRectangleElement<GlobalPoint>(
      rect,
      lineSegment(pointFrom(-50, 50), pointFrom(150, 50)),
    );

    expect(hits).toHaveLength(2);
    expect(hits).toEqual(
      expect.arrayContaining([
        [100, 50],
        [0, 50],
      ]),
    );
  });

  it("returns no intersections for a segment outside the element", () => {
    expect(
      segmentIntersectRectangleElement<GlobalPoint>(
        rect,
        lineSegment(pointFrom(-50, -50), pointFrom(150, -50)),
      ),
    ).toEqual([]);
  });

  it("returns a single intersection for a segment ending inside", () => {
    const hits = segmentIntersectRectangleElement<GlobalPoint>(
      rect,
      lineSegment(pointFrom(50, 50), pointFrom(50, 150)),
    );

    expect(hits).toEqual([[50, 100]]);
  });

  it("inflates the element by the gap", () => {
    const segment = lineSegment<GlobalPoint>(
      pointFrom(-50, -5),
      pointFrom(150, -5),
    );

    expect(segmentIntersectRectangleElement(rect, segment)).toEqual([]);
    expect(segmentIntersectRectangleElement(rect, segment, 10)).toEqual(
      expect.arrayContaining([
        [110, -5],
        [-10, -5],
      ]),
    );
  });

  it("takes the element rotation into account", () => {
    const rotated = { ...rect, angle: (Math.PI / 4) as Radians };
    // the 45° rotated square reaches ~120.7 on the x axis through its center
    const hits = segmentIntersectRectangleElement<GlobalPoint>(
      rotated,
      lineSegment(pointFrom(-50, 50), pointFrom(150, 50)),
    );

    expect(hits).toHaveLength(2);
    const xs = hits.map(([x]) => x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(50 - 50 * Math.SQRT2);
    expect(xs[1]).toBeCloseTo(50 + 50 * Math.SQRT2);
  });
});

describe("ellipse helpers", () => {
  const ellipse = (
    halfWidth: number,
    halfHeight: number,
    angle = 0,
  ): Ellipse<GlobalPoint> => ({
    center: pointFrom(0, 0),
    angle: angle as Radians,
    halfWidth,
    halfHeight,
  });

  it("ellipseAxes uses the width as major axis for wide ellipses", () => {
    expect(ellipseAxes(ellipse(4, 2))).toEqual({ majorAxis: 8, minorAxis: 4 });
  });

  it("ellipseAxes uses the height as major axis for tall ellipses", () => {
    expect(ellipseAxes(ellipse(2, 4))).toEqual({ majorAxis: 8, minorAxis: 4 });
  });

  it("ellipseAxes handles circles", () => {
    expect(ellipseAxes(ellipse(3, 3))).toEqual({ majorAxis: 6, minorAxis: 6 });
  });

  it("ellipseFocusToCenter is zero for a circle", () => {
    expect(ellipseFocusToCenter(ellipse(3, 3))).toBe(0);
  });
});
