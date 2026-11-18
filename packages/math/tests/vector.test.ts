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

import type { GlobalPoint } from "../src/types";

describe("Vector", () => {
  test("isVector", () => {
    expect(isVector([5, 5])).toBe(true);
    expect(isVector([-5, -5])).toBe(true);
    expect(isVector([5, 0.5])).toBe(true);
    expect(isVector(null)).toBe(false);
    expect(isVector(undefined)).toBe(false);
    expect(isVector([5, NaN])).toBe(false);
    expect(isVector([NaN, 5])).toBe(false);
    expect(isVector(["5", 5])).toBe(false);
    expect(isVector([5, 5, 5])).toBe(false);
  });

  test("vector", () => {
    expect(vector(3, 4)).toEqual([3, 4]);
    expect(vector(3, 4, 1, 1)).toEqual([2, 3]);
  });

  test("vectorFromPoint", () => {
    expect(vectorFromPoint(pointFrom<GlobalPoint>(3, 4))).toEqual([3, 4]);
    expect(
      vectorFromPoint(pointFrom<GlobalPoint>(3, 4), pointFrom(1, 1)),
    ).toEqual([2, 3]);
  });

  test("vectorFromPoint falls back to the default below the threshold", () => {
    const origin = pointFrom<GlobalPoint>(0, 0);
    expect(vectorFromPoint(pointFrom<GlobalPoint>(0.1, 0), origin, 1)).toEqual([
      0, 1,
    ]);
    expect(
      vectorFromPoint(pointFrom<GlobalPoint>(0.1, 0), origin, 1, vector(5, 5)),
    ).toEqual([5, 5]);
    expect(vectorFromPoint(pointFrom<GlobalPoint>(2, 0), origin, 1)).toEqual([
      2, 0,
    ]);
  });

  test("vectorCross", () => {
    expect(vectorCross(vector(1, 0), vector(0, 1))).toBe(1);
    expect(vectorCross(vector(0, 1), vector(1, 0))).toBe(-1);
    expect(vectorCross(vector(2, 2), vector(1, 1))).toBe(0);
  });

  test("vectorDot", () => {
    expect(vectorDot(vector(1, 2), vector(3, 4))).toBe(11);
    expect(vectorDot(vector(1, 0), vector(0, 1))).toBe(0);
  });

  test("vectorAdd / vectorSubtract", () => {
    expect(vectorAdd(vector(1, 2), vector(3, 4))).toEqual([4, 6]);
    expect(vectorSubtract(vector(3, 4), vector(1, 1))).toEqual([2, 3]);
  });

  test("vectorScale", () => {
    expect(vectorScale(vector(1, 2), 3)).toEqual([3, 6]);
  });

  test("vectorMagnitude", () => {
    expect(vectorMagnitudeSq(vector(3, 4))).toBe(25);
    expect(vectorMagnitude(vector(3, 4))).toBe(5);
  });

  test("vectorNormalize", () => {
    const [x, y] = vectorNormalize(vector(3, 4));
    expect(x).toBeCloseTo(0.6);
    expect(y).toBeCloseTo(0.8);
    expect(vectorNormalize(vector(0, 0))).toEqual([0, 0]);
  });

  test("vectorNormal", () => {
    expect(vectorNormal(vector(1, 0))).toEqual([0, -1]);
    expect(vectorNormal(vector(3, 4))).toEqual([4, -3]);
  });
});
