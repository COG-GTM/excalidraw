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

describe("normalizeRadians", () => {
  it("should keep angles already in the [0, 2π) range", () => {
    expect(normalizeRadians(rad(0))).toBe(0);
    expect(normalizeRadians(rad(Math.PI))).toBe(Math.PI);
  });

  it("should wrap angles of a full turn or more", () => {
    expect(normalizeRadians(rad(2 * Math.PI))).toBe(0);
    expect(normalizeRadians(rad(5 * Math.PI))).toBeCloseTo(Math.PI);
  });

  it("should wrap negative angles into the positive range", () => {
    expect(normalizeRadians(rad(-Math.PI / 2))).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeRadians(rad(-5 * Math.PI))).toBeCloseTo(Math.PI);
  });
});

describe("cartesian2Polar", () => {
  it("should return the radius and angle for points on the axes", () => {
    expect(cartesian2Polar(pointFrom(1, 0))).toEqual([1, 0]);
    expect(cartesian2Polar(pointFrom(0, 2))).toEqual([2, Math.PI / 2]);
    expect(cartesian2Polar(pointFrom(-3, 0))).toEqual([3, Math.PI]);
  });

  it("should normalize the angle of points with negative y", () => {
    const [radius, angle] = cartesian2Polar(pointFrom(0, -1));

    expect(radius).toBe(1);
    expect(angle).toBeCloseTo((3 * Math.PI) / 2);
  });

  it("should handle points off the axes", () => {
    const [radius, angle] = cartesian2Polar(pointFrom(3, 4));

    expect(radius).toBe(5);
    expect(angle).toBeCloseTo(Math.atan2(4, 3));
  });

  it("should return zero radius and angle for the origin", () => {
    expect(cartesian2Polar(pointFrom(0, 0))).toEqual([0, 0]);
  });
});

describe("degrees and radians conversion", () => {
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
  it("should return true for multiples of 90 degrees", () => {
    expect(isRightAngleRads(rad(0))).toBe(true);
    expect(isRightAngleRads(rad(Math.PI / 2))).toBe(true);
    expect(isRightAngleRads(rad(Math.PI))).toBe(true);
    expect(isRightAngleRads(rad(-Math.PI / 2))).toBe(true);
  });

  it("should return false for other angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 4))).toBe(false);
    expect(isRightAngleRads(rad(Math.PI / 2 + 0.01))).toBe(false);
  });
});

describe("radiansBetweenAngles", () => {
  it("should detect angles inside a non-wrapping range", () => {
    expect(radiansBetweenAngles(rad(Math.PI / 2), rad(0), rad(Math.PI))).toBe(
      true,
    );
    expect(
      radiansBetweenAngles(rad((3 * Math.PI) / 2), rad(0), rad(Math.PI)),
    ).toBe(false);
  });

  it("should include the range boundaries", () => {
    expect(radiansBetweenAngles(rad(1), rad(1), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(2), rad(1), rad(2))).toBe(true);
  });

  it("should handle ranges wrapping around the 0 angle", () => {
    const min = rad((3 * Math.PI) / 2);
    const max = rad(Math.PI / 2);

    expect(radiansBetweenAngles(rad(0), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad((7 * Math.PI) / 4), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI / 4), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
  });

  it("should normalize the inputs before comparing", () => {
    expect(
      radiansBetweenAngles(rad(-Math.PI / 2), rad(Math.PI), rad(-0.1)),
    ).toBe(true);
    expect(
      radiansBetweenAngles(
        rad(Math.PI / 2 + 2 * Math.PI),
        rad(0),
        rad(Math.PI),
      ),
    ).toBe(true);
  });
});

describe("radiansDifference", () => {
  it("should return the absolute difference regardless of order", () => {
    expect(radiansDifference(rad(Math.PI / 2), rad(0))).toBeCloseTo(
      Math.PI / 2,
    );
    expect(radiansDifference(rad(0), rad(Math.PI / 2))).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it("should return 0 for equivalent angles", () => {
    expect(radiansDifference(rad(1), rad(1))).toBe(0);
    expect(radiansDifference(rad(1), rad(1 + 2 * Math.PI))).toBeCloseTo(0);
  });

  it("should take the shortest way around the 0 angle", () => {
    expect(radiansDifference(rad(0.1), rad(2 * Math.PI - 0.1))).toBeCloseTo(
      0.2,
    );
    expect(radiansDifference(rad(2 * Math.PI - 0.1), rad(0.1))).toBeCloseTo(
      0.2,
    );
  });

  it("should never exceed half a turn", () => {
    expect(radiansDifference(rad(-Math.PI / 2), rad(Math.PI / 2))).toBeCloseTo(
      Math.PI,
    );
  });
});
