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
  it("leaves an angle inside [0, 2π) untouched", () => {
    expect(normalizeRadians(rad(0))).toBe(0);
    expect(normalizeRadians(rad(Math.PI / 2))).toBe(Math.PI / 2);
  });

  it("wraps a negative angle into the positive range", () => {
    expect(normalizeRadians(rad(-Math.PI / 2))).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeRadians(rad(-5 * Math.PI))).toBeCloseTo(Math.PI);
  });

  it("wraps an angle past a full turn", () => {
    expect(normalizeRadians(rad((5 * Math.PI) / 2))).toBeCloseTo(Math.PI / 2);
    expect(normalizeRadians(rad(2 * Math.PI))).toBe(0);
  });
});

describe("cartesian2Polar", () => {
  it("returns the radius and the angle of the point", () => {
    const [radius, angle] = cartesian2Polar(pointFrom(3, 4));

    expect(radius).toBe(5);
    expect(angle).toBeCloseTo(Math.atan2(4, 3));
  });

  it("normalizes the angle of a point with a negative y", () => {
    const [radius, angle] = cartesian2Polar(pointFrom(0, -2));

    expect(radius).toBe(2);
    expect(angle).toBeCloseTo((3 * Math.PI) / 2);
  });

  it("maps the origin to a zero radius and angle", () => {
    expect(cartesian2Polar(pointFrom(0, 0))).toEqual([0, 0]);
  });
});

describe("degree and radian conversion", () => {
  it("converts degrees to radians", () => {
    expect(degreesToRadians(180 as Degrees)).toBe(Math.PI);
    expect(degreesToRadians(-90 as Degrees)).toBe(-Math.PI / 2);
    expect(degreesToRadians(0 as Degrees)).toBe(0);
  });

  it("converts radians to degrees", () => {
    expect(radiansToDegrees(rad(Math.PI))).toBe(180);
    expect(radiansToDegrees(rad(-Math.PI / 2))).toBe(-90);
  });

  it("round-trips", () => {
    expect(radiansToDegrees(degreesToRadians(37 as Degrees))).toBeCloseTo(37);
  });
});

describe("isRightAngleRads", () => {
  it("accepts multiples of a quarter turn", () => {
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
  it("checks a range that does not wrap", () => {
    expect(radiansBetweenAngles(rad(Math.PI / 2), rad(0), rad(Math.PI))).toBe(
      true,
    );
    expect(
      radiansBetweenAngles(rad((3 * Math.PI) / 2), rad(0), rad(Math.PI)),
    ).toBe(false);
  });

  it("includes the ends of the range", () => {
    expect(radiansBetweenAngles(rad(1), rad(1), rad(2))).toBe(true);
    expect(radiansBetweenAngles(rad(2), rad(1), rad(2))).toBe(true);
  });

  it("checks a range that wraps around the 0 angle", () => {
    const min = rad((3 * Math.PI) / 2);
    const max = rad(Math.PI / 2);

    expect(radiansBetweenAngles(rad(0), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad((7 * Math.PI) / 4), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
  });

  it("normalizes the angles before comparing", () => {
    expect(
      radiansBetweenAngles(rad(-Math.PI / 2), rad(Math.PI), rad(-0.1)),
    ).toBe(true);
    expect(
      radiansBetweenAngles(rad(Math.PI / 2 + 2 * Math.PI), rad(0), rad(1)),
    ).toBe(false);
  });
});

describe("radiansDifference", () => {
  it("is the absolute difference, whatever the order", () => {
    expect(radiansDifference(rad(Math.PI / 2), rad(0))).toBeCloseTo(
      Math.PI / 2,
    );
    expect(radiansDifference(rad(0), rad(Math.PI / 2))).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it("takes the short way around the 0 angle", () => {
    const a = rad(0.1);
    const b = rad(2 * Math.PI - 0.1);

    expect(radiansDifference(a, b)).toBeCloseTo(0.2);
    expect(radiansDifference(b, a)).toBeCloseTo(0.2);
  });

  it("is 0 for angles a full turn apart", () => {
    expect(radiansDifference(rad(1), rad(1 + 2 * Math.PI))).toBeCloseTo(0);
  });
});
