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
  it("keeps angles already within [0, 2π)", () => {
    expect(normalizeRadians(rad(0))).toBe(0);
    expect(normalizeRadians(rad(Math.PI))).toBe(Math.PI);
  });

  it("wraps angles of 2π or more back into range", () => {
    expect(normalizeRadians(rad(2 * Math.PI))).toBe(0);
    expect(normalizeRadians(rad(5 * Math.PI))).toBeCloseTo(Math.PI);
  });

  it("maps negative angles to their positive equivalent", () => {
    expect(normalizeRadians(rad(-Math.PI / 2))).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeRadians(rad(-3 * Math.PI))).toBeCloseTo(Math.PI);
  });
});

describe("cartesian2Polar", () => {
  it("returns the radius and a normalized angle", () => {
    const [radius, angle] = cartesian2Polar(pointFrom<GlobalPoint>(3, 4));

    expect(radius).toBe(5);
    expect(angle).toBeCloseTo(Math.atan2(4, 3));
  });

  it("returns a positive angle for points below the x axis", () => {
    const [radius, angle] = cartesian2Polar(pointFrom<GlobalPoint>(0, -2));

    expect(radius).toBe(2);
    expect(angle).toBeCloseTo((3 * Math.PI) / 2);
  });

  it("returns zero radius and angle for the origin", () => {
    expect(cartesian2Polar(pointFrom<GlobalPoint>(0, 0))).toEqual([0, 0]);
  });
});

describe("degrees and radians conversion", () => {
  it("converts degrees to radians", () => {
    expect(degreesToRadians(180 as Degrees)).toBeCloseTo(Math.PI);
    expect(degreesToRadians(-90 as Degrees)).toBeCloseTo(-Math.PI / 2);
  });

  it("converts radians to degrees", () => {
    expect(radiansToDegrees(rad(Math.PI / 2))).toBeCloseTo(90);
    expect(radiansToDegrees(rad(2 * Math.PI))).toBeCloseTo(360);
  });

  it("round-trips a value", () => {
    expect(radiansToDegrees(degreesToRadians(37 as Degrees))).toBeCloseTo(37);
  });
});

describe("isRightAngleRads", () => {
  it("is true for multiples of π/2", () => {
    expect(isRightAngleRads(rad(0))).toBe(true);
    expect(isRightAngleRads(rad(Math.PI / 2))).toBe(true);
    expect(isRightAngleRads(rad(Math.PI))).toBe(true);
    expect(isRightAngleRads(rad(-Math.PI / 2))).toBe(true);
  });

  it("is false for other angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 4))).toBe(false);
    expect(isRightAngleRads(rad(0.1))).toBe(false);
  });
});

describe("radiansBetweenAngles", () => {
  it("checks a non-wrapping range inclusively", () => {
    const min = rad(Math.PI / 4);
    const max = rad(Math.PI / 2);

    expect(radiansBetweenAngles(rad(Math.PI / 3), min, max)).toBe(true);
    expect(radiansBetweenAngles(min, min, max)).toBe(true);
    expect(radiansBetweenAngles(max, min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
  });

  it("checks a range that wraps around 0", () => {
    const min = rad((3 * Math.PI) / 2);
    const max = rad(Math.PI / 4);

    expect(radiansBetweenAngles(rad(0), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad((7 * Math.PI) / 4), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI / 8), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
  });

  it("normalizes all inputs before comparing", () => {
    expect(
      radiansBetweenAngles(
        rad(-Math.PI / 8),
        rad(-Math.PI / 4),
        rad(Math.PI / 4),
      ),
    ).toBe(true);
    expect(
      radiansBetweenAngles(
        rad(2 * Math.PI + Math.PI / 3),
        rad(Math.PI / 4),
        rad(Math.PI / 2),
      ),
    ).toBe(true);
  });
});

describe("radiansDifference", () => {
  it("returns the absolute difference for close angles", () => {
    expect(radiansDifference(rad(1), rad(0.5))).toBeCloseTo(0.5);
    expect(radiansDifference(rad(0.5), rad(1))).toBeCloseTo(0.5);
  });

  it("takes the short way around when the difference exceeds π", () => {
    expect(radiansDifference(rad(0.1), rad(2 * Math.PI - 0.1))).toBeCloseTo(
      0.2,
    );
    expect(radiansDifference(rad(2 * Math.PI - 0.1), rad(0.1))).toBeCloseTo(
      0.2,
    );
  });

  it("is zero for equivalent angles", () => {
    expect(radiansDifference(rad(-Math.PI / 2), rad((3 * Math.PI) / 2))).toBe(
      0,
    );
  });

  it("is π for opposite angles", () => {
    expect(radiansDifference(rad(0), rad(Math.PI))).toBeCloseTo(Math.PI);
  });
});
