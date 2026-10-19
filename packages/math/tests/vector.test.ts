import { pointFrom } from "../src/point";
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

  test("vector", () => {
    expect(vector(3, 4)).toEqual([3, 4]);
    expect(vector(5, 7, 1, 2)).toEqual([4, 5]);
  });

  describe("vectorFromPoint", () => {
    const p = pointFrom<GlobalPoint>(3, 4);

    it("uses the origin [0, 0] by default", () => {
      expect(vectorFromPoint(p)).toEqual([3, 4]);
    });

    it("is relative to the given origin", () => {
      expect(vectorFromPoint(p, pointFrom<GlobalPoint>(1, 1))).toEqual([2, 3]);
      expect(vectorFromPoint(p, pointFrom<GlobalPoint>(5, 10))).toEqual([
        -2, -6,
      ]);
    });

    it("returns the vector when its magnitude is above the threshold", () => {
      expect(vectorFromPoint(p, undefined, 4)).toEqual([3, 4]);
    });

    it("returns the vector when its magnitude equals the threshold", () => {
      expect(vectorFromPoint(p, undefined, 5)).toEqual([3, 4]);
    });

    it("returns the default [0, 1] below the threshold", () => {
      expect(vectorFromPoint(p, undefined, 6)).toEqual([0, 1]);
    });

    it("returns a custom default below the threshold", () => {
      expect(vectorFromPoint(p, undefined, 10, [1, 0] as Vector)).toEqual([
        1, 0,
      ]);
    });

    it("ignores a zero threshold", () => {
      const origin = pointFrom<GlobalPoint>(0, 0);
      expect(vectorFromPoint(origin, origin, 0)).toEqual([0, 0]);
    });
  });

  test.each([
    [[1, 0], [0, 1], 1],
    [[0, 1], [1, 0], -1],
    [[2, 4], [1, 2], 0],
    [[3, 4], [5, -2], -26],
  ] as [Vector, Vector, number][])("vectorCross(%j, %j) = %d", (a, b, out) => {
    expect(vectorCross(a, b)).toBe(out);
  });

  test.each([
    [[1, 2], [3, 4], 11],
    [[1, 0], [0, 1], 0],
    [[2, 3], [-2, -3], -13],
  ] as [Vector, Vector, number][])("vectorDot(%j, %j) = %d", (a, b, out) => {
    expect(vectorDot(a, b)).toBe(out);
  });

  test("vectorAdd", () => {
    expect(vectorAdd([1, 2] as Vector, [3, -5] as Vector)).toEqual([4, -3]);
  });

  test("vectorSubtract", () => {
    expect(vectorSubtract([1, 2] as Vector, [3, -5] as Vector)).toEqual([
      -2, 7,
    ]);
  });

  test("vectorScale", () => {
    expect(vectorScale([2, -3] as Vector, 2.5)).toEqual([5, -7.5]);
    expect(vectorScale([2, -3] as Vector, -1)).toEqual([-2, 3]);
  });

  test("vectorMagnitudeSq / vectorMagnitude", () => {
    expect(vectorMagnitudeSq([3, 4] as Vector)).toBe(25);
    expect(vectorMagnitude([3, 4] as Vector)).toBe(5);
    expect(vectorMagnitude([-6, 8] as Vector)).toBe(10);
    expect(vectorMagnitude([0, 0] as Vector)).toBe(0);
  });

  describe("vectorNormalize", () => {
    it("returns a unit vector in the same direction", () => {
      const [x, y] = vectorNormalize([3, 4] as Vector);
      expect(x).toBeCloseTo(0.6);
      expect(y).toBeCloseTo(0.8);
      expect(vectorMagnitude([x, y] as Vector)).toBeCloseTo(1);
    });

    it("returns (0, 0) for a zero vector instead of NaN", () => {
      const v = vectorNormalize([0, 0] as Vector);
      expect(v).toEqual([0, 0]);
      expect(v.some(Number.isNaN)).toBe(false);
    });
  });

  test("vectorNormal is the right-hand perpendicular", () => {
    expect(vectorNormal([1, 0] as Vector)).toEqual([0, -1]);
    const [nx, ny] = vectorNormal([0, -1] as Vector);
    expect(nx).toBe(-1);
    expect(ny).toBeCloseTo(0);
    const v = [3, 4] as Vector;
    const n = vectorNormal(v);
    expect(vectorDot(v, n)).toBe(0);
    expect(vectorMagnitude(n)).toBe(vectorMagnitude(v));
  });
});
