import {
  isPoint,
  isPointWithinBounds,
  isValidPoint,
  pointCenter,
  pointDistance,
  pointDistanceSq,
  pointFrom,
  pointFromArray,
  pointFromPair,
  pointFromVector,
  pointRotateDegs,
  pointRotateRads,
  pointScaleFromOrigin,
  pointsEqual,
  pointTranslate,
} from "../src/point";
import { vector } from "../src/vector";

import type { Degrees, GlobalPoint, Radians } from "../src/types";

describe("rotate", () => {
  it("should rotate over (x2, y2) and return the rotated coordinates for (x1, y1)", () => {
    const x1 = 10;
    const y1 = 20;
    const x2 = 20;
    const y2 = 30;
    const angle = (Math.PI / 2) as Radians;
    const [rotatedX, rotatedY] = pointRotateRads(
      pointFrom(x1, y1),
      pointFrom(x2, y2),
      angle,
    );
    expect([rotatedX, rotatedY]).toEqual([30, 20]);
    const res2 = pointRotateRads(
      pointFrom(rotatedX, rotatedY),
      pointFrom(x2, y2),
      -angle as Radians,
    );
    expect(res2).toEqual([x1, x2]);
  });
});

describe("pointFrom variants", () => {
  it("builds a point from coordinates or an {x, y} object", () => {
    expect(pointFrom(1, 2)).toEqual([1, 2]);
    expect(pointFrom({ x: 3, y: 4 })).toEqual([3, 4]);
  });

  it("converts only two-element arrays", () => {
    expect(pointFromArray([5, 6])).toEqual([5, 6]);
    expect(pointFromArray([5])).toBeUndefined();
    expect(pointFromArray([5, 6, 7])).toBeUndefined();
  });

  it("reuses the pair as the point", () => {
    const pair: [number, number] = [7, 8];

    expect(pointFromPair(pair)).toBe(pair);
  });

  it("converts a vector to a point, optionally offset", () => {
    expect(pointFromVector(vector(2, 3))).toEqual([2, 3]);
    expect(
      pointFromVector(vector(2, 3), pointFrom<GlobalPoint>(10, 10)),
    ).toEqual([12, 13]);
  });
});

describe("point validation", () => {
  it("isPoint accepts numeric pairs, including Infinity", () => {
    expect(isPoint([1, 2])).toBe(true);
    expect(isPoint([Infinity, 0])).toBe(true);
    expect(isPoint([1, NaN])).toBe(false);
    expect(isPoint([1, "2"])).toBe(false);
    expect(isPoint([1, 2, 3])).toBe(false);
    expect(isPoint({ x: 1, y: 2 })).toBe(false);
  });

  it("isValidPoint also rejects non-finite coordinates", () => {
    expect(isValidPoint([1, 2])).toBe(true);
    expect(isValidPoint([Infinity, 0])).toBe(false);
    expect(isValidPoint([0, NaN])).toBe(false);
    expect(isValidPoint([1])).toBe(false);
    expect(isValidPoint("1,2")).toBe(false);
  });
});

describe("pointsEqual", () => {
  it("compares within the default precision", () => {
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1.00001, 1))).toBe(true);
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1.01, 1))).toBe(false);
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1, 1.01))).toBe(false);
  });

  it("honours a custom tolerance", () => {
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1.4, 0.6), 0.5)).toBe(true);
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1.6, 1), 0.5)).toBe(false);
  });
});

describe("pointRotate", () => {
  it("returns the same point for a zero angle", () => {
    const p = pointFrom<GlobalPoint>(3, 4);

    expect(pointRotateRads(p, pointFrom(0, 0), 0 as Radians)).toBe(p);
  });

  it("rotates by degrees", () => {
    const [x, y] = pointRotateDegs(
      pointFrom<GlobalPoint>(10, 0),
      pointFrom<GlobalPoint>(0, 0),
      90 as Degrees,
    );

    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(10);
  });
});

describe("point arithmetic", () => {
  it("translates by a vector, or not at all by default", () => {
    expect(pointTranslate(pointFrom(1, 2), vector(3, -4))).toEqual([4, -2]);
    expect(pointTranslate(pointFrom(1, 2))).toEqual([1, 2]);
  });

  it("finds the center of two points", () => {
    expect(pointCenter(pointFrom(0, 0), pointFrom(10, -4))).toEqual([5, -2]);
  });

  it("measures distance and squared distance", () => {
    const a = pointFrom<GlobalPoint>(1, 1);
    const b = pointFrom<GlobalPoint>(4, 5);

    expect(pointDistance(a, b)).toBe(5);
    expect(pointDistanceSq(a, b)).toBe(25);
    expect(pointDistance(a, a)).toBe(0);
  });

  it("scales a point away from an origin", () => {
    const mid = pointFrom<GlobalPoint>(10, 10);

    expect(pointScaleFromOrigin(pointFrom<GlobalPoint>(12, 7), mid, 2)).toEqual(
      [14, 4],
    );
    expect(pointScaleFromOrigin(pointFrom<GlobalPoint>(12, 7), mid, 0)).toEqual(
      [10, 10],
    );
  });
});

describe("isPointWithinBounds", () => {
  const p = pointFrom<GlobalPoint>(0, 10);
  const r = pointFrom<GlobalPoint>(10, 0);

  it("accepts points inside or on the box, whatever the corner order", () => {
    expect(isPointWithinBounds(p, pointFrom(5, 5), r)).toBe(true);
    expect(isPointWithinBounds(r, pointFrom(5, 5), p)).toBe(true);
    expect(isPointWithinBounds(p, pointFrom(0, 0), r)).toBe(true);
  });

  it("rejects points outside the box on either axis", () => {
    expect(isPointWithinBounds(p, pointFrom(11, 5), r)).toBe(false);
    expect(isPointWithinBounds(p, pointFrom(-1, 5), r)).toBe(false);
    expect(isPointWithinBounds(p, pointFrom(5, 11), r)).toBe(false);
    expect(isPointWithinBounds(p, pointFrom(5, -1), r)).toBe(false);
  });
});
