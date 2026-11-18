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

const straight = curve(
  pointFrom<GlobalPoint>(0, 0),
  pointFrom<GlobalPoint>(10, 0),
  pointFrom<GlobalPoint>(20, 0),
  pointFrom<GlobalPoint>(30, 0),
);

describe("isCurve", () => {
  it("accepts four points", () => {
    expect(isCurve(straight)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isCurve(straight.slice(0, 3))).toBe(false);
    expect(isCurve([[0, 0], [1, 1], [2, 2], "x"])).toBe(false);
    expect(
      isCurve([
        [0, 0],
        [1, 1],
        [2, 2],
        [NaN, 0],
      ]),
    ).toBe(false);
    expect(isCurve(null)).toBe(false);
  });
});

describe("bezierEquation", () => {
  it("starts and ends at the end points", () => {
    const c = curve(
      pointFrom<GlobalPoint>(-5, 7),
      pointFrom<GlobalPoint>(30, 40),
      pointFrom<GlobalPoint>(60, -20),
      pointFrom<GlobalPoint>(90, 3),
    );

    expect(bezierEquation(c, 0)).toEqual([-5, 7]);
    expect(bezierEquation(c, 1)).toEqual([90, 3]);
  });

  it("evaluates the cubic polynomial in between", () => {
    const c = curve(
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(0, 100),
      pointFrom<GlobalPoint>(100, 100),
      pointFrom<GlobalPoint>(100, 0),
    );

    const [x, y] = bezierEquation(c, 0.5);
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(75);
  });
});

describe("curveTangent", () => {
  it("is constant for evenly spaced collinear control points", () => {
    for (const t of [0, 0.3, 1]) {
      const [x, y] = curveTangent(straight, t);
      expect(x).toBeCloseTo(30);
      expect(y).toBeCloseTo(0);
    }
  });

  it("points from the start towards the first control point at t = 0", () => {
    const c = curve(
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(0, 10),
      pointFrom<GlobalPoint>(10, 10),
      pointFrom<GlobalPoint>(10, 0),
    );

    const [x0, y0] = curveTangent(c, 0);
    expect(x0).toBeCloseTo(0);
    expect(y0).toBeCloseTo(30);

    const [x1, y1] = curveTangent(c, 1);
    expect(x1).toBeCloseTo(0);
    expect(y1).toBeCloseTo(-30);
  });
});

describe("curveLength", () => {
  it("measures a straight curve", () => {
    expect(curveLength(straight)).toBeCloseTo(30);
  });

  it("measures a quarter-circle approximation", () => {
    const k = 0.5522847498 * 100;
    const c = curve(
      pointFrom<GlobalPoint>(100, 0),
      pointFrom<GlobalPoint>(100, k),
      pointFrom<GlobalPoint>(k, 100),
      pointFrom<GlobalPoint>(0, 100),
    );

    expect(curveLength(c)).toBeCloseTo((Math.PI * 100) / 2, 1);
  });
});

describe("curveLengthAtParameter", () => {
  it("is 0 at or before the start", () => {
    expect(curveLengthAtParameter(straight, 0)).toBe(0);
    expect(curveLengthAtParameter(straight, -1)).toBe(0);
  });

  it("is the whole length at or after the end", () => {
    expect(curveLengthAtParameter(straight, 1)).toBe(curveLength(straight));
    expect(curveLengthAtParameter(straight, 2)).toBe(curveLength(straight));
  });

  it("measures part of the curve", () => {
    expect(curveLengthAtParameter(straight, 0.5)).toBeCloseTo(15);
    expect(curveLengthAtParameter(straight, 0.25)).toBeCloseTo(7.5);
  });
});

describe("curvePointAtLength", () => {
  it("clamps to the end points", () => {
    expect(curvePointAtLength(straight, 0)).toEqual([0, 0]);
    expect(curvePointAtLength(straight, -0.5)).toEqual([0, 0]);
    expect(curvePointAtLength(straight, 1)).toEqual([30, 0]);
    expect(curvePointAtLength(straight, 1.5)).toEqual([30, 0]);
  });

  it("finds the point at a fraction of the arc length", () => {
    const [x, y] = curvePointAtLength(straight, 0.25);
    expect(x).toBeCloseTo(7.5);
    expect(y).toBeCloseTo(0);
  });

  it("follows arc length, not the curve parameter", () => {
    // control points bunched at the start make t and length diverge
    const c = curve(
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(30, 0),
    );

    expect(bezierEquation(c, 0.5)[0]).toBeCloseTo(3.75);
    const [x, y] = curvePointAtLength(c, 0.5);
    expect(x).toBeCloseTo(15, 1);
    expect(y).toBeCloseTo(0);
  });
});

describe("curveIntersectLineSegment misses", () => {
  it("returns no points when the segment is away from the curve", () => {
    const l = lineSegment(
      pointFrom<GlobalPoint>(0, 50),
      pointFrom<GlobalPoint>(30, 50),
    );

    expect(curveIntersectLineSegment(straight, l)).toEqual([]);
  });

  it("returns no points when the segment ends before the curve", () => {
    const c = curve(
      pointFrom<GlobalPoint>(100, 0),
      pointFrom<GlobalPoint>(100, 100),
      pointFrom<GlobalPoint>(100, 100),
      pointFrom<GlobalPoint>(0, 100),
    );
    const l = lineSegment(
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(20, 20),
    );

    expect(curveIntersectLineSegment(c, l)).toEqual([]);
  });

  it("finds an intersection near the end of the curve", () => {
    const c = curve(
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(10, 0),
      pointFrom<GlobalPoint>(20, 0),
      pointFrom<GlobalPoint>(30, 0),
    );
    const l = lineSegment(
      pointFrom<GlobalPoint>(27, -5),
      pointFrom<GlobalPoint>(27, 5),
    );

    const result = curveIntersectLineSegment(c, l);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBeCloseTo(27);
    expect(result[0][1]).toBeCloseTo(0);
  });
});

describe("curveClosestPoint edge cases", () => {
  it("returns the start point when it is the nearest", () => {
    const p = curveClosestPoint(straight, pointFrom<GlobalPoint>(-10, 0));

    expect(p![0]).toBeCloseTo(0, 1);
    expect(p![1]).toBeCloseTo(0);
  });

  it("returns null when the tolerance is wider than the search window", () => {
    expect(
      curveClosestPoint(straight, pointFrom<GlobalPoint>(15, 5), 1),
    ).toBeNull();
  });

  it("distance to a point on the curve is ~0", () => {
    expect(
      curvePointDistance(straight, pointFrom<GlobalPoint>(12, 0)),
    ).toBeCloseTo(0, 1);
  });
});

describe("curveCatmullRomQuadraticApproxPoints", () => {
  it("returns undefined for fewer than two points", () => {
    expect(curveCatmullRomQuadraticApproxPoints([])).toBeUndefined();
    expect(
      curveCatmullRomQuadraticApproxPoints([pointFrom<GlobalPoint>(1, 1)]),
    ).toBeUndefined();
  });

  it("builds one control/end pair per segment", () => {
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

  it("uses the tension to scale the control point", () => {
    const result = curveCatmullRomQuadraticApproxPoints(
      [pointFrom<GlobalPoint>(0, 0), pointFrom<GlobalPoint>(10, 0)],
      1,
    );

    expect(result).toEqual([
      [
        [5, 0],
        [10, 0],
      ],
    ]);
  });
});

describe("curveCatmullRomCubicApproxPoints", () => {
  it("returns undefined for fewer than two points", () => {
    expect(
      curveCatmullRomCubicApproxPoints([pointFrom<GlobalPoint>(1, 1)]),
    ).toBeUndefined();
  });

  it("builds a cubic curve between two points", () => {
    expect(
      curveCatmullRomCubicApproxPoints([
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(30, 0),
      ]),
    ).toEqual([
      [
        [0, 0],
        [5, 0],
        [25, 0],
        [30, 0],
      ],
    ]);
  });

  it("chains curves through every input point", () => {
    const points = [
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(10, 10),
      pointFrom<GlobalPoint>(20, 0),
      pointFrom<GlobalPoint>(30, 10),
    ];
    const curves = curveCatmullRomCubicApproxPoints(points)!;

    expect(curves).toHaveLength(3);
    curves.forEach((c, i) => {
      expect(c[0]).toEqual(points[i]);
      expect(c[3]).toEqual(points[i + 1]);
    });
    // interior tangent at (10, 10) follows the neighbours (0,0) -> (20,0)
    expect(curves[0][2]).toEqual([10 - 20 / 6, 10]);
    expect(curves[1][1]).toEqual([10 + 20 / 6, 10]);
  });
});

describe("curveOffsetPoints", () => {
  it("offsets every sample along the curve normal", () => {
    const points = curveOffsetPoints(straight, 5, 4);

    expect(points).toHaveLength(5);
    points.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(i * 7.5);
      expect(y).toBeCloseTo(-5);
    });
  });

  it("samples 51 points by default", () => {
    expect(curveOffsetPoints(straight, 1)).toHaveLength(51);
  });
});

describe("offsetPointsForQuadraticBezier", () => {
  it("offsets every sample along the curve normal", () => {
    const points = offsetPointsForQuadraticBezier(
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(5, 0),
      pointFrom<GlobalPoint>(10, 0),
      2,
      2,
    );

    expect(points).toHaveLength(3);
    points.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(i * 5);
      expect(y).toBeCloseTo(-2);
    });
  });

  it("flips sides with a negative offset", () => {
    const points = offsetPointsForQuadraticBezier(
      pointFrom<GlobalPoint>(0, 0),
      pointFrom<GlobalPoint>(0, 5),
      pointFrom<GlobalPoint>(0, 10),
      -3,
    );

    expect(points).toHaveLength(51);
    points.forEach(([x]) => expect(x).toBeCloseTo(-3));
  });
});
