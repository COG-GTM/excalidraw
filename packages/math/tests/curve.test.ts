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
  actual: readonly number[] | null,
  [x, y]: [number, number],
  digits = 2,
) => {
  expect(actual).not.toBe(null);
  expect(actual![0]).toBeCloseTo(x, digits);
  expect(actual![1]).toBeCloseTo(y, digits);
};

// An S-shaped curve going from the top left to the bottom right
const sCurve = curve<GlobalPoint>(
  pointFrom(-50, -50),
  pointFrom(10, -50),
  pointFrom(10, 50),
  pointFrom(50, 50),
);

// A straight curve with evenly spaced control points, i.e. constant speed
const straight = curve<GlobalPoint>(
  pointFrom(0, 0),
  pointFrom(10, 0),
  pointFrom(20, 0),
  pointFrom(30, 0),
);

// A straight curve which starts and ends slowly (ease-in-out)
const eased = curve<GlobalPoint>(
  pointFrom(0, 0),
  pointFrom(0, 0),
  pointFrom(30, 0),
  pointFrom(30, 0),
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

  describe("line segment intersection edge cases", () => {
    it("returns no points when the segment misses the curve", () => {
      expect(
        curveIntersectLineSegment(
          sCurve,
          lineSegment(pointFrom(-100, 100), pointFrom(100, 100)),
        ),
      ).toEqual([]);
    });

    it("returns no points when the segment stops short of the curve", () => {
      expect(
        curveIntersectLineSegment(
          sCurve,
          lineSegment(pointFrom(-100, 0), pointFrom(-10, 0)),
        ),
      ).toEqual([]);
    });

    it("finds intersections close to either end of the curve", () => {
      const nearStart = curveIntersectLineSegment(
        sCurve,
        lineSegment(pointFrom(-100, -45), pointFrom(100, -45)),
      );
      const nearEnd = curveIntersectLineSegment(
        sCurve,
        lineSegment(pointFrom(-100, 45), pointFrom(100, 45)),
      );

      expect(nearStart).toHaveLength(1);
      expectPointCloseTo(nearStart[0], [-28.69, -45]);
      expect(nearEnd).toHaveLength(1);
      expectPointCloseTo(nearEnd[0], [35.71, 45]);
    });

    it("gives up when the iteration limit is too low", () => {
      const l = lineSegment<GlobalPoint>(
        pointFrom(-100, 45),
        pointFrom(100, 45),
      );

      expect(curveIntersectLineSegment(sCurve, l, { iterLimit: 1 })).toEqual(
        [],
      );
      expect(
        curveIntersectLineSegment(sCurve, l, { iterLimit: 4 }),
      ).toHaveLength(1);
    });

    it("gets more precise with a lower tolerance", () => {
      const [point] = curveIntersectLineSegment(
        sCurve,
        lineSegment(pointFrom(-100, 40), pointFrom(100, 40)),
        { tolerance: 1e-6, iterLimit: 20 },
      );

      expect(point[1]).toBeCloseTo(40, 5);
    });
  });

  describe("bezier equation", () => {
    it("returns the end points at t=0 and t=1", () => {
      expect(bezierEquation(sCurve, 0)).toEqual([-50, -50]);
      expect(bezierEquation(sCurve, 1)).toEqual([50, 50]);
    });

    it("returns the point for the parameter in between", () => {
      expect(bezierEquation(sCurve, 0.5)).toEqual([7.5, 0]);
      expectPointCloseTo(bezierEquation(straight, 0.25), [7.5, 0]);
    });
  });

  describe("closest point edge cases", () => {
    it("returns the point itself when it lies on the curve", () => {
      const onCurve = bezierEquation(sCurve, 0.5);
      const closest = curveClosestPoint(sCurve, onCurve);

      // The search tolerance applies to the curve parameter, not the distance
      expect(closest).not.toBe(null);
      expect(Math.hypot(closest![0] - 7.5, closest![1])).toBeLessThan(0.2);
    });

    it("finds the start of the curve for a point before it", () => {
      expectPointCloseTo(
        curveClosestPoint(sCurve, pointFrom(-60, -60)),
        [-50, -50],
        0,
      );
    });

    it("finds the end of the curve for a point after it", () => {
      expectPointCloseTo(
        curveClosestPoint(sCurve, pointFrom(60, 60)),
        [50, 50],
        0,
      );
    });

    it("returns null when the tolerance is wider than the search window", () => {
      expect(curveClosestPoint(sCurve, pointFrom(0, 0), 1)).toBe(null);
    });

    it("measures next to no distance for a point on the curve", () => {
      const distance = curvePointDistance(sCurve, bezierEquation(sCurve, 0.5));

      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThan(0.2);
    });

    it("measures the distance to a straight curve", () => {
      expect(curvePointDistance(straight, pointFrom(15, 4))).toBeCloseTo(4);
    });
  });

  describe("isCurve", () => {
    it("accepts four points", () => {
      expect(isCurve(sCurve)).toBe(true);
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
      expect(isCurve([...sCurve, pointFrom(0, 0)])).toBe(false);
    });

    it("rejects values which are not points", () => {
      expect(isCurve([[0, 0], [1, 1], [2, 2], "3,3"])).toBe(false);
      expect(
        isCurve([
          [0, 0],
          [1, 1],
          [2, NaN],
          [3, 3],
        ]),
      ).toBe(false);
      expect(isCurve([[0, 0], [1], [2, 2], [3, 3]])).toBe(false);
      expect(isCurve([null, [1, 1], [2, 2], [3, 3]])).toBe(false);
    });

    it("rejects non-arrays", () => {
      expect(isCurve(null)).toBe(false);
      expect(isCurve(undefined)).toBe(false);
      expect(isCurve({ length: 4 })).toBe(false);
    });
  });

  describe("tangent", () => {
    it("points along a straight curve with constant speed", () => {
      expect(curveTangent(straight, 0)).toEqual([30, 0]);
      expect(curveTangent(straight, 0.5)).toEqual([30, 0]);
      expect(curveTangent(straight, 1)).toEqual([30, 0]);
    });

    it("follows the control points at the ends of the curve", () => {
      // 3 * (p1 - p0) at the start, 3 * (p3 - p2) at the end
      expect(curveTangent(sCurve, 0)).toEqual([180, 0]);
      expect(curveTangent(sCurve, 1)).toEqual([120, 0]);
    });

    it("vanishes where the control points coincide", () => {
      expect(curveTangent(eased, 0)).toEqual([0, 0]);
    });
  });

  describe("Catmull-Rom approximation", () => {
    const points: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(20, 10),
    ];

    it("needs at least two points", () => {
      expect(curveCatmullRomQuadraticApproxPoints([])).toBe(undefined);
      expect(curveCatmullRomQuadraticApproxPoints([points[0]])).toBe(undefined);
      expect(curveCatmullRomCubicApproxPoints([])).toBe(undefined);
      expect(curveCatmullRomCubicApproxPoints([points[0]])).toBe(undefined);
    });

    it("creates a quadratic control point and end point per segment", () => {
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

    it("scales the quadratic control points with the tension", () => {
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

    it("creates a cubic curve per segment going through the points", () => {
      const curves = curveCatmullRomCubicApproxPoints(points)!;

      expect(curves).toHaveLength(2);
      expect(curves.every((c) => isCurve(c))).toBe(true);
      expect(curves[0][0]).toEqual(points[0]);
      expect(curves[0][3]).toEqual(points[1]);
      expect(curves[1][0]).toEqual(points[1]);
      expect(curves[1][3]).toEqual(points[2]);
    });

    it("places the cubic control points along the neighbouring points", () => {
      const [first] = curveCatmullRomCubicApproxPoints([
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(30, 0),
      ])!;

      expect(first).toEqual([
        [0, 0],
        [5, 0],
        [25, 0],
        [30, 0],
      ]);
    });

    it("collapses the cubic control points with zero tension", () => {
      const curves = curveCatmullRomCubicApproxPoints(points, 0)!;

      expect(curves[1]).toEqual([points[1], points[1], points[2], points[2]]);
    });
  });

  describe("offset points", () => {
    it("offsets a cubic curve along its normal", () => {
      const offsetPoints = curveOffsetPoints(straight, 2, 3);

      expect(offsetPoints).toHaveLength(4);
      [0, 10, 20, 30].forEach((x, idx) => {
        expectPointCloseTo(offsetPoints[idx], [x, -2]);
      });
    });

    it("offsets a cubic curve to the other side with a negative offset", () => {
      const offsetPoints = curveOffsetPoints(straight, -2, 1);

      expectPointCloseTo(offsetPoints[0], [0, 2]);
      expectPointCloseTo(offsetPoints[1], [30, 2]);
    });

    it("offsets a quadratic curve along its normal", () => {
      const offsetPoints = offsetPointsForQuadraticBezier(
        pointFrom(0, 0),
        pointFrom(5, 0),
        pointFrom(10, 0),
        2,
        2,
      );

      expect(offsetPoints).toHaveLength(3);
      [0, 5, 10].forEach((x, idx) => {
        expectPointCloseTo(offsetPoints[idx], [x, -2]);
      });
    });

    it("keeps the offset distance on a bent quadratic curve", () => {
      const p0 = pointFrom<GlobalPoint>(0, 0);
      const p1 = pointFrom<GlobalPoint>(10, 0);
      const p2 = pointFrom<GlobalPoint>(10, 10);
      const offsetPoints = offsetPointsForQuadraticBezier(p0, p1, p2, 3, 10);

      // The curve starts heading right and ends heading down
      expectPointCloseTo(offsetPoints[0], [0, -3]);
      expectPointCloseTo(offsetPoints[10], [13, 10]);
    });

    it("samples 50 steps by default", () => {
      expect(
        offsetPointsForQuadraticBezier(
          pointFrom(0, 0),
          pointFrom(5, 0),
          pointFrom(10, 0),
          1,
        ),
      ).toHaveLength(51);
      expect(curveOffsetPoints(straight, 1)).toHaveLength(51);
    });
  });

  describe("length", () => {
    it("measures a straight curve", () => {
      expect(curveLength(straight)).toBeCloseTo(30);
      expect(curveLength(eased)).toBeCloseTo(30);
    });

    it("is longer than the distance between the ends of a bent curve", () => {
      const length = curveLength(sCurve);

      expect(length).toBeGreaterThan(Math.hypot(100, 100));
      // ...and shorter than the control polygon
      expect(length).toBeLessThan(60 + 100 + 40);
    });

    it("measures nothing up to the start of the curve", () => {
      expect(curveLengthAtParameter(sCurve, 0)).toBe(0);
      expect(curveLengthAtParameter(sCurve, -1)).toBe(0);
    });

    it("measures the full length at the end of the curve and beyond", () => {
      expect(curveLengthAtParameter(sCurve, 1)).toBe(curveLength(sCurve));
      expect(curveLengthAtParameter(sCurve, 2)).toBe(curveLength(sCurve));
    });

    it("measures the partial length up to a parameter", () => {
      expect(curveLengthAtParameter(straight, 0.5)).toBeCloseTo(15);
      expect(curveLengthAtParameter(straight, 0.1)).toBeCloseTo(3);
      // The eased curve covers 90t² - 60t³ of its length at t
      expect(curveLengthAtParameter(eased, 0.25)).toBeCloseTo(4.6875);
    });

    it("grows with the parameter", () => {
      const lengths = [0.2, 0.4, 0.6, 0.8, 1].map((t) =>
        curveLengthAtParameter(sCurve, t),
      );

      expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
      expect(new Set(lengths).size).toBe(lengths.length);
    });
  });

  describe("point at length", () => {
    it("returns the start of the curve for zero or negative percentages", () => {
      expect(curvePointAtLength(sCurve, 0)).toEqual([-50, -50]);
      expect(curvePointAtLength(sCurve, -0.5)).toEqual([-50, -50]);
    });

    it("returns the end of the curve for percentages of one or more", () => {
      expect(curvePointAtLength(sCurve, 1)).toEqual([50, 50]);
      expect(curvePointAtLength(sCurve, 1.5)).toEqual([50, 50]);
    });

    it("returns the point at the percentage of a constant speed curve", () => {
      expectPointCloseTo(curvePointAtLength(straight, 0.5), [15, 0]);
      expectPointCloseTo(curvePointAtLength(straight, 0.9), [27, 0]);
    });

    it("searches for the parameter on a curve with varying speed", () => {
      // t=0.25 is only 15.6% of the way, t=0.75 is already 84.4% of the way
      expectPointCloseTo(curvePointAtLength(eased, 0.25), [7.5, 0], 1);
      expectPointCloseTo(curvePointAtLength(eased, 0.75), [22.5, 0], 1);
    });

    it("returns the midpoint of a symmetric curve at half its length", () => {
      const symmetric = curve<GlobalPoint>(
        pointFrom(-50, -50),
        pointFrom(10, -50),
        pointFrom(-10, 50),
        pointFrom(50, 50),
      );

      expectPointCloseTo(curvePointAtLength(symmetric, 0.5), [0, 0], 1);
    });
  });
});
