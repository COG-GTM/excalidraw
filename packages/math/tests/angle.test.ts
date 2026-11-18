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

import type { Degrees, GlobalPoint, Radians } from "../src/types";

const rad = (n: number) => n as Radians;

describe("normalizeRadians", () => {
  it("wraps angles larger than a full turn", () => {
    expect(normalizeRadians(rad(3 * Math.PI))).toBeCloseTo(Math.PI);
  });

  it("maps negative angles into [0, 2π)", () => {
    expect(normalizeRadians(rad(-Math.PI / 2))).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeRadians(rad(-5 * Math.PI))).toBeCloseTo(Math.PI);
  });

  it("keeps angles already in range", () => {
    expect(normalizeRadians(rad(0))).toBe(0);
    expect(normalizeRadians(rad(1))).toBe(1);
  });
});

describe("cartesian2Polar", () => {
  it("returns the radius and the angle from the origin", () => {
    const [r, theta] = cartesian2Polar(pointFrom<GlobalPoint>(3, 4));

    expect(r).toBe(5);
    expect(theta).toBeCloseTo(Math.atan2(4, 3));
  });

  it("normalizes angles below the x axis to a positive value", () => {
    const [r, theta] = cartesian2Polar(pointFrom<GlobalPoint>(0, -2));

    expect(r).toBe(2);
    expect(theta).toBeCloseTo((3 * Math.PI) / 2);
  });
});

describe("degrees <-> radians", () => {
  it("converts degrees to radians", () => {
    expect(degreesToRadians(180 as Degrees)).toBeCloseTo(Math.PI);
    expect(degreesToRadians(-90 as Degrees)).toBeCloseTo(-Math.PI / 2);
  });

  it("converts radians to degrees", () => {
    expect(radiansToDegrees(rad(Math.PI / 2))).toBeCloseTo(90);
    expect(radiansToDegrees(rad(2 * Math.PI))).toBeCloseTo(360);
  });

  it("round-trips", () => {
    expect(radiansToDegrees(degreesToRadians(37 as Degrees))).toBeCloseTo(37);
  });
});

describe("isRightAngleRads", () => {
  it("accepts every multiple of π/2", () => {
    expect(isRightAngleRads(rad(0))).toBe(true);
    expect(isRightAngleRads(rad(Math.PI / 2))).toBe(true);
    expect(isRightAngleRads(rad(Math.PI))).toBe(true);
    expect(isRightAngleRads(rad(-Math.PI / 2))).toBe(true);
  });

  it("rejects other angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 4))).toBe(false);
    expect(isRightAngleRads(rad(Math.PI / 2 + 0.01))).toBe(false);
  });
});

describe("radiansBetweenAngles", () => {
  it("checks a plain range inclusively", () => {
    expect(radiansBetweenAngles(rad(1), rad(0.5), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(0.5), rad(0.5), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(2), rad(0.5), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(3), rad(0.5), rad(2))).toBe(false);
  });

  it("handles a range that wraps around 0", () => {
    expect(radiansBetweenAngles(rad(0.2), rad(5.5), rad(0.5))).toBe(true);
    expect(radiansBetweenAngles(rad(6), rad(5.5), rad(0.5))).toBe(true);
    expect(radiansBetweenAngles(rad(3), rad(5.5), rad(0.5))).toBe(false);
  });

  it("normalizes the inputs before comparing", () => {
    expect(radiansBetweenAngles(rad(-0.1), rad(5.5), rad(0.5))).toBe(true);
    expect(radiansBetweenAngles(rad(1 + 2 * Math.PI), rad(0.5), rad(2))).toBe(
      true,
    );
  });
});

describe("radiansDifference", () => {
  it("returns the absolute difference for nearby angles", () => {
    expect(radiansDifference(rad(1), rad(2))).toBeCloseTo(1);
    expect(radiansDifference(rad(2), rad(1))).toBeCloseTo(1);
  });

  it("takes the short way across 0", () => {
    const expected = 2 * Math.PI - 6.1;

    expect(radiansDifference(rad(0.1), rad(6.2))).toBeCloseTo(expected);
    expect(radiansDifference(rad(6.2), rad(0.1))).toBeCloseTo(expected);
  });

  it("is at most π", () => {
    expect(radiansDifference(rad(0), rad(Math.PI))).toBeCloseTo(Math.PI);
    expect(radiansDifference(rad(-Math.PI / 2), rad(Math.PI / 2))).toBeCloseTo(
      Math.PI,
    );
  });
});
