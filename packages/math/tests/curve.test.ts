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
});

const gp = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

// A straight, uniformly parametrized curve along the x axis from 0 to 3.
const straight = curve(gp(0, 0), gp(1, 0), gp(2, 0), gp(3, 0));
// The same segment, but with control points that make the speed non-uniform.
const eased = curve(gp(0, 0), gp(0, 0), gp(3, 0), gp(3, 0));

describe("bezierEquation", () => {
  it("starts and ends at the end points", () => {
    const c = curve(gp(0, 0), gp(10, 20), gp(30, 20), gp(40, 0));
    expect(bezierEquation(c, 0)).toEqual([0, 0]);
    expect(bezierEquation(c, 1)).toEqual([40, 0]);
  });

  it("evaluates intermediate points", () => {
    const c = curve(gp(0, 0), gp(10, 20), gp(30, 20), gp(40, 0));
    const [x, y] = bezierEquation(c, 0.5);
    expect(x).toBeCloseTo(20);
    expect(y).toBeCloseTo(15);
  });
});

describe("isCurve", () => {
  it("accepts four points", () => {
    expect(isCurve(straight)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isCurve([gp(0, 0), gp(1, 1), gp(2, 2)])).toBe(false);
    expect(isCurve([gp(0, 0), gp(1, 1), gp(2, 2), [NaN, 0]])).toBe(false);
    expect(isCurve(null)).toBe(false);
  });
});

describe("curveIntersectLineSegment misses", () => {
  it("returns nothing for a parallel segment", () => {
    expect(
      curveIntersectLineSegment(straight, lineSegment(gp(0, 10), gp(3, 10))),
    ).toEqual([]);
  });

  it("returns nothing when the crossing is beyond the curve", () => {
    expect(
      curveIntersectLineSegment(
        straight,
        lineSegment(gp(100, -10), gp(100, 10)),
      ),
    ).toEqual([]);
  });
});

describe("curveClosestPoint", () => {
  it("returns null when the tolerance is wider than the search window", () => {
    expect(curveClosestPoint(straight, gp(1, 1), 1)).toBeNull();
  });

  it("clamps to the start of the curve", () => {
    const closest = curveClosestPoint(straight, gp(-5, 0))!;
    expect(closest[0]).toBeCloseTo(0, 2);
    expect(closest[1]).toBeCloseTo(0);
  });
});

describe("curveTangent", () => {
  it("is the derivative of the curve", () => {
    const start = curveTangent(straight, 0);
    expect(start[0]).toBeCloseTo(3);
    expect(start[1]).toBeCloseTo(0);

    const mid = curveTangent(straight, 0.5);
    expect(mid[0]).toBeCloseTo(3);
    expect(mid[1]).toBeCloseTo(0);

    const c = curve(gp(0, 0), gp(0, 10), gp(10, 10), gp(10, 0));
    const t0 = curveTangent(c, 0);
    expect(t0[0]).toBeCloseTo(0);
    expect(t0[1]).toBeCloseTo(30);
    const t1 = curveTangent(c, 1);
    expect(t1[0]).toBeCloseTo(0);
    expect(t1[1]).toBeCloseTo(-30);
  });
});

describe("curve length", () => {
  it("measures a straight curve", () => {
    expect(curveLength(straight)).toBeCloseTo(3);
    expect(curveLength(eased)).toBeCloseTo(3);
  });

  it("measures a partial length", () => {
    expect(curveLengthAtParameter(straight, 0)).toBe(0);
    expect(curveLengthAtParameter(straight, -1)).toBe(0);
    expect(curveLengthAtParameter(straight, 1)).toBeCloseTo(3);
    expect(curveLengthAtParameter(straight, 2)).toBeCloseTo(3);
    expect(curveLengthAtParameter(straight, 0.5)).toBeCloseTo(1.5);
    expect(curveLengthAtParameter(straight, 0.25)).toBeCloseTo(0.75);
  });
});

describe("curvePointAtLength", () => {
  it("returns the end points at 0 and 1", () => {
    expect(curvePointAtLength(straight, 0)).toEqual([0, 0]);
    expect(curvePointAtLength(straight, -0.5)).toEqual([0, 0]);
    expect(curvePointAtLength(straight, 1)).toEqual([3, 0]);
    expect(curvePointAtLength(straight, 1.5)).toEqual([3, 0]);
  });

  it("finds the point at a fraction of the length", () => {
    const [x, y] = curvePointAtLength(straight, 0.5);
    expect(x).toBeCloseTo(1.5);
    expect(y).toBeCloseTo(0);
  });

  it("searches when the curve speed is not uniform", () => {
    const [x, y] = curvePointAtLength(eased, 0.25);
    expect(x).toBeCloseTo(0.75, 2);
    expect(y).toBeCloseTo(0);
  });
});

describe("Catmull-Rom approximations", () => {
  const points = [gp(0, 0), gp(10, 0), gp(20, 0)];

  it("needs at least two points", () => {
    expect(curveCatmullRomQuadraticApproxPoints([gp(0, 0)])).toBeUndefined();
    expect(curveCatmullRomCubicApproxPoints([gp(0, 0)])).toBeUndefined();
  });

  it("builds quadratic control points", () => {
    const sets = curveCatmullRomQuadraticApproxPoints(points)!;
    expect(sets).toHaveLength(2);
    expect(sets[0][0][0]).toBeCloseTo(2.5);
    expect(sets[0][0][1]).toBeCloseTo(0);
    expect(sets[0][1]).toEqual([10, 0]);
    expect(sets[1][0][0]).toBeCloseTo(15);
    expect(sets[1][1]).toEqual([20, 0]);
  });

  it("builds cubic curves", () => {
    const curves = curveCatmullRomCubicApproxPoints(points)!;
    expect(curves).toHaveLength(2);
    const expected = [
      [0, 5 / 3, 20 / 3, 10],
      [10, 40 / 3, 55 / 3, 20],
    ];
    curves.forEach((c, i) => {
      c.forEach((p, j) => {
        expect(p[0]).toBeCloseTo(expected[i][j]);
        expect(p[1]).toBeCloseTo(0);
      });
    });
  });

  it("respects the tension", () => {
    const sets = curveCatmullRomQuadraticApproxPoints(points, 1)!;
    expect(sets[0][0][0]).toBeCloseTo(5);
  });
});

describe("offset points", () => {
  it("offsets a cubic curve along its normal", () => {
    const points = curveOffsetPoints(straight, 2, 3);
    expect(points).toHaveLength(4);
    points.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(i);
      expect(p[1]).toBeCloseTo(-2);
    });
    expect(curveOffsetPoints(straight, 1)).toHaveLength(51);
  });

  it("offsets a quadratic curve along its normal", () => {
    const points = offsetPointsForQuadraticBezier(
      gp(0, 0),
      gp(5, 0),
      gp(10, 0),
      1,
      2,
    );
    expect(points).toHaveLength(3);
    points.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(i * 5);
      expect(p[1]).toBeCloseTo(-1);
    });
    expect(
      offsetPointsForQuadraticBezier(gp(0, 0), gp(5, 5), gp(10, 0), 1),
    ).toHaveLength(51);
  });
});
