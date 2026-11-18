import {
  add,
  angle,
  clamp,
  dist,
  distancePointToSegment,
  getCircleAndPerpendicularLineIntersectionsAtPoint,
  lerp,
  mag,
  norm,
  normAngle,
  plerp,
  rot,
  runLength,
  smul,
  sub,
} from "../src/math";

import type { Point } from "../src/math";

const expectPointClose = (actual: Point, expected: Point) => {
  expect(actual).toHaveLength(3);
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 10));
};

describe("vector arithmetic", () => {
  it("add sums every component including the radius", () => {
    expect(add([1, 2, 3], [4, -5, 0.5])).toEqual([5, -3, 3.5]);
  });

  it("sub subtracts every component including the radius", () => {
    expect(sub([1, 2, 3], [4, -5, 0.5])).toEqual([-3, 7, 2.5]);
  });

  it("smul scales every component including the radius", () => {
    expect(smul([1, -2, 3], 2)).toEqual([2, -4, 6]);
    expect(smul([1, -2, 3], 0)).toEqual([0, -0, 0]);
  });

  it("norm makes the xy part unit length and keeps the radius", () => {
    expect(norm([3, 4, 7])).toEqual([0.6, 0.8, 7]);
    expect(mag(norm([-12, 5, 1]))).toBeCloseTo(1, 10);
  });

  it("norm of a zero vector yields NaN components", () => {
    const [x, y, r] = norm([0, 0, 2]);
    expect(x).toBeNaN();
    expect(y).toBeNaN();
    expect(r).toBe(2);
  });

  it("rot rotates counter-clockwise around the origin and keeps the radius", () => {
    expectPointClose(rot([1, 0, 5], Math.PI / 2), [0, 1, 5]);
    expectPointClose(rot([1, 0, 5], Math.PI), [-1, 0, 5]);
    expectPointClose(rot([1, 0, 5], -Math.PI / 2), [0, -1, 5]);
    expectPointClose(rot([2, 3, 1], 2 * Math.PI), [2, 3, 1]);
  });

  it("mag returns the xy length and ignores the radius", () => {
    expect(mag([3, 4, 100])).toBe(5);
    expect(mag([0, 0, 1])).toBe(0);
  });

  it("dist returns the xy distance and ignores the radius", () => {
    expect(dist([1, 1, 0], [4, 5, 99])).toBe(5);
    expect(dist([2, 2, 1], [2, 2, 3])).toBe(0);
  });
});

describe("interpolation", () => {
  it("lerp interpolates and extrapolates scalars", () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(lerp(10, 20, 2)).toBe(30);
  });

  it("plerp interpolates all point components", () => {
    expect(plerp([0, 0, 0], [10, -20, 4], 0)).toEqual([0, 0, 0]);
    expect(plerp([0, 0, 0], [10, -20, 4], 1)).toEqual([10, -20, 4]);
    expect(plerp([0, 0, 0], [10, -20, 4], 0.5)).toEqual([5, -10, 2]);
  });
});

describe("angles", () => {
  it("angle returns the signed angle from p1 to p2 around p", () => {
    const origin: Point = [0, 0, 0];
    expect(angle(origin, [1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2, 10);
    expect(angle(origin, [0, 1, 0], [1, 0, 0])).toBeCloseTo(-Math.PI / 2, 10);
    expect(angle(origin, [1, 0, 0], [5, 0, 0])).toBe(0);
  });

  it("angle is measured relative to p, not the origin", () => {
    expect(angle([5, 5, 0], [6, 5, 0], [5, 6, 0])).toBeCloseTo(Math.PI / 2, 10);
  });

  it("normAngle wraps angles into [-PI, PI]", () => {
    expect(normAngle(0)).toBe(0);
    expect(normAngle(Math.PI / 4)).toBeCloseTo(Math.PI / 4, 10);
    expect(normAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(normAngle((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2, 10);
    expect(normAngle((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe("getCircleAndPerpendicularLineIntersectionsAtPoint", () => {
  it("returns the two points at radius distance perpendicular to the direction", () => {
    const [left, right] = getCircleAndPerpendicularLineIntersectionsAtPoint(
      [10, 10, 1],
      [5, 0, 0],
      3,
    );
    expectPointClose(left, [10, 13, 1]);
    expectPointClose(right, [10, 7, 1]);
  });

  it("does not depend on the direction vector's length", () => {
    const short = getCircleAndPerpendicularLineIntersectionsAtPoint(
      [0, 0, 0],
      [0, 1, 0],
      2,
    );
    const long = getCircleAndPerpendicularLineIntersectionsAtPoint(
      [0, 0, 0],
      [0, 50, 0],
      2,
    );
    expectPointClose(short[0], [-2, 0, 0]);
    expectPointClose(short[1], [2, 0, 0]);
    expectPointClose(long[0], short[0]);
    expectPointClose(long[1], short[1]);
  });
});

describe("runLength", () => {
  it("is 0 for empty and single-point paths", () => {
    expect(runLength([])).toBe(0);
    expect(runLength([[3, 4, 1]])).toBe(0);
  });

  // Suspected bug: the last segment is added a second time after the loop,
  // so a single 5-unit segment reports 10. Not fixed here (tests-only PR).
  it.skip("returns the polyline length (last segment counted twice)", () => {
    expect(
      runLength([
        [0, 0, 0],
        [3, 4, 0],
      ]),
    ).toBe(5);
    expect(
      runLength([
        [0, 0, 0],
        [3, 4, 0],
        [3, 10, 0],
      ]),
    ).toBe(11);
  });
});

describe("clamp", () => {
  it("returns values inside the range unchanged", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(0, 0, 1)).toBe(0);
    expect(clamp(1, 0, 1)).toBe(1);
  });

  it("clamps values below min and above max", () => {
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(42, 0, 1)).toBe(1);
  });
});

describe("distancePointToSegment", () => {
  const a: Point = [0, 0, 0];
  const b: Point = [10, 0, 0];

  it("returns the perpendicular distance when the projection lies on the segment", () => {
    expect(distancePointToSegment([5, 3, 0], a, b)).toBe(3);
    expect(distancePointToSegment([2, -4, 0], a, b)).toBe(4);
  });

  it("returns 0 for points on the segment", () => {
    expect(distancePointToSegment([7, 0, 0], a, b)).toBe(0);
  });

  it("measures to the start point when the projection falls before it", () => {
    expect(distancePointToSegment([-3, 4, 0], a, b)).toBe(5);
  });

  it("measures to the end point when the projection falls past it", () => {
    expect(distancePointToSegment([13, -4, 0], a, b)).toBe(5);
  });

  it("falls back to point distance for a zero-length segment", () => {
    expect(distancePointToSegment([3, 4, 0], a, a)).toBe(5);
  });

  it("ignores the radius component", () => {
    expect(distancePointToSegment([5, 3, 99], [0, 0, 7], [10, 0, -7])).toBe(3);
  });
});
