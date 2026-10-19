import {
  cartesian2Polar,
  degreesToRadians,
  isRightAngleRads,
  normalizeRadians,
  radiansBetweenAngles,
  radiansDifference,
  radiansToDegrees,
} from "../src/angle";
import { pointFrom } from "../src/point";
import { PRECISION } from "../src/utils";

import type { Degrees, GlobalPoint, Radians } from "../src/types";

const rad = (n: number) => n as Radians;

describe("normalizeRadians", () => {
  it.each([
    ["zero", 0, 0],
    ["value already in range", Math.PI / 3, Math.PI / 3],
    ["negative value", -Math.PI / 2, (3 * Math.PI) / 2],
    ["large negative value", -5 * Math.PI, Math.PI],
    ["exactly 2π", 2 * Math.PI, 0],
    ["value above 2π", (5 * Math.PI) / 2, Math.PI / 2],
  ])("%s", (_, input, expected) => {
    expect(normalizeRadians(rad(input))).toBeCloseTo(expected);
  });

  it("always returns a value within [0, 2π)", () => {
    for (let a = -20; a <= 20; a += 0.37) {
      const n = normalizeRadians(rad(a));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(2 * Math.PI);
    }
  });
});

describe("cartesian2Polar", () => {
  it.each([
    ["positive x axis", [2, 0], 2, 0],
    ["1st quadrant", [1, 1], Math.SQRT2, Math.PI / 4],
    ["2nd quadrant", [-1, 1], Math.SQRT2, (3 * Math.PI) / 4],
    ["3rd quadrant", [-1, -1], Math.SQRT2, (5 * Math.PI) / 4],
    ["4th quadrant", [1, -1], Math.SQRT2, (7 * Math.PI) / 4],
    ["negative y axis", [0, -3], 3, (3 * Math.PI) / 2],
    ["origin", [0, 0], 0, 0],
  ] as const)("%s", (_, [x, y], radius, angle) => {
    const [r, theta] = cartesian2Polar(pointFrom<GlobalPoint>(x, y));
    expect(r).toBeCloseTo(radius);
    expect(theta).toBeCloseTo(angle);
  });
});

describe("degrees <-> radians", () => {
  it.each([
    [0, 0],
    [90, Math.PI / 2],
    [180, Math.PI],
    [-45, -Math.PI / 4],
    [360, 2 * Math.PI],
  ])("%d° is %f rad", (deg, radians) => {
    expect(degreesToRadians(deg as Degrees)).toBeCloseTo(radians);
    expect(radiansToDegrees(rad(radians))).toBeCloseTo(deg);
  });

  it("round trips", () => {
    [-720, -33.3, 0, 12.5, 271].forEach((deg) => {
      expect(radiansToDegrees(degreesToRadians(deg as Degrees))).toBeCloseTo(
        deg,
      );
    });
  });
});

describe("isRightAngleRads", () => {
  it.each([
    [0, true],
    [Math.PI / 2, true],
    [Math.PI, true],
    [(3 * Math.PI) / 2, true],
    [-Math.PI / 2, true],
    [Math.PI / 2 + PRECISION / 4, true],
    [Math.PI / 2 + PRECISION * 2, false],
    [Math.PI / 4, false],
    [1, false],
  ])("%f -> %s", (input, expected) => {
    expect(isRightAngleRads(rad(input))).toBe(expected);
  });
});

describe("radiansBetweenAngles", () => {
  it.each([
    // min < max
    ["inside range", 1, 0.5, 2, true],
    ["below range", 0.2, 0.5, 2, false],
    ["above range", 2.5, 0.5, 2, false],
    ["inclusive min boundary", 0.5, 0.5, 2, true],
    ["inclusive max boundary", 2, 0.5, 2, true],
    // min > max: the range wraps around 0
    ["wrapping range, just after 0", 0.1, 5.5, 0.5, true],
    ["wrapping range, just before 2π", 6, 5.5, 0.5, true],
    ["wrapping range, outside", 3, 5.5, 0.5, false],
    ["wrapping range, inclusive min", 5.5, 5.5, 0.5, true],
    ["wrapping range, inclusive max", 0.5, 5.5, 0.5, true],
    // inputs are normalized first
    ["negative angle normalized into wrapping range", -0.1, 5.5, 0.5, true],
    ["angle above 2π normalized", 2 * Math.PI + 1, 0.5, 2, true],
    ["negative bounds normalized", 0, -0.5, 0.5, true],
  ])("%s", (_, a, min, max, expected) => {
    expect(radiansBetweenAngles(rad(a), rad(min), rad(max))).toBe(expected);
  });
});

describe("radiansDifference", () => {
  it.each([
    ["simple positive difference", 1, 0.5, 0.5],
    ["simple negative difference is absolute", 0.5, 1, 0.5],
    ["equal angles", 2, 2, 0],
    ["exactly π", Math.PI, 0, Math.PI],
    ["a - b > π wraps", (3 * Math.PI) / 2, 0, Math.PI / 2],
    ["a - b < -π wraps", 0, (3 * Math.PI) / 2, Math.PI / 2],
    ["across 0", 0.1, 2 * Math.PI - 0.1, 0.2],
    ["inputs are normalized", -Math.PI / 2, Math.PI / 2, Math.PI],
    ["full turn apart is zero", 4 * Math.PI + 0.3, 0.3, 0],
  ])("%s", (_, a, b, expected) => {
    const diff = radiansDifference(rad(a), rad(b));
    expect(diff).toBeCloseTo(expected);
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThanOrEqual(Math.PI);
  });
});
