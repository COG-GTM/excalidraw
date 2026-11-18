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
    expect(normalizeRadians(rad(Math.PI))).toBeCloseTo(Math.PI);
  });

  it("wraps angles larger than a full turn", () => {
    expect(normalizeRadians(rad((5 * Math.PI) / 2))).toBeCloseTo(Math.PI / 2);
  });

  it("maps negative angles into [0, 2π)", () => {
    expect(normalizeRadians(rad(-Math.PI / 2))).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeRadians(rad(-5 * Math.PI))).toBeCloseTo(Math.PI);
  });
});

describe("cartesian2Polar", () => {
  it("returns the radius and the normalized angle", () => {
    const [r1, a1] = cartesian2Polar(pointFrom<GlobalPoint>(0, 1));
    expect(r1).toBeCloseTo(1);
    expect(a1).toBeCloseTo(Math.PI / 2);

    const [r2, a2] = cartesian2Polar(pointFrom<GlobalPoint>(-1, 0));
    expect(r2).toBeCloseTo(1);
    expect(a2).toBeCloseTo(Math.PI);

    const [r3, a3] = cartesian2Polar(pointFrom<GlobalPoint>(0, -2));
    expect(r3).toBeCloseTo(2);
    expect(a3).toBeCloseTo((3 * Math.PI) / 2);

    const [r4, a4] = cartesian2Polar(pointFrom<GlobalPoint>(3, 4));
    expect(r4).toBeCloseTo(5);
    expect(a4).toBeCloseTo(Math.atan2(4, 3));
  });
});

describe("degrees <-> radians", () => {
  it("converts degrees to radians", () => {
    expect(degreesToRadians(180 as Degrees)).toBeCloseTo(Math.PI);
    expect(degreesToRadians(-90 as Degrees)).toBeCloseTo(-Math.PI / 2);
    expect(degreesToRadians(0 as Degrees)).toBe(0);
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
  it("detects right angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 2))).toBe(true);
    expect(isRightAngleRads(rad(-Math.PI / 2))).toBe(true);
    expect(isRightAngleRads(rad((3 * Math.PI) / 2))).toBe(true);
  });

  it("rejects other angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 4))).toBe(false);
    expect(isRightAngleRads(rad(Math.PI / 3))).toBe(false);
  });
});

describe("radiansBetweenAngles", () => {
  it("checks a non-wrapping range", () => {
    expect(radiansBetweenAngles(rad(Math.PI / 2), rad(0), rad(Math.PI))).toBe(
      true,
    );
    expect(
      radiansBetweenAngles(rad((3 * Math.PI) / 2), rad(0), rad(Math.PI)),
    ).toBe(false);
  });

  it("checks a range that wraps around 0", () => {
    const min = rad((3 * Math.PI) / 2);
    const max = rad(Math.PI / 2);
    expect(radiansBetweenAngles(rad(0), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(-Math.PI / 4), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI / 4), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
  });
});

describe("radiansDifference", () => {
  it("returns the absolute difference for close angles", () => {
    expect(radiansDifference(rad(Math.PI / 2), rad(Math.PI / 4))).toBeCloseTo(
      Math.PI / 4,
    );
    expect(radiansDifference(rad(Math.PI / 4), rad(Math.PI / 2))).toBeCloseTo(
      Math.PI / 4,
    );
  });

  it("takes the short way around the circle", () => {
    expect(radiansDifference(rad(0.1), rad(2 * Math.PI - 0.1))).toBeCloseTo(
      0.2,
    );
    expect(radiansDifference(rad(2 * Math.PI - 0.1), rad(0.1))).toBeCloseTo(
      0.2,
    );
  });
});
