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
import { pointDistance, pointFrom } from "../src/point";
import { lineSegment } from "../src/segment";

import type { GlobalPoint } from "../src/types";

const p = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

// Straight 100px cubic with evenly spaced control points (t is linear in x)
const straight = curve(p(0, 0), p(100 / 3, 0), p(200 / 3, 0), p(100, 0));
// Straight 100px cubic with non-uniform parameterization (t is NOT linear in x)
const straightNonUniform = curve(p(0, 0), p(25, 0), p(75, 0), p(100, 0));
// Symmetric quarter-circle approximation of radius 100
const K = 55.228474983079;
const arc = curve(p(100, 0), p(100, K), p(K, 100), p(0, 100));
const degenerate = curve(p(5, 5), p(5, 5), p(5, 5), p(5, 5));

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

  describe("isCurve", () => {
    it("accepts four points", () => {
      expect(isCurve(arc)).toBe(true);
      expect(isCurve([p(0, 0), p(1, 1), p(2, 2), p(3, 3)])).toBe(true);
    });

    it.each([
      ["three points", [p(0, 0), p(1, 1), p(2, 2)]],
      ["five points", [p(0, 0), p(1, 1), p(2, 2), p(3, 3), p(4, 4)]],
      ["a non-point member", [p(0, 0), p(1, 1), "x", p(3, 3)]],
      ["a NaN point", [p(0, 0), p(1, 1), [NaN, 2], p(3, 3)]],
      ["null", null],
      ["a non-array", { 0: p(0, 0) }],
    ])("rejects %s", (_, v) => {
      expect(isCurve(v)).toBe(false);
    });
  });

  describe("curveTangent", () => {
    it("equals 3 * (p1 - p0) at t = 0", () => {
      const [x, y] = curveTangent(arc, 0);
      expect(x).toBeCloseTo(3 * (arc[1][0] - arc[0][0]));
      expect(y).toBeCloseTo(3 * (arc[1][1] - arc[0][1]));
    });

    it("equals 3 * (p3 - p2) at t = 1", () => {
      const [x, y] = curveTangent(arc, 1);
      expect(x).toBeCloseTo(3 * (arc[3][0] - arc[2][0]));
      expect(y).toBeCloseTo(3 * (arc[3][1] - arc[2][1]));
    });

    it("is constant along a uniformly parameterized straight curve", () => {
      [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
        const [x, y] = curveTangent(straight, t);
        expect(x).toBeCloseTo(100);
        expect(y).toBeCloseTo(0);
      });
    });
  });

  describe("curveLength", () => {
    it("measures a straight curve", () => {
      expect(Math.abs(curveLength(straight) - 100)).toBeLessThan(1e-6);
      expect(Math.abs(curveLength(straightNonUniform) - 100)).toBeLessThan(
        1e-6,
      );
    });

    it("measures a quarter-circle approximation", () => {
      expect(curveLength(arc)).toBeCloseTo((Math.PI / 2) * 100, 1);
    });

    it("is 0 for a zero-length curve", () => {
      expect(curveLength(degenerate)).toBeCloseTo(0, 10);
    });
  });

  describe("curveLengthAtParameter", () => {
    it("is 0 for t <= 0", () => {
      expect(curveLengthAtParameter(arc, 0)).toBe(0);
      expect(curveLengthAtParameter(arc, -0.5)).toBe(0);
    });

    it("equals the full length for t >= 1", () => {
      expect(curveLengthAtParameter(arc, 1)).toBe(curveLength(arc));
      expect(curveLengthAtParameter(arc, 1.5)).toBe(curveLength(arc));
    });

    it.each([0.1, 0.25, 0.5, 0.9])(
      "is proportional to t on a uniform straight curve (t = %f)",
      (t) => {
        expect(curveLengthAtParameter(straight, t)).toBeCloseTo(100 * t, 6);
      },
    );

    it("matches the analytic length on a non-uniform straight curve", () => {
      // x(t) = 75t + 75t^2 - 50t^3 for control points (0, 25, 75, 100)
      [0.2, 0.5, 0.8].forEach((t) => {
        const x = 75 * t + 75 * t * t - 50 * t * t * t;
        expect(curveLengthAtParameter(straightNonUniform, t)).toBeCloseTo(x, 6);
      });
    });

    it("splits a symmetric arc in half at t = 0.5", () => {
      expect(curveLengthAtParameter(arc, 0.5)).toBeCloseTo(
        curveLength(arc) / 2,
        6,
      );
    });

    it("is monotonically increasing", () => {
      let prev = 0;
      for (let t = 0.05; t < 1; t += 0.05) {
        const len = curveLengthAtParameter(arc, t);
        expect(len).toBeGreaterThan(prev);
        prev = len;
      }
    });
  });

  describe("curvePointAtLength", () => {
    it("returns the start point for percent <= 0", () => {
      expect(curvePointAtLength(arc, 0)).toEqual(arc[0]);
      expect(curvePointAtLength(arc, -1)).toEqual(arc[0]);
    });

    it("returns the end point for percent >= 1", () => {
      expect(curvePointAtLength(arc, 1)).toEqual(arc[3]);
      expect(curvePointAtLength(arc, 2)).toEqual(arc[3]);
    });

    it("finds the midpoint of a straight curve", () => {
      expect([curvePointAtLength(straight, 0.5)]).toCloselyEqualPoints([
        [50, 0],
      ]);
    });

    it.each([0.1, 0.25, 0.5, 0.75, 0.9])(
      "finds the point by arc length, not by t, on a non-uniform curve (%f)",
      (percent) => {
        const [x, y] = curvePointAtLength(straightNonUniform, percent);
        expect(Math.abs(x - percent * 100)).toBeLessThan(0.05);
        expect(y).toBe(0);
      },
    );

    it("differs from the parametric point on a non-uniform curve", () => {
      const byT = bezierEquation(straightNonUniform, 0.25);
      const byLength = curvePointAtLength(straightNonUniform, 0.25);
      expect(Math.abs(byT[0] - byLength[0])).toBeGreaterThan(1);
    });

    it("finds the parametric midpoint of a symmetric arc", () => {
      expect([curvePointAtLength(arc, 0.5)]).toCloselyEqualPoints([
        bezierEquation(arc, 0.5),
      ]);
    });

    it("returns the only point of a zero-length curve", () => {
      expect([curvePointAtLength(degenerate, 0.5)]).toCloselyEqualPoints([
        [5, 5],
      ]);
    });
  });

  describe("curveCatmullRomCubicApproxPoints", () => {
    it("returns undefined for fewer than 2 points", () => {
      expect(curveCatmullRomCubicApproxPoints([])).toBeUndefined();
      expect(curveCatmullRomCubicApproxPoints([p(1, 1)])).toBeUndefined();
    });

    it("returns one segment between two points", () => {
      const curves = curveCatmullRomCubicApproxPoints([p(0, 0), p(30, 0)])!;
      expect(curves).toHaveLength(1);
      const [start, cp1, cp2, end] = curves[0];
      expect(start).toEqual([0, 0]);
      expect(end).toEqual([30, 0]);
      // Ends are clamped, so tangents are (p2 - p1) * tension
      expect(cp1[0]).toBeCloseTo(5);
      expect(cp2[0]).toBeCloseTo(25);
    });

    it("returns C0-continuous segments through every input point", () => {
      const points = [p(0, 0), p(10, 20), p(30, 10), p(40, 40)];
      const curves = curveCatmullRomCubicApproxPoints(points)!;
      expect(curves).toHaveLength(3);
      curves.forEach((c, i) => {
        expect(c[0]).toEqual(points[i]);
        expect(c[3]).toEqual(points[i + 1]);
        if (i > 0) {
          expect(c[0]).toEqual(curves[i - 1][3]);
        }
      });
    });

    it("computes control points from neighbours with the tension", () => {
      const points = [p(0, 0), p(10, 0), p(20, 0), p(30, 0)];
      const [, middle] = curveCatmullRomCubicApproxPoints(points)!;
      expect(middle[1][0]).toBeCloseTo(10 + 10 / 3);
      expect(middle[2][0]).toBeCloseTo(20 - 10 / 3);

      const [, tight] = curveCatmullRomCubicApproxPoints(points, 0)!;
      expect(tight[1]).toEqual([10, 0]);
      expect(tight[2]).toEqual([20, 0]);
    });
  });

  describe("curveCatmullRomQuadraticApproxPoints", () => {
    it("returns undefined for fewer than 2 points", () => {
      expect(curveCatmullRomQuadraticApproxPoints([])).toBeUndefined();
      expect(curveCatmullRomQuadraticApproxPoints([p(1, 1)])).toBeUndefined();
    });

    it("returns one [control, end] pair between two points", () => {
      const sets = curveCatmullRomQuadraticApproxPoints([p(0, 0), p(10, 0)])!;
      expect(sets).toHaveLength(1);
      expect(sets[0][0][0]).toBeCloseTo(2.5);
      expect(sets[0][0][1]).toBeCloseTo(0);
      expect(sets[0][1]).toEqual([10, 0]);
    });

    it("ends each pair on the next input point", () => {
      const points = [p(0, 0), p(10, 20), p(30, 10), p(40, 40)];
      const sets = curveCatmullRomQuadraticApproxPoints(points)!;
      expect(sets).toHaveLength(3);
      sets.forEach(([, end], i) => {
        expect(end).toEqual(points[i + 1]);
      });
    });
  });

  describe("curveOffsetPoints", () => {
    it("offsets a straight curve by the normal at every step", () => {
      const points = curveOffsetPoints(straight, 10);
      expect(points).toHaveLength(51);
      points.forEach((pt, i) => {
        expect(pt[0]).toBeCloseTo((i / 50) * 100);
        expect(pt[1]).toBeCloseTo(-10);
      });
    });

    it("respects the step count and negative offsets", () => {
      const points = curveOffsetPoints(straight, -4, 4);
      expect(points).toHaveLength(5);
      points.forEach((pt) => expect(pt[1]).toBeCloseTo(4));
    });

    it("keeps every point |offset| away from the curve point", () => {
      const steps = 20;
      const points = curveOffsetPoints(arc, 7, steps);
      points.forEach((pt, i) => {
        expect(pointDistance(pt, bezierEquation(arc, i / steps))).toBeCloseTo(
          7,
        );
      });
    });
  });

  describe("offsetPointsForQuadraticBezier", () => {
    it("offsets a straight quadratic curve", () => {
      const points = offsetPointsForQuadraticBezier(
        p(0, 0),
        p(50, 0),
        p(100, 0),
        5,
        10,
      );
      expect(points).toHaveLength(11);
      points.forEach((pt, i) => {
        expect(pt[0]).toBeCloseTo(i * 10);
        expect(pt[1]).toBeCloseTo(-5);
      });
    });

    it("keeps every point |offset| away from the curve", () => {
      const p0 = p(0, 0);
      const p1 = p(50, 100);
      const p2 = p(100, 0);
      const steps = 8;
      const points = offsetPointsForQuadraticBezier(p0, p1, p2, 3, steps);
      points.forEach((pt, i) => {
        const t = i / steps;
        const onCurve = p(
          (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
          (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
        );
        expect(pointDistance(pt, onCurve)).toBeCloseTo(3);
      });
    });
  });
});
