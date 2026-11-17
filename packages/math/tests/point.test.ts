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

describe("pointRotateRads", () => {
  it("returns the same point instance when the angle is zero", () => {
    const p = pointFrom<GlobalPoint>(5, 7);

    expect(pointRotateRads(p, pointFrom(0, 0), 0 as Radians)).toBe(p);
  });
});

describe("pointRotateDegs", () => {
  it("rotates a point around a center by degrees", () => {
    const [x, y] = pointRotateDegs(
      pointFrom<GlobalPoint>(10, 0),
      pointFrom<GlobalPoint>(0, 0),
      90 as Degrees,
    );

    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(10);
  });

  it("matches pointRotateRads for the equivalent angle", () => {
    const p = pointFrom<GlobalPoint>(3, -4);
    const c = pointFrom<GlobalPoint>(1, 1);
    const [dx, dy] = pointRotateDegs(p, c, 45 as Degrees);
    const [rx, ry] = pointRotateRads(p, c, (Math.PI / 4) as Radians);

    expect(dx).toBeCloseTo(rx);
    expect(dy).toBeCloseTo(ry);
  });
});

describe("pointFrom", () => {
  it("creates a point from x and y", () => {
    expect(pointFrom(1, 2)).toEqual([1, 2]);
  });

  it("creates a point from an {x, y} object", () => {
    expect(pointFrom<GlobalPoint>({ x: 3, y: -4 })).toEqual([3, -4]);
  });
});

describe("pointFromArray", () => {
  it("converts a two-number array", () => {
    expect(pointFromArray([4, 5])).toEqual([4, 5]);
  });

  it("returns undefined for arrays of any other length", () => {
    expect(pointFromArray([])).toBeUndefined();
    expect(pointFromArray([1])).toBeUndefined();
    expect(pointFromArray([1, 2, 3])).toBeUndefined();
  });
});

describe("pointFromPair", () => {
  it("returns the pair as a point", () => {
    const pair: [number, number] = [6, 7];

    expect(pointFromPair(pair)).toBe(pair);
  });
});

describe("pointFromVector", () => {
  it("uses the origin when no offset is given", () => {
    expect(pointFromVector(vector(2, 3))).toEqual([2, 3]);
  });

  it("adds the vector to the offset", () => {
    expect(
      pointFromVector(vector(2, 3), pointFrom<GlobalPoint>(10, -10)),
    ).toEqual([12, -7]);
  });
});

describe("isPoint", () => {
  it("accepts a pair of numbers", () => {
    expect(isPoint([0, 0])).toBe(true);
    expect(isPoint([-1.5, Infinity])).toBe(true);
  });

  it("rejects non-arrays and arrays of the wrong length", () => {
    expect(isPoint(null)).toBe(false);
    expect(isPoint({ x: 1, y: 2 })).toBe(false);
    expect(isPoint([1])).toBe(false);
    expect(isPoint([1, 2, 3])).toBe(false);
  });

  it("rejects non-numeric and NaN coordinates", () => {
    expect(isPoint(["1", 2])).toBe(false);
    expect(isPoint([1, "2"])).toBe(false);
    expect(isPoint([NaN, 2])).toBe(false);
    expect(isPoint([1, NaN])).toBe(false);
  });
});

describe("isValidPoint", () => {
  it("accepts finite coordinates", () => {
    expect(isValidPoint([1, -2])).toBe(true);
  });

  it("rejects infinite, NaN and non-numeric coordinates", () => {
    expect(isValidPoint([Infinity, 0])).toBe(false);
    expect(isValidPoint([0, NaN])).toBe(false);
    expect(isValidPoint(["0", 0])).toBe(false);
    expect(isValidPoint([0])).toBe(false);
    expect(isValidPoint(undefined)).toBe(false);
  });
});

describe("pointsEqual", () => {
  it("treats points within the default precision as equal", () => {
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1.00001, 0.99999))).toBe(
      true,
    );
  });

  it("treats points farther apart than the precision as different", () => {
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1.01, 1))).toBe(false);
    expect(pointsEqual(pointFrom(1, 1), pointFrom(1, 1.01))).toBe(false);
  });

  it("respects a custom tolerance", () => {
    expect(pointsEqual(pointFrom(0, 0), pointFrom(0.5, 0.5), 1)).toBe(true);
    expect(pointsEqual(pointFrom(0, 0), pointFrom(0.5, 0.5), 0.5)).toBe(false);
  });
});

describe("pointTranslate", () => {
  it("adds the vector to the point", () => {
    expect(pointTranslate(pointFrom(1, 2), vector(3, -4))).toEqual([4, -2]);
  });

  it("returns an equal point when no vector is given", () => {
    expect(pointTranslate(pointFrom(1, 2))).toEqual([1, 2]);
  });
});

describe("pointCenter", () => {
  it("returns the midpoint", () => {
    expect(pointCenter(pointFrom(0, 0), pointFrom(10, -4))).toEqual([5, -2]);
  });
});

describe("pointDistance and pointDistanceSq", () => {
  it("returns the euclidean distance", () => {
    expect(pointDistance(pointFrom(0, 0), pointFrom(3, 4))).toBe(5);
    expect(pointDistance(pointFrom(-1, -1), pointFrom(-1, -1))).toBe(0);
  });

  it("returns the squared distance", () => {
    expect(pointDistanceSq(pointFrom(1, 1), pointFrom(4, 5))).toBe(25);
  });
});

describe("pointScaleFromOrigin", () => {
  it("scales the point away from the origin by the multiplier", () => {
    expect(pointScaleFromOrigin(pointFrom(4, 6), pointFrom(2, 2), 2)).toEqual([
      6, 10,
    ]);
  });

  it("collapses onto the origin with a zero multiplier", () => {
    expect(pointScaleFromOrigin(pointFrom(4, 6), pointFrom(2, 2), 0)).toEqual([
      2, 2,
    ]);
  });
});

describe("isPointWithinBounds", () => {
  it("is true for a point inside or on the bounding box", () => {
    expect(
      isPointWithinBounds(pointFrom(0, 0), pointFrom(5, 5), pointFrom(10, 10)),
    ).toBe(true);
    expect(
      isPointWithinBounds(pointFrom(10, 10), pointFrom(10, 0), pointFrom(0, 0)),
    ).toBe(true);
  });

  it("is false for a point outside the bounding box on either axis", () => {
    expect(
      isPointWithinBounds(pointFrom(0, 0), pointFrom(11, 5), pointFrom(10, 10)),
    ).toBe(false);
    expect(
      isPointWithinBounds(pointFrom(0, 0), pointFrom(5, -1), pointFrom(10, 10)),
    ).toBe(false);
  });
});
