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

import type { Degrees, Radians } from "../src/types";

const rad = (value: number) => value as Radians;
const TAU = 2 * Math.PI;

describe("normalizeRadians", () => {
  it("should keep angles which are already in the [0, 2π) range", () => {
    expect(normalizeRadians(rad(0))).toBe(0);
    expect(normalizeRadians(rad(Math.PI))).toBe(Math.PI);
  });

  it("should wrap angles of a full turn or more", () => {
    expect(normalizeRadians(rad(TAU))).toBe(0);
    expect(normalizeRadians(rad(TAU + Math.PI / 2))).toBeCloseTo(Math.PI / 2);
    expect(normalizeRadians(rad(5 * TAU + 1))).toBeCloseTo(1);
  });

  it("should map negative angles to their positive equivalent", () => {
    expect(normalizeRadians(rad(-Math.PI / 2))).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeRadians(rad(-TAU - Math.PI))).toBeCloseTo(Math.PI);
  });
});

describe("cartesian2Polar", () => {
  it("should return the radius and the angle of the point", () => {
    expect(cartesian2Polar(pointFrom(1, 0))).toEqual([1, 0]);

    const [radius, angle] = cartesian2Polar(pointFrom(3, 4));
    expect(radius).toBe(5);
    expect(angle).toBeCloseTo(Math.atan(4 / 3));
  });

  it("should return a normalized angle for points with negative y", () => {
    const [radius, angle] = cartesian2Polar(pointFrom(0, -2));

    expect(radius).toBe(2);
    expect(angle).toBeCloseTo((3 * Math.PI) / 2);
  });

  it("should return a zero radius for the origin", () => {
    expect(cartesian2Polar(pointFrom(0, 0))).toEqual([0, 0]);
  });
});

describe("degree and radian conversion", () => {
  it("should convert degrees to radians", () => {
    expect(degreesToRadians(0 as Degrees)).toBe(0);
    expect(degreesToRadians(180 as Degrees)).toBe(Math.PI);
    expect(degreesToRadians(-90 as Degrees)).toBe(-Math.PI / 2);
  });

  it("should convert radians to degrees", () => {
    expect(radiansToDegrees(rad(0))).toBe(0);
    expect(radiansToDegrees(rad(Math.PI))).toBe(180);
    expect(radiansToDegrees(rad(-Math.PI / 2))).toBe(-90);
  });

  it("should round-trip", () => {
    expect(radiansToDegrees(degreesToRadians(37 as Degrees))).toBeCloseTo(37);
  });
});

describe("isRightAngleRads", () => {
  it("should accept quarter turns", () => {
    expect(isRightAngleRads(rad(Math.PI / 2))).toBe(true);
    expect(isRightAngleRads(rad((3 * Math.PI) / 2))).toBe(true);
    expect(isRightAngleRads(rad(-Math.PI / 2))).toBe(true);
  });

  it("should reject other angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 4))).toBe(false);
    expect(isRightAngleRads(rad(1))).toBe(false);
    expect(isRightAngleRads(rad(Math.PI / 2 + 0.01))).toBe(false);
  });
});

describe("radiansBetweenAngles", () => {
  it("should include angles inside the range and its limits", () => {
    expect(radiansBetweenAngles(rad(1), rad(0.5), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(0.5), rad(0.5), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(2), rad(0.5), rad(2))).toBe(true);
  });

  it("should exclude angles outside of the range", () => {
    expect(radiansBetweenAngles(rad(0.4), rad(0.5), rad(2))).toBe(false);
    expect(radiansBetweenAngles(rad(3), rad(0.5), rad(2))).toBe(false);
  });

  it("should handle ranges which wrap around the zero angle", () => {
    const min = rad((3 * Math.PI) / 2);
    const max = rad(Math.PI / 2);

    expect(radiansBetweenAngles(rad(0), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(TAU - 0.1), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(0.1), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
  });

  it("should normalize the angles before comparing", () => {
    expect(radiansBetweenAngles(rad(TAU + 1), rad(0.5), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(-0.1), rad(-0.5), rad(0.5))).toBe(true);
    expect(radiansBetweenAngles(rad(-1), rad(-0.5), rad(0.5))).toBe(false);
  });
});

describe("radiansDifference", () => {
  it("should return the absolute difference of two angles", () => {
    expect(radiansDifference(rad(1), rad(0.25))).toBeCloseTo(0.75);
    expect(radiansDifference(rad(0.25), rad(1))).toBeCloseTo(0.75);
    expect(radiansDifference(rad(2), rad(2))).toBe(0);
  });

  it("should take the shorter way around the circle", () => {
    expect(radiansDifference(rad(0.1), rad(TAU - 0.1))).toBeCloseTo(0.2);
    expect(radiansDifference(rad(TAU - 0.1), rad(0.1))).toBeCloseTo(0.2);
  });

  it("should never be larger than half a turn", () => {
    expect(radiansDifference(rad(0), rad(Math.PI))).toBeCloseTo(Math.PI);
    expect(radiansDifference(rad(-Math.PI / 2), rad(Math.PI))).toBeCloseTo(
      Math.PI / 2,
    );
  });
});
