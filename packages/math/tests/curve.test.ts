import "@excalidraw/utils/test-utils";

import {
  bezierEquation,
  curve,
  curveCatmullRomCubicApproxPoints,
  curveCatmullRomQuadraticApproxPoints,
  curveClosestPoint,
  curveIntersectLineSegment,
  curveLength,
  curveLengthAtParameter,
  curveOffsetPoints,
  curvePointAtLength,
  curvePointDistance,
  curveTangent,
  isCurve,
  offsetPointsForQuadraticBezier,
} from "../src/curve";
import { pointFrom } from "../src/point";
import { lineSegment } from "../src/segment";

import type { GlobalPoint } from "../src/types";

const expectPointsCloseTo = (
  received: readonly (readonly number[])[],
  expected: readonly (readonly number[])[],
  digits = 6,
) => {
  expect(received.length).toBe(expected.length);
  expected.forEach(([x, y], idx) => {
    expect(received[idx][0]).toBeCloseTo(x, digits);
    expect(received[idx][1]).toBeCloseTo(y, digits);
  });
};

// A straight horizontal curve from 0,0 to 30,0 moving at a constant speed
const straight = curve<GlobalPoint>(
  pointFrom(0, 0),
  pointFrom(10, 0),
  pointFrom(20, 0),
  pointFrom(30, 0),
);

// The same path, but slow at both ends: x(t) = 30 * (3t^2 - 2t^3)
const eased = curve<GlobalPoint>(
  pointFrom(0, 0),
  pointFrom(0, 0),
  pointFrom(30, 0),
  pointFrom(30, 0),
);

// A quarter-circle-like arc from 100,0 to 0,100
const arc = curve<GlobalPoint>(
  pointFrom(100, 0),
  pointFrom(100, 100),
  pointFrom(100, 100),
  pointFrom(0, 100),
);

describe("Math curve", () => {
  describe("line segment intersection", () => {
    it("point is found when control points are the same", () => {
      const c = curve(
        pointFrom(100, 0),
        pointFrom(100, 100),
        pointFrom(100, 100),
        pointFrom(0, 100),
      );
      const l = lineSegment(pointFrom(0, 0), pointFrom(200, 200));

      expect(curveIntersectLineSegment(c, l)).toCloselyEqualPoints([
        [87.5, 87.5],
      ]);
    });

    it("point is found when control points aren't the same", () => {
      const c = curve(
        pointFrom(100, 0),
        pointFrom(100, 60),
        pointFrom(60, 100),
        pointFrom(0, 100),
      );
      const l = lineSegment(pointFrom(0, 0), pointFrom(200, 200));

      expect(curveIntersectLineSegment(c, l)).toCloselyEqualPoints([
        [72.5, 72.5],
      ]);
    });

    it("points are found when curve is sliced at 3 points", () => {
      const c = curve(
        pointFrom(-50, -50),
        pointFrom(10, -50),
        pointFrom(10, 50),
        pointFrom(50, 50),
      );
      const l = lineSegment(pointFrom(10, -60), pointFrom(10, 60));

      expect(curveIntersectLineSegment(c, l)).toCloselyEqualPoints([
        [9.99, 5.05],
      ]);
    });

    it("can be detected where the determinant is overly precise", () => {
      const c = curve(
        pointFrom(41.028864759926016, 12.226249068355052),
        pointFrom(41.028864759926016, 33.55958240168839),
        pointFrom(30.362198093259348, 44.22624906835505),
        pointFrom(9.028864759926016, 44.22624906835505),
      );
      const l = lineSegment(
        pointFrom(-82.30963544324186, -41.19949363038283),

        pointFrom(188.2149592542487, 134.75505940984908),
      );

      expect(curveIntersectLineSegment(c, l)).toCloselyEqualPoints([
        [34.4, 34.71],
      ]);
    });
  });

  describe("point closest to other", () => {
    it("point can be found", () => {
      const c = curve(
        pointFrom(-50, -50),
        pointFrom(10, -50),
        pointFrom(10, 50),
        pointFrom(50, 50),
      );
      const p = pointFrom(0, 0);

      expect([curveClosestPoint(c, p)]).toCloselyEqualPoints([
        [5.965462100367372, -3.04104878946646],
      ]);
    });
  });

  describe("point shortest distance", () => {
    it("can be determined", () => {
      const c = curve(
        pointFrom(-50, -50),
        pointFrom(10, -50),
        pointFrom(10, 50),
        pointFrom(50, 50),
      );
      const p = pointFrom(0, 0);

      expect(curvePointDistance(c, p)).toBeCloseTo(6.695873043213627);
    });
  });

  describe("line segment intersection misses", () => {
    it("returns no points for a segment away from the curve", () => {
      expect(
        curveIntersectLineSegment(
          arc,
          lineSegment(pointFrom(0, 0), pointFrom(10, 10)),
        ),
      ).toEqual([]);
    });

    it("returns no points for a segment parallel to a straight curve", () => {
      expect(
        curveIntersectLineSegment(
          straight,
          lineSegment(pointFrom(0, 5), pointFrom(30, 5)),
        ),
      ).toEqual([]);
    });
  });

  describe("closest point tolerance", () => {
    it("finds the start of the curve for a point behind it", () => {
      const closest = curveClosestPoint(straight, pointFrom(-10, 0));

      expect(closest).not.toBe(null);
      expectPointsCloseTo([closest!], [[0, 0]], 1);
    });

    it("returns null when the tolerance is wider than the search window", () => {
      expect(curveClosestPoint(straight, pointFrom(15, 5), 1)).toBe(null);
    });
  });

  describe("isCurve", () => {
    it("accepts four points", () => {
      expect(isCurve(straight)).toBe(true);
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, 2],
          [3, 3],
        ]),
      ).toBe(true);
    });

    it("rejects the wrong number of points", () => {
      expect(isCurve(straight.slice(0, 3))).toBe(false);
      expect(isCurve([...straight, pointFrom(40, 0)])).toBe(false);
    });

    it("rejects a non-point in any position", () => {
      for (let idx = 0; idx < 4; idx++) {
        const invalid: unknown[] = [...straight];
        invalid[idx] = "not-a-point";

        expect(isCurve(invalid)).toBe(false);
      }
    });

    it("rejects non-arrays", () => {
      expect(isCurve(null)).toBe(false);
      expect(isCurve({ length: 4 })).toBe(false);
    });
  });

  describe("bezier equation and tangent", () => {
    it("evaluates the ends and the middle of the curve", () => {
      expect(bezierEquation(arc, 0)).toEqual([100, 0]);
      expect(bezierEquation(arc, 1)).toEqual([0, 100]);
      expect(bezierEquation(arc, 0.5)).toEqual([87.5, 87.5]);
    });

    it("has a constant tangent on a constant speed straight curve", () => {
      expect(curveTangent(straight, 0)).toEqual([30, 0]);
      expect(curveTangent(straight, 0.5)).toEqual([30, 0]);
      expect(curveTangent(straight, 1)).toEqual([30, 0]);
    });

    it("points towards the control points at the ends", () => {
      expect(curveTangent(arc, 0)).toEqual([0, 300]);
      expect(curveTangent(arc, 1)).toEqual([-300, 0]);
    });

    it("has no tangent where the control point sits on the end point", () => {
      expect(curveTangent(eased, 0)).toEqual([0, 0]);
      expect(curveTangent(eased, 0.5)).toEqual([45, 0]);
    });
  });

  describe("Catmull-Rom approximation", () => {
    const points: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(20, 10),
    ];

    it("needs at least two points", () => {
      expect(curveCatmullRomQuadraticApproxPoints([])).toBeUndefined();
      expect(curveCatmullRomQuadraticApproxPoints([points[0]])).toBeUndefined();
      expect(curveCatmullRomCubicApproxPoints([])).toBeUndefined();
      expect(curveCatmullRomCubicApproxPoints([points[0]])).toBeUndefined();
    });

    it("returns a quadratic control point and end point per segment", () => {
      expect(curveCatmullRomQuadraticApproxPoints(points)).toEqual([
        [
          [2.5, 0],
          [10, 0],
        ],
        [
          [15, 2.5],
          [20, 10],
        ],
      ]);
    });

    it("scales the quadratic control point offset with the tension", () => {
      expect(curveCatmullRomQuadraticApproxPoints(points, 1)).toEqual([
        [
          [5, 0],
          [10, 0],
        ],
        [
          [20, 5],
          [20, 10],
        ],
      ]);
      expect(curveCatmullRomQuadraticApproxPoints(points, 0)).toEqual([
        [points[0], points[1]],
        [points[1], points[2]],
      ]);
    });

    it("returns a cubic curve per segment, passing through the points", () => {
      const curves = curveCatmullRomCubicApproxPoints(points)!;

      expect(curves.length).toBe(2);
      expectPointsCloseTo(curves[0], [
        [0, 0],
        [5 / 3, 0],
        [10 - 10 / 3, -5 / 3],
        [10, 0],
      ]);
      expectPointsCloseTo(curves[1], [
        [10, 0],
        [10 + 10 / 3, 5 / 3],
        [20 - 5 / 3, 10 - 5 / 3],
        [20, 10],
      ]);
    });

    it("collapses the cubic control points onto the ends with no tension", () => {
      const curves = curveCatmullRomCubicApproxPoints(points, 0)!;

      expectPointsCloseTo(curves[0], [
        points[0],
        points[0],
        points[1],
        points[1],
      ]);
    });

    it("returns a single straight cubic curve for two points", () => {
      const curves = curveCatmullRomCubicApproxPoints([points[0], points[1]])!;

      expect(curves.length).toBe(1);
      expectPointsCloseTo(curves[0], [
        [0, 0],
        [5 / 3, 0],
        [10 - 5 / 3, 0],
        [10, 0],
      ]);
    });
  });

  describe("offset points", () => {
    it("offsets a cubic curve along its right-hand normal", () => {
      expectPointsCloseTo(curveOffsetPoints(straight, 5, 2), [
        [0, -5],
        [15, -5],
        [30, -5],
      ]);
    });

    it("offsets a cubic curve to the other side for a negative offset", () => {
      expectPointsCloseTo(curveOffsetPoints(straight, -5, 2), [
        [0, 5],
        [15, 5],
        [30, 5],
      ]);
    });

    it("keeps every offset point at the offset distance from the curve", () => {
      const offsetPoints = curveOffsetPoints(arc, 10);

      expect(offsetPoints.length).toBe(51);
      offsetPoints.forEach((point, idx) => {
        const [x, y] = bezierEquation(arc, idx / 50);

        expect(Math.hypot(point[0] - x, point[1] - y)).toBeCloseTo(10);
      });
      // the arc turns clockwise (y-down), so its right-hand normal faces out
      expectPointsCloseTo(
        [offsetPoints[0], offsetPoints[50]],
        [
          [110, 0],
          [0, 110],
        ],
      );
    });

    it("offsets a quadratic curve along its right-hand normal", () => {
      const p0 = pointFrom<GlobalPoint>(0, 0);
      const p1 = pointFrom<GlobalPoint>(10, 0);
      const p2 = pointFrom<GlobalPoint>(20, 0);

      expectPointsCloseTo(offsetPointsForQuadraticBezier(p0, p1, p2, 5, 2), [
        [0, -5],
        [10, -5],
        [20, -5],
      ]);
      expect(offsetPointsForQuadraticBezier(p0, p1, p2, 5).length).toBe(51);
    });

    it("follows the bend of a quadratic curve", () => {
      const offsetPoints = offsetPointsForQuadraticBezier(
        pointFrom(0, 0),
        pointFrom(10, 0),
        pointFrom(10, 10),
        2,
        2,
      );

      expectPointsCloseTo(offsetPoints, [
        [0, -2],
        [7.5 + Math.SQRT2, 2.5 - Math.SQRT2],
        [12, 10],
      ]);
    });
  });

  describe("length", () => {
    it("measures a straight curve", () => {
      expect(curveLength(straight)).toBeCloseTo(30);
      expect(curveLength(eased)).toBeCloseTo(30);
    });

    it("measures a bent curve longer than its chord, shorter than its hull", () => {
      const length = curveLength(arc);

      expect(length).toBeGreaterThan(Math.hypot(100, 100));
      expect(length).toBeLessThan(200);
    });

    it("measures up to a parameter", () => {
      expect(curveLengthAtParameter(straight, 0.5)).toBeCloseTo(15);
      expect(curveLengthAtParameter(straight, 0.1)).toBeCloseTo(3);
      // x(0.25) = 30 * (3 * 0.25^2 - 2 * 0.25^3)
      expect(curveLengthAtParameter(eased, 0.25)).toBeCloseTo(4.6875);
    });

    it("clamps the parameter to the curve", () => {
      expect(curveLengthAtParameter(arc, 0)).toBe(0);
      expect(curveLengthAtParameter(arc, -1)).toBe(0);
      expect(curveLengthAtParameter(arc, 1)).toBe(curveLength(arc));
      expect(curveLengthAtParameter(arc, 2)).toBe(curveLength(arc));
    });
  });

  describe("point at length", () => {
    it("returns the ends of the curve for out of range percentages", () => {
      expect(curvePointAtLength(arc, 0)).toEqual([100, 0]);
      expect(curvePointAtLength(arc, -0.5)).toEqual([100, 0]);
      expect(curvePointAtLength(arc, 1)).toEqual([0, 100]);
      expect(curvePointAtLength(arc, 1.5)).toEqual([0, 100]);
    });

    it("matches the parameter on a constant speed curve", () => {
      expectPointsCloseTo([curvePointAtLength(straight, 0.5)], [[15, 0]], 1);
      expectPointsCloseTo([curvePointAtLength(straight, 0.2)], [[6, 0]], 1);
    });

    it("goes by length rather than by parameter on an uneven curve", () => {
      // at t = 0.25 the eased curve has only covered 4.6875 of its 30 length
      expectPointsCloseTo([curvePointAtLength(eased, 0.25)], [[7.5, 0]], 1);
      expectPointsCloseTo([curvePointAtLength(eased, 0.9)], [[27, 0]], 1);
    });

    it("finds the middle of a symmetric curve", () => {
      expectPointsCloseTo([curvePointAtLength(arc, 0.5)], [[87.5, 87.5]], 1);
    });
  });
});
