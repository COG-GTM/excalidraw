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
  curvePointAtLength,
  curvePointDistance,
  isCurve,
  offsetPointsForQuadraticBezier,
} from "../src/curve";
import { pointDistance, pointFrom } from "../src/point";
import { lineSegment } from "../src/segment";

import type { GlobalPoint } from "../src/types";

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

  describe("closest point tolerance", () => {
    it("returns null when the tolerance is wider than the search window", () => {
      const c = curve(
        pointFrom(-50, -50),
        pointFrom(10, -50),
        pointFrom(10, 50),
        pointFrom(50, 50),
      );

      expect(curveClosestPoint(c, pointFrom(0, 0), 1)).toBe(null);
    });

    it("finds the start point when it is the closest", () => {
      const c = curve(
        pointFrom(0, 0),
        pointFrom(10, 0),
        pointFrom(20, 0),
        pointFrom(30, 0),
      );

      expect([curveClosestPoint(c, pointFrom(-10, 5))]).toCloselyEqualPoints([
        [0, 0],
      ]);
      // the bisection stops within `tolerance` of t = 0, i.e. ~0.015px away
      expect(curvePointDistance(c, pointFrom(-10, 0))).toBeCloseTo(10, 1);
    });
  });

  describe("isCurve", () => {
    it("accepts four valid points", () => {
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, 1],
          [3, 0],
        ]),
      ).toBe(true);
    });

    it("rejects the wrong number of points", () => {
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, 1],
        ]),
      ).toBe(false);
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, 1],
          [3, 0],
          [4, 0],
        ]),
      ).toBe(false);
    });

    it("rejects invalid points and non-arrays", () => {
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, NaN],
          [3, 0],
        ]),
      ).toBe(false);
      expect(isCurve([[0, 0], [1, 1], [2, 1], "not-a-point"])).toBe(false);
      expect(isCurve(null)).toBe(false);
      expect(isCurve(undefined)).toBe(false);
      expect(isCurve("curve")).toBe(false);
    });
  });

  describe("Catmull-Rom quadratic approximation", () => {
    it("returns undefined for fewer than 2 points", () => {
      expect(curveCatmullRomQuadraticApproxPoints([])).toBe(undefined);
      expect(
        curveCatmullRomQuadraticApproxPoints([pointFrom<GlobalPoint>(1, 1)]),
      ).toBe(undefined);
    });

    it("returns one control/end point pair per segment", () => {
      const result = curveCatmullRomQuadraticApproxPoints([
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(10, 0),
        pointFrom<GlobalPoint>(10, 10),
      ]);

      expect(result).toEqual([
        [
          [2.5, 0],
          [10, 0],
        ],
        [
          [12.5, 2.5],
          [10, 10],
        ],
      ]);
    });

    it("places the control point on the start point when tension is 0", () => {
      const result = curveCatmullRomQuadraticApproxPoints(
        [
          pointFrom<GlobalPoint>(0, 0),
          pointFrom<GlobalPoint>(10, 0),
          pointFrom<GlobalPoint>(10, 10),
        ],
        0,
      );

      expect(result).toEqual([
        [
          [0, 0],
          [10, 0],
        ],
        [
          [10, 0],
          [10, 10],
        ],
      ]);
    });
  });

  describe("Catmull-Rom cubic approximation", () => {
    it("returns undefined for fewer than 2 points", () => {
      expect(curveCatmullRomCubicApproxPoints([])).toBe(undefined);
      expect(
        curveCatmullRomCubicApproxPoints([pointFrom<GlobalPoint>(1, 1)]),
      ).toBe(undefined);
    });

    it("approximates two points with a straight cubic curve", () => {
      expect(
        curveCatmullRomCubicApproxPoints([
          pointFrom<GlobalPoint>(0, 0),
          pointFrom<GlobalPoint>(9, 0),
        ]),
      ).toEqual([
        [
          [0, 0],
          [1.5, 0],
          [7.5, 0],
          [9, 0],
        ],
      ]);
    });
  });

  describe("quadratic bezier offset points", () => {
    it("offsets a straight quadratic along its normal", () => {
      expect(
        offsetPointsForQuadraticBezier(
          pointFrom(0, 0),
          pointFrom(5, 0),
          pointFrom(10, 0),
          2,
          4,
        ),
      ).toCloselyEqualPoints([
        [0, -2],
        [2.5, -2],
        [5, -2],
        [7.5, -2],
        [10, -2],
      ]);
    });

    it("flips sides for a negative offset", () => {
      expect(
        offsetPointsForQuadraticBezier(
          pointFrom(0, 0),
          pointFrom(5, 0),
          pointFrom(10, 0),
          -2,
          2,
        ),
      ).toCloselyEqualPoints([
        [0, 2],
        [5, 2],
        [10, 2],
      ]);
    });

    it("returns points on the curve itself for a zero offset", () => {
      const points = offsetPointsForQuadraticBezier(
        pointFrom(0, 0),
        pointFrom(5, 10),
        pointFrom(10, 0),
        0,
        2,
      );

      expect(points).toCloselyEqualPoints([
        [0, 0],
        [5, 5],
        [10, 0],
      ]);
    });

    it("keeps every point at the offset distance from the curve", () => {
      const p0 = pointFrom<GlobalPoint>(0, 0);
      const p1 = pointFrom<GlobalPoint>(5, 10);
      const p2 = pointFrom<GlobalPoint>(10, 0);
      const points = offsetPointsForQuadraticBezier(p0, p1, p2, 3);

      expect(points).toHaveLength(51);
      points.forEach((point, i) => {
        const t = i / 50;
        const onCurve = pointFrom<GlobalPoint>(
          (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
          (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
        );
        expect(pointDistance(point, onCurve)).toBeCloseTo(3);
      });
    });
  });

  describe("length along the curve", () => {
    // control points evenly spaced on a line give a constant-speed curve
    const straight = curve(
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(20, 0),
      pointFrom(30, 0),
    );
    const bent = curve(
      pointFrom(0, 0),
      pointFrom(0, 50),
      pointFrom(50, 50),
      pointFrom(50, 0),
    );

    it("returns 0 length at or before the start", () => {
      expect(curveLengthAtParameter(straight, 0)).toBe(0);
      expect(curveLengthAtParameter(straight, -1)).toBe(0);
    });

    it("returns the full length at or after the end", () => {
      expect(curveLengthAtParameter(bent, 1)).toBe(curveLength(bent));
      expect(curveLengthAtParameter(bent, 2)).toBe(curveLength(bent));
    });

    it("returns proportional lengths on a constant-speed curve", () => {
      expect(curveLength(straight)).toBeCloseTo(30);
      expect(curveLengthAtParameter(straight, 0.5)).toBeCloseTo(15);
      expect(curveLengthAtParameter(straight, 0.25)).toBeCloseTo(7.5);
    });

    it("grows monotonically with the parameter", () => {
      const lengths = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) =>
        curveLengthAtParameter(bent, t),
      );

      for (let i = 1; i < lengths.length; i++) {
        expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
      }
      expect(lengths[lengths.length - 1]).toBeLessThan(curveLength(bent));
    });
  });

  describe("point at length", () => {
    const straight = curve(
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(20, 0),
      pointFrom(30, 0),
    );

    it("clamps to the start point", () => {
      expect(curvePointAtLength(straight, 0)).toEqual(pointFrom(0, 0));
      expect(curvePointAtLength(straight, -0.5)).toEqual(pointFrom(0, 0));
    });

    it("clamps to the end point", () => {
      expect(curvePointAtLength(straight, 1)).toEqual(pointFrom(30, 0));
      expect(curvePointAtLength(straight, 1.5)).toEqual(pointFrom(30, 0));
    });

    it("finds the point at a fraction of the length", () => {
      expect([curvePointAtLength(straight, 0.5)]).toCloselyEqualPoints([
        [15, 0],
      ]);
    });

    it("splits a symmetric curve in half at its midpoint", () => {
      const bent = curve(
        pointFrom(0, 0),
        pointFrom(0, 50),
        pointFrom(50, 50),
        pointFrom(50, 0),
      );

      expect([curvePointAtLength(bent, 0.5)]).toCloselyEqualPoints([
        bezierEquation(bent, 0.5),
      ]);
    });
  });
});
