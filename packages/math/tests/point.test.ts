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

  it("returns the same point when the angle is 0", () => {
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

describe("point construction", () => {
  it("builds a point from coordinates or an {x, y} object", () => {
    expect(pointFrom(1, 2)).toEqual([1, 2]);
    expect(pointFrom<GlobalPoint>({ x: 3, y: 4 })).toEqual([3, 4]);
  });

  it("builds a point from a two-element array only", () => {
    expect(pointFromArray([1, 2])).toEqual([1, 2]);
    expect(pointFromArray([1])).toBeUndefined();
    expect(pointFromArray([1, 2, 3])).toBeUndefined();
  });

  it("builds a point from a pair", () => {
    expect(pointFromPair([5, 6])).toEqual([5, 6]);
  });

  it("builds a point from a vector, optionally offset", () => {
    expect(pointFromVector(vector(1, 2))).toEqual([1, 2]);
    expect(
      pointFromVector(vector(1, 2), pointFrom<GlobalPoint>(10, 10)),
    ).toEqual([11, 12]);
  });
});

describe("isPoint", () => {
  it("accepts numeric pairs", () => {
    expect(isPoint([1, 2])).toBe(true);
    expect(isPoint([-1.5, 0])).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPoint([1])).toBe(false);
    expect(isPoint([1, 2, 3])).toBe(false);
    expect(isPoint(["1", 2])).toBe(false);
    expect(isPoint([1, "2"])).toBe(false);
    expect(isPoint([NaN, 1])).toBe(false);
    expect(isPoint([1, NaN])).toBe(false);
    expect(isPoint(null)).toBe(false);
    expect(isPoint({ x: 1, y: 2 })).toBe(false);
  });
});

describe("isValidPoint", () => {
  it("accepts finite numeric pairs only", () => {
    expect(isValidPoint([1, 2])).toBe(true);
    expect(isValidPoint([Infinity, 1])).toBe(false);
    expect(isValidPoint([1, NaN])).toBe(false);
    expect(isValidPoint([1])).toBe(false);
    expect(isValidPoint("1,2")).toBe(false);
  });
});

describe("pointsEqual", () => {
  it("compares within the default precision", () => {
    expect(pointsEqual(pointFrom(0, 0), pointFrom(0.00001, 0))).toBe(true);
    expect(pointsEqual(pointFrom(0, 0), pointFrom(1, 0))).toBe(false);
    expect(pointsEqual(pointFrom(0, 0), pointFrom(0, 1))).toBe(false);
  });

  it("accepts a custom tolerance", () => {
    expect(pointsEqual(pointFrom(0, 0), pointFrom(1, 1), 2)).toBe(true);
  });
});

describe("point arithmetic", () => {
  it("translates by a vector", () => {
    expect(pointTranslate(pointFrom(1, 2), vector(3, 4))).toEqual([4, 6]);
    expect(pointTranslate(pointFrom(1, 2))).toEqual([1, 2]);
  });

  it("finds the center of two points", () => {
    expect(pointCenter(pointFrom(0, 0), pointFrom(10, 20))).toEqual([5, 10]);
  });

  it("measures distances", () => {
    expect(pointDistance(pointFrom(0, 0), pointFrom(3, 4))).toBe(5);
    expect(pointDistanceSq(pointFrom(0, 0), pointFrom(3, 4))).toBe(25);
    expect(pointDistanceSq(pointFrom(1, 1), pointFrom(-2, -3))).toBe(25);
  });

  it("scales from an origin", () => {
    expect(pointScaleFromOrigin(pointFrom(10, 10), pointFrom(0, 0), 2)).toEqual(
      [20, 20],
    );
    expect(pointScaleFromOrigin(pointFrom(10, 10), pointFrom(5, 5), 2)).toEqual(
      [15, 15],
    );
    expect(
      pointScaleFromOrigin(pointFrom(10, 10), pointFrom(0, 0), 0.5),
    ).toEqual([5, 5]);
  });
});

describe("isPointWithinBounds", () => {
  it("checks the bounding box spanned by two points", () => {
    expect(
      isPointWithinBounds(pointFrom(0, 0), pointFrom(5, 5), pointFrom(10, 10)),
    ).toBe(true);
    expect(
      isPointWithinBounds(pointFrom(10, 10), pointFrom(5, 5), pointFrom(0, 0)),
    ).toBe(true);
    expect(
      isPointWithinBounds(
        pointFrom(0, 0),
        pointFrom(10, 10),
        pointFrom(10, 10),
      ),
    ).toBe(true);
    expect(
      isPointWithinBounds(pointFrom(0, 0), pointFrom(11, 5), pointFrom(10, 10)),
    ).toBe(false);
    expect(
      isPointWithinBounds(pointFrom(0, 0), pointFrom(5, -1), pointFrom(10, 10)),
    ).toBe(false);
  });
});
