import {
  isVector,
  vector,
  vectorAdd,
  vectorCross,
  vectorDot,
  vectorFromPoint,
  vectorMagnitude,
  vectorMagnitudeSq,
  vectorNormal,
  vectorNormalize,
  vectorScale,
  vectorSubtract,
} from "../src/vector";
import { pointFrom } from "../src/point";

import type { GlobalPoint, Vector } from "../src/types";

describe("Vector", () => {
  test("isVector", () => {
    expect(isVector([5, 5])).toBe(true);
    expect(isVector([-5, -5])).toBe(true);
    expect(isVector([5, 0.5])).toBe(true);
    expect(isVector(null)).toBe(false);
    expect(isVector(undefined)).toBe(false);
    expect(isVector([5, NaN])).toBe(false);
  });

  test("isVector rejects arrays of the wrong length or element type", () => {
    expect(isVector([1])).toBe(false);
    expect(isVector([1, 2, 3])).toBe(false);
    expect(isVector(["1", 2])).toBe(false);
    expect(isVector([NaN, 2])).toBe(false);
    expect(isVector({ 0: 1, 1: 2, length: 2 })).toBe(false);
  });
});

describe("vector", () => {
  it("creates a vector from the origin by default", () => {
    expect(vector(3, -4)).toEqual([3, -4]);
  });

  it("subtracts the given origin", () => {
    expect(vector(3, -4, 1, 2)).toEqual([2, -6]);
  });
});

describe("vectorFromPoint", () => {
  it("uses the coordinate origin by default", () => {
    expect(vectorFromPoint(pointFrom<GlobalPoint>(5, 7))).toEqual([5, 7]);
  });

  it("points from the origin to the point", () => {
    expect(
      vectorFromPoint(pointFrom<GlobalPoint>(5, 7), pointFrom(2, 10)),
    ).toEqual([3, -3]);
  });

  it("returns the default value when the vector is shorter than the threshold", () => {
    expect(
      vectorFromPoint(pointFrom<GlobalPoint>(1, 1), pointFrom(0, 0), 2),
    ).toEqual([0, 1]);
    expect(
      vectorFromPoint(
        pointFrom<GlobalPoint>(1, 1),
        pointFrom(0, 0),
        2,
        vector(-1, 0),
      ),
    ).toEqual([-1, 0]);
  });

  it("returns the vector when it is at least as long as the threshold", () => {
    expect(
      vectorFromPoint(pointFrom<GlobalPoint>(3, 4), pointFrom(0, 0), 5),
    ).toEqual([3, 4]);
  });

  it("ignores a zero threshold", () => {
    expect(
      vectorFromPoint(pointFrom<GlobalPoint>(0, 0), pointFrom(0, 0), 0),
    ).toEqual([0, 0]);
  });
});

describe("vectorCross", () => {
  it("is positive, negative or zero depending on the turn direction", () => {
    expect(vectorCross(vector(1, 0), vector(0, 1))).toBe(1);
    expect(vectorCross(vector(0, 1), vector(1, 0))).toBe(-1);
    expect(vectorCross(vector(2, 2), vector(-3, -3))).toBe(0);
  });

  it("is the signed area of the parallelogram", () => {
    expect(vectorCross(vector(3, 0), vector(1, 4))).toBe(12);
  });
});

describe("vectorDot", () => {
  it("is zero for perpendicular vectors", () => {
    expect(vectorDot(vector(1, 2), vector(-2, 1))).toBe(0);
  });

  it("sums the products of the components", () => {
    expect(vectorDot(vector(1, 2), vector(3, 4))).toBe(11);
    expect(vectorDot(vector(1, 0), vector(-5, 9))).toBe(-5);
  });
});

describe("vectorAdd / vectorSubtract", () => {
  it("adds component-wise", () => {
    expect(vectorAdd(vector(1, 2), vector(3, -5))).toEqual([4, -3]);
  });

  it("subtracts the second vector from the first", () => {
    expect(vectorSubtract(vector(1, 2), vector(3, -5))).toEqual([-2, 7]);
  });

  it("does not mutate the inputs when adding", () => {
    const a = vector(1, 2);
    const b = vector(3, 4);

    vectorAdd(a, b);

    expect(a).toEqual([1, 2]);
    expect(b).toEqual([3, 4]);
  });

  it("does not mutate the inputs when subtracting", () => {
    const a = vector(1, 2);
    const b = vector(3, 4);

    vectorSubtract(a, b);

    expect(a).toEqual([1, 2]);
    expect(b).toEqual([3, 4]);
  });
});

describe("vectorScale", () => {
  it("multiplies both components", () => {
    expect(vectorScale(vector(2, -3), 2)).toEqual([4, -6]);
    expect(vectorScale(vector(2, -3), -1)).toEqual([-2, 3]);
    expect(vectorScale(vector(2, -3), 0)).toEqual([0, -0]);
  });
});

describe("vectorMagnitude", () => {
  it("returns the squared and plain length", () => {
    expect(vectorMagnitudeSq(vector(3, 4))).toBe(25);
    expect(vectorMagnitude(vector(3, 4))).toBe(5);
    expect(vectorMagnitude(vector(-3, -4))).toBe(5);
    expect(vectorMagnitude(vector(0, 0))).toBe(0);
  });
});

describe("vectorNormalize", () => {
  it("returns a unit vector in the same direction", () => {
    const n = vectorNormalize(vector(3, 4));

    expect(n[0]).toBeCloseTo(0.6);
    expect(n[1]).toBeCloseTo(0.8);
    expect(vectorMagnitude(n)).toBeCloseTo(1);
  });

  it("keeps the direction of axis-aligned vectors", () => {
    expect(vectorNormalize(vector(0, -7))).toEqual([0, -1]);
    expect(vectorNormalize(vector(12, 0))).toEqual([1, 0]);
  });

  it("returns the zero vector for a zero-length vector", () => {
    const n = vectorNormalize(vector(0, 0));

    expect(n).toEqual([0, 0]);
    expect(n.every(Number.isFinite)).toBe(true);
  });
});

describe("vectorNormal", () => {
  it("returns the right-hand normal", () => {
    expect(vectorNormal(vector(1, 0))).toEqual([0, -1]);
    expect(vectorNormal(vector(0, 1))).toEqual([1, -0]);
  });

  it("is perpendicular to and as long as the input", () => {
    const v: Vector = vector(3, -7);
    const n = vectorNormal(v);

    expect(vectorDot(v, n)).toBe(0);
    expect(vectorMagnitude(n)).toBe(vectorMagnitude(v));
  });
});
