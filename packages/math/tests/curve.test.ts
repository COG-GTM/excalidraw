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

const expectPointCloseTo = (
  [x, y]: readonly [number, number],
  [ex, ey]: readonly [number, number],
  digits = 5,
) => {
  expect(x).toBeCloseTo(ex, digits);
  expect(y).toBeCloseTo(ey, digits);
};

// A straight, uniformly parameterized curve along the x axis: length 30,
// tangent (30, 0) everywhere.
const straight = curve<GlobalPoint>(
  pointFrom(0, 0),
  pointFrom(10, 0),
  pointFrom(20, 0),
  pointFrom(30, 0),
);

const sCurve = curve<GlobalPoint>(
  pointFrom(-50, -50),
  pointFrom(10, -50),
  pointFrom(10, 50),
  pointFrom(50, 50),
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
    it("returns no points when the segment does not reach the curve", () => {
      expect(
        curveIntersectLineSegment(
          straight,
          lineSegment(pointFrom(0, 10), pointFrom(30, 10)),
        ),
      ).toEqual([]);
    });

    it("returns no points when the line would cross past the segment's end", () => {
      expect(
        curveIntersectLineSegment(
          straight,
          lineSegment(pointFrom(15, 20), pointFrom(15, 10)),
        ),
      ).toEqual([]);
    });

    it("finds the crossing of a perpendicular segment", () => {
      const [p, ...rest] = curveIntersectLineSegment(
        straight,
        lineSegment(pointFrom(15, -10), pointFrom(15, 10)),
      );

      expect(rest).toHaveLength(0);
      expectPointCloseTo(p, [15, 0], 1);
    });
  });

  describe("bezierEquation", () => {
    it("starts and ends at the curve's end points", () => {
      expect(bezierEquation(sCurve, 0)).toEqual([-50, -50]);
      expect(bezierEquation(sCurve, 1)).toEqual([50, 50]);
    });

    it("evaluates the cubic polynomial in between", () => {
      // (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3 at t = 0.5
      expectPointCloseTo(bezierEquation(sCurve, 0.5), [7.5, 0]);
      expectPointCloseTo(bezierEquation(straight, 0.25), [7.5, 0]);
    });
  });

  describe("closest point edge cases", () => {
    it("returns null when the tolerance is wider than the search window", () => {
      expect(curveClosestPoint(sCurve, pointFrom(0, 0), 1)).toBeNull();
    });

    it("finds a closest point at the very start of the curve", () => {
      const p = curveClosestPoint(straight, pointFrom(-10, 0));

      expect(p).not.toBeNull();
      expectPointCloseTo(p!, [0, 0], 1);
    });

    it("reports zero distance for a point on the curve", () => {
      expect(curvePointDistance(straight, pointFrom(12, 0))).toBeLessThan(0.05);
    });
  });

  describe("isCurve", () => {
    it("accepts four points", () => {
      expect(isCurve(sCurve)).toBe(true);
    });

    it("rejects the wrong number of points or invalid points", () => {
      expect(isCurve(sCurve.slice(0, 3))).toBe(false);
      expect(isCurve([...sCurve, pointFrom(0, 0)])).toBe(false);
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, 2],
          [3, NaN],
        ]),
      ).toBe(false);
      expect(isCurve("curve")).toBe(false);
    });
  });

  describe("curveTangent", () => {
    it("is the scaled direction from P0 to P1 at the start", () => {
      expect(curveTangent(sCurve, 0)).toEqual([180, 0]);
    });

    it("is the scaled direction from P2 to P3 at the end", () => {
      expect(curveTangent(sCurve, 1)).toEqual([120, 0]);
    });

    it("is constant for a uniformly parameterized straight curve", () => {
      expectPointCloseTo(curveTangent(straight, 0.3), [30, 0]);
      expectPointCloseTo(curveTangent(straight, 0.7), [30, 0]);
    });
  });

  describe("curveLength", () => {
    it("matches the length of a straight curve", () => {
      expect(curveLength(straight)).toBeCloseTo(30);
    });

    it("is longer than the chord for a bent curve", () => {
      const chord = Math.hypot(100, 100);

      expect(curveLength(sCurve)).toBeGreaterThan(chord);
    });
  });

  describe("curveLengthAtParameter", () => {
    it("is zero at or before the start", () => {
      expect(curveLengthAtParameter(straight, 0)).toBe(0);
      expect(curveLengthAtParameter(straight, -1)).toBe(0);
    });

    it("is the full length at or after the end", () => {
      expect(curveLengthAtParameter(straight, 1)).toBe(curveLength(straight));
      expect(curveLengthAtParameter(straight, 2)).toBe(curveLength(straight));
    });

    it("measures a partial length", () => {
      expect(curveLengthAtParameter(straight, 0.5)).toBeCloseTo(15);
      expect(curveLengthAtParameter(straight, 0.1)).toBeCloseTo(3);
    });
  });

  describe("curvePointAtLength", () => {
    it("clamps to the end points outside [0, 1]", () => {
      expect(curvePointAtLength(sCurve, 0)).toEqual([-50, -50]);
      expect(curvePointAtLength(sCurve, -0.5)).toEqual([-50, -50]);
      expect(curvePointAtLength(sCurve, 1)).toEqual([50, 50]);
      expect(curvePointAtLength(sCurve, 1.5)).toEqual([50, 50]);
    });

    it("finds the point at a fraction of the length", () => {
      expectPointCloseTo(curvePointAtLength(straight, 0.25), [7.5, 0], 1);
      expectPointCloseTo(curvePointAtLength(straight, 0.8), [24, 0], 1);
    });

    it("finds the arc-length midpoint of a point-symmetric bent curve", () => {
      const symmetric = curve<GlobalPoint>(
        pointFrom(-50, -50),
        pointFrom(10, -50),
        pointFrom(-10, 50),
        pointFrom(50, 50),
      );

      expectPointCloseTo(curvePointAtLength(symmetric, 0.5), [0, 0], 1);
    });
  });

  describe("Catmull-Rom approximation", () => {
    it("returns undefined for fewer than two points", () => {
      expect(curveCatmullRomQuadraticApproxPoints([])).toBeUndefined();
      expect(
        curveCatmullRomQuadraticApproxPoints([pointFrom<GlobalPoint>(0, 0)]),
      ).toBeUndefined();
      expect(curveCatmullRomCubicApproxPoints([])).toBeUndefined();
      expect(
        curveCatmullRomCubicApproxPoints([pointFrom<GlobalPoint>(0, 0)]),
      ).toBeUndefined();
    });

    it("builds one quadratic control point per segment", () => {
      const sets = curveCatmullRomQuadraticApproxPoints([
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(10, 0),
        pointFrom<GlobalPoint>(20, 10),
      ])!;

      expect(sets).toEqual([
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

    it("uses the tension to scale the quadratic control point", () => {
      const sets = curveCatmullRomQuadraticApproxPoints(
        [pointFrom<GlobalPoint>(0, 0), pointFrom<GlobalPoint>(10, 0)],
        1,
      )!;

      expect(sets).toEqual([
        [
          [5, 0],
          [10, 0],
        ],
      ]);
    });

    it("builds one cubic curve per segment through the input points", () => {
      const points = [
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(10, 0),
        pointFrom<GlobalPoint>(20, 10),
      ];
      const curves = curveCatmullRomCubicApproxPoints(points)!;

      expect(curves).toHaveLength(2);
      expect(curves[0][0]).toEqual(points[0]);
      expect(curves[0][3]).toEqual(points[1]);
      expect(curves[1][0]).toEqual(points[1]);
      expect(curves[1][3]).toEqual(points[2]);
      expectPointCloseTo(curves[0][1], [5 / 3, 0]);
      expectPointCloseTo(curves[0][2], [10 - 10 / 3, -5 / 3]);
      expectPointCloseTo(curves[1][1], [10 + 10 / 3, 5 / 3]);
      expectPointCloseTo(curves[1][2], [20 - 5 / 3, 10 - 5 / 3]);
    });
  });

  describe("offset points", () => {
    it("offsets a cubic curve along its normal", () => {
      const points = curveOffsetPoints(straight, 5, 2);

      expect(points).toHaveLength(3);
      expectPointCloseTo(points[0], [0, -5]);
      expectPointCloseTo(points[1], [15, -5]);
      expectPointCloseTo(points[2], [30, -5]);
    });

    it("samples steps + 1 points by default", () => {
      expect(curveOffsetPoints(straight, 1)).toHaveLength(51);
    });

    it("offsets a quadratic bezier along its normal", () => {
      const points = offsetPointsForQuadraticBezier(
        pointFrom(0, 0),
        pointFrom(5, 0),
        pointFrom(10, 0),
        -2,
        2,
      );

      expect(points).toHaveLength(3);
      expectPointCloseTo(points[0], [0, 2]);
      expectPointCloseTo(points[1], [5, 2]);
      expectPointCloseTo(points[2], [10, 2]);
      expect(
        offsetPointsForQuadraticBezier(
          pointFrom(0, 0),
          pointFrom(5, 5),
          pointFrom(10, 0),
          1,
        ),
      ).toHaveLength(51);
    });
  });
});
