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
  it("should keep angles already within [0, 2π) unchanged", () => {
    expect(normalizeRadians(rad(0))).toBe(0);
    expect(normalizeRadians(rad(Math.PI))).toBe(Math.PI);
  });

  it("should wrap angles of 2π and above back into range", () => {
    expect(normalizeRadians(rad(2 * Math.PI))).toBe(0);
    expect(normalizeRadians(rad(5 * Math.PI))).toBeCloseTo(Math.PI);
  });

  it("should map negative angles to their positive equivalent", () => {
    expect(normalizeRadians(rad(-Math.PI / 2))).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeRadians(rad(-3 * Math.PI))).toBeCloseTo(Math.PI);
  });
});

describe("cartesian2Polar", () => {
  it("should return the radius and angle of a point", () => {
    const [radius, angle] = cartesian2Polar(pointFrom<GlobalPoint>(3, 4));

    expect(radius).toBe(5);
    expect(angle).toBeCloseTo(Math.atan2(4, 3));
  });

  it("should return angles normalized to [0, 2π) for every quadrant", () => {
    expect(cartesian2Polar(pointFrom<GlobalPoint>(1, 0))).toEqual([1, 0]);
    expect(cartesian2Polar(pointFrom<GlobalPoint>(0, 1))[1]).toBeCloseTo(
      Math.PI / 2,
    );
    expect(cartesian2Polar(pointFrom<GlobalPoint>(-1, 0))[1]).toBeCloseTo(
      Math.PI,
    );
    expect(cartesian2Polar(pointFrom<GlobalPoint>(0, -1))[1]).toBeCloseTo(
      (3 * Math.PI) / 2,
    );
    expect(cartesian2Polar(pointFrom<GlobalPoint>(1, -1))[1]).toBeCloseTo(
      (7 * Math.PI) / 4,
    );
  });

  it("should return a zero radius and angle for the origin", () => {
    expect(cartesian2Polar(pointFrom<GlobalPoint>(0, 0))).toEqual([0, 0]);
  });
});

describe("degrees and radians conversion", () => {
  it("should convert degrees to radians", () => {
    expect(degreesToRadians(180 as Degrees)).toBe(Math.PI);
    expect(degreesToRadians(90 as Degrees)).toBe(Math.PI / 2);
    expect(degreesToRadians(-45 as Degrees)).toBe(-Math.PI / 4);
  });

  it("should convert radians to degrees", () => {
    expect(radiansToDegrees(rad(Math.PI))).toBe(180);
    expect(radiansToDegrees(rad(Math.PI / 2))).toBe(90);
    expect(radiansToDegrees(rad(-Math.PI / 4))).toBe(-45);
  });

  it("should round-trip", () => {
    expect(radiansToDegrees(degreesToRadians(123.4 as Degrees))).toBeCloseTo(
      123.4,
    );
  });
});

describe("isRightAngleRads", () => {
  it("should detect right angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 2))).toBe(true);
    expect(isRightAngleRads(rad((3 * Math.PI) / 2))).toBe(true);
    expect(isRightAngleRads(rad(-Math.PI / 2))).toBe(true);
  });

  it("should treat every multiple of π/2 (including 0 and π) as axis aligned", () => {
    expect(isRightAngleRads(rad(0))).toBe(true);
    expect(isRightAngleRads(rad(Math.PI))).toBe(true);
  });

  it("should reject other angles", () => {
    expect(isRightAngleRads(rad(Math.PI / 4))).toBe(false);
    expect(isRightAngleRads(rad(Math.PI / 2 + 0.01))).toBe(false);
  });
});

describe("radiansBetweenAngles", () => {
  it("should check a range that does not wrap around 0", () => {
    const min = rad(Math.PI / 4);
    const max = rad((3 * Math.PI) / 4);

    expect(radiansBetweenAngles(rad(Math.PI / 2), min, max)).toBe(true);
    expect(radiansBetweenAngles(min, min, max)).toBe(true);
    expect(radiansBetweenAngles(max, min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
    expect(radiansBetweenAngles(rad(0), min, max)).toBe(false);
  });

  it("should check a range that wraps around 0", () => {
    const min = rad((7 * Math.PI) / 4);
    const max = rad(Math.PI / 4);

    expect(radiansBetweenAngles(rad(0), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(2 * Math.PI - 0.1), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(0.1), min, max)).toBe(true);
    expect(radiansBetweenAngles(rad(Math.PI), min, max)).toBe(false);
    expect(radiansBetweenAngles(rad(Math.PI / 2), min, max)).toBe(false);
  });

  it("should normalize the angle and the bounds first", () => {
    expect(
      radiansBetweenAngles(
        rad(-Math.PI / 8),
        rad(-Math.PI / 4),
        rad(Math.PI / 4),
      ),
    ).toBe(true);
    expect(
      radiansBetweenAngles(
        rad(Math.PI / 2 + 2 * Math.PI),
        rad(Math.PI / 4),
        rad((3 * Math.PI) / 4),
      ),
    ).toBe(true);
  });
});

describe("radiansDifference", () => {
  it("should return the absolute difference between two angles", () => {
    expect(radiansDifference(rad(Math.PI / 4), rad((3 * Math.PI) / 4))).toBe(
      Math.PI / 2,
    );
    expect(radiansDifference(rad((3 * Math.PI) / 4), rad(Math.PI / 4))).toBe(
      Math.PI / 2,
    );
  });

  it("should return 0 for equal angles", () => {
    expect(radiansDifference(rad(1), rad(1))).toBe(0);
    expect(radiansDifference(rad(0), rad(2 * Math.PI))).toBe(0);
  });

  it("should take the shortest way around the circle", () => {
    expect(radiansDifference(rad(0.1), rad(2 * Math.PI - 0.1))).toBeCloseTo(
      0.2,
    );
    expect(radiansDifference(rad(2 * Math.PI - 0.1), rad(0.1))).toBeCloseTo(
      0.2,
    );
  });

  it("should never exceed π", () => {
    expect(radiansDifference(rad(0), rad(Math.PI))).toBe(Math.PI);
    expect(radiansDifference(rad(-Math.PI / 2), rad(Math.PI / 2))).toBeCloseTo(
      Math.PI,
    );
  });
});
