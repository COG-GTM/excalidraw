import "@excalidraw/utils/test-utils";

import {
  curve,
  curveCatmullRomCubicApproxPoints,
  curveCatmullRomQuadraticApproxPoints,
  curveClosestPoint,
  curveIntersectLineSegment,
  curveLength,
  curveLengthAtParameter,
  curvePointAtLength,
  curvePointDistance,
  curveTangent,
  isCurve,
  offsetPointsForQuadraticBezier,
} from "../src/curve";
import { pointFrom } from "../src/point";
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

  describe("line segment non-intersection", () => {
    it("returns no points when the segment is away from the curve", () => {
      const c = curve(
        pointFrom(0, 0),
        pointFrom(0, 10),
        pointFrom(10, 10),
        pointFrom(10, 0),
      );
      const l = lineSegment(pointFrom(100, 100), pointFrom(200, 100));

      expect(curveIntersectLineSegment(c, l)).toEqual([]);
    });
  });

  describe("closest point edge cases", () => {
    const c = curve(
      pointFrom(-50, -50),
      pointFrom(10, -50),
      pointFrom(10, 50),
      pointFrom(50, 50),
    );

    it("returns null when the tolerance exceeds the search window", () => {
      expect(curveClosestPoint(c, pointFrom(0, 0), 1)).toBe(null);
    });

    it("finds the start of the curve for a point beyond it", () => {
      const closest = curveClosestPoint(c, pointFrom(-100, -50));

      expect(closest).not.toBe(null);
      expect(closest![0]).toBeCloseTo(-50, 0);
      expect(closest![1]).toBeCloseTo(-50, 0);
    });

    it("measures a near-zero distance for a point on the curve", () => {
      expect(curvePointDistance(c, pointFrom(7.5, 0))).toBeLessThan(0.5);
    });
  });

  describe("isCurve", () => {
    it("accepts four points", () => {
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
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, 2],
        ]),
      ).toBe(false);
    });

    it("rejects non-point members and non-arrays", () => {
      expect(isCurve([[0, 0], [1, 1], [2, 2], "not-a-point"])).toBe(false);
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, 2],
          [3, NaN],
        ]),
      ).toBe(false);
      expect(isCurve(null)).toBe(false);
      expect(isCurve("curve")).toBe(false);
    });
  });

  describe("tangent", () => {
    const c = curve(
      pointFrom(-50, -50),
      pointFrom(10, -50),
      pointFrom(10, 50),
      pointFrom(50, 50),
    );

    it("points along the first control leg at the start", () => {
      expect(curveTangent(c, 0)).toEqual([180, 0]);
    });

    it("points along the last control leg at the end", () => {
      expect(curveTangent(c, 1)).toEqual([120, 0]);
    });

    it("can be determined at the midpoint", () => {
      expect(curveTangent(c, 0.5)).toEqual([75, 150]);
    });
  });

  describe("Catmull-Rom quadratic approximation", () => {
    it("returns undefined for fewer than two points", () => {
      expect(curveCatmullRomQuadraticApproxPoints([])).toBe(undefined);
      expect(
        curveCatmullRomQuadraticApproxPoints([pointFrom<GlobalPoint>(0, 0)]),
      ).toBe(undefined);
    });

    it("returns a control point and end point per segment", () => {
      const points = [
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(10, 0),
        pointFrom<GlobalPoint>(20, 10),
      ];

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

    it("uses the segment start as control point with zero tension", () => {
      const points = [
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(10, 0),
        pointFrom<GlobalPoint>(20, 10),
      ];

      expect(curveCatmullRomQuadraticApproxPoints(points, 0)).toEqual([
        [
          [0, 0],
          [10, 0],
        ],
        [
          [10, 0],
          [20, 10],
        ],
      ]);
    });
  });

  describe("Catmull-Rom cubic approximation", () => {
    it("returns undefined for fewer than two points", () => {
      expect(curveCatmullRomCubicApproxPoints([])).toBe(undefined);
      expect(curveCatmullRomCubicApproxPoints([pointFrom(0, 0)])).toBe(
        undefined,
      );
    });

    it("returns one curve for two points", () => {
      expect(
        curveCatmullRomCubicApproxPoints([pointFrom(0, 0), pointFrom(30, 0)]),
      ).toEqual([
        [
          [0, 0],
          [5, 0],
          [25, 0],
          [30, 0],
        ],
      ]);
    });
  });

  describe("quadratic bezier offset points", () => {
    it("offsets a straight curve along its right-hand normal", () => {
      expect(
        offsetPointsForQuadraticBezier(
          pointFrom(0, 0),
          pointFrom(5, 0),
          pointFrom(10, 0),
          2,
          2,
        ),
      ).toEqual([
        [0, -2],
        [5, -2],
        [10, -2],
      ]);
    });

    it("offsets to the other side for a negative distance", () => {
      expect(
        offsetPointsForQuadraticBezier(
          pointFrom(0, 0),
          pointFrom(5, 0),
          pointFrom(10, 0),
          -2,
          1,
        ),
      ).toEqual([
        [0, 2],
        [10, 2],
      ]);
    });

    it("returns steps + 1 points, 51 by default", () => {
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

  describe("length", () => {
    const straight = curve(
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(20, 0),
      pointFrom(30, 0),
    );

    it("can be determined for a straight curve", () => {
      expect(curveLength(straight)).toBeCloseTo(30);
    });

    it("is 0 at or before the start parameter", () => {
      expect(curveLengthAtParameter(straight, 0)).toBe(0);
      expect(curveLengthAtParameter(straight, -1)).toBe(0);
    });

    it("is the full length at or after the end parameter", () => {
      expect(curveLengthAtParameter(straight, 1)).toBe(curveLength(straight));
      expect(curveLengthAtParameter(straight, 2)).toBe(curveLength(straight));
    });

    it("can be determined up to a parameter", () => {
      expect(curveLengthAtParameter(straight, 0.5)).toBeCloseTo(15);
    });
  });

  describe("point at length", () => {
    const c = curve(
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(20, 0),
      pointFrom(30, 0),
    );

    it("returns the start for a percentage of 0 or less", () => {
      expect(curvePointAtLength(c, 0)).toEqual([0, 0]);
      expect(curvePointAtLength(c, -0.5)).toEqual([0, 0]);
    });

    it("returns the end for a percentage of 1 or more", () => {
      expect(curvePointAtLength(c, 1)).toEqual([30, 0]);
      expect(curvePointAtLength(c, 1.5)).toEqual([30, 0]);
    });

    it("returns the point at the given share of the length", () => {
      const [x, y] = curvePointAtLength(c, 0.25);

      expect(x).toBeCloseTo(7.5, 1);
      expect(y).toBeCloseTo(0);
    });
  });
});
