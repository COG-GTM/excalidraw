import {
  average,
  clamp,
  isCloseTo,
  isFiniteNumber,
  round,
  roundToStep,
} from "../src/utils";

describe("clamp", () => {
  it("returns the value when it is inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns the bound when the value is outside the range", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("round", () => {
  it("rounds to the given number of decimals", () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.235, 2)).toBe(1.24);
    expect(round(1234.5, 0)).toBe(1235);
  });

  it("compensates for binary floating point representation", () => {
    // 1.005 is stored as 1.00499999..., Number.EPSILON nudges it back up
    expect(round(1.005, 2)).toBe(1.01);
  });

  it("supports floor and ceil", () => {
    expect(round(1.239, 2, "floor")).toBe(1.23);
    expect(round(1.231, 2, "ceil")).toBe(1.24);
  });

  it("supports negative precision", () => {
    expect(round(1234, -2)).toBe(1200);
  });
});

describe("roundToStep", () => {
  it("rounds to the nearest multiple of the step by default", () => {
    expect(roundToStep(0.37, 0.1)).toBeCloseTo(0.4);
    expect(roundToStep(0.34, 0.1)).toBeCloseTo(0.3);
    expect(roundToStep(7, 5)).toBe(5);
    expect(roundToStep(8, 5)).toBe(10);
  });

  it("floors to the multiple of the step below the value", () => {
    expect(roundToStep(0.39, 0.1, "floor")).toBeCloseTo(0.3);
    expect(roundToStep(1.99, 0.25, "floor")).toBe(1.75);
    expect(roundToStep(9.9, 5, "floor")).toBe(5);
  });

  it("ceils to the multiple of the step above the value", () => {
    expect(roundToStep(0.31, 0.1, "ceil")).toBeCloseTo(0.4);
    expect(roundToStep(1.01, 0.25, "ceil")).toBe(1.25);
    expect(roundToStep(5.1, 5, "ceil")).toBe(10);
  });

  it("keeps values that are already on the step", () => {
    expect(roundToStep(1.5, 0.5)).toBe(1.5);
    expect(roundToStep(1.5, 0.5, "floor")).toBe(1.5);
    expect(roundToStep(1.5, 0.5, "ceil")).toBe(1.5);
  });

  it("handles negative values", () => {
    expect(roundToStep(-0.37, 0.1)).toBeCloseTo(-0.4);
    expect(roundToStep(-0.31, 0.1, "floor")).toBeCloseTo(-0.4);
    expect(roundToStep(-0.39, 0.1, "ceil")).toBeCloseTo(-0.3);
  });
});

describe("average", () => {
  it("returns the midpoint of two numbers", () => {
    expect(average(2, 6)).toBe(4);
    expect(average(-3, 3)).toBe(0);
    expect(average(1, 2)).toBe(1.5);
  });
});

describe("isFiniteNumber", () => {
  it("accepts finite numbers", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-12.5)).toBe(true);
  });

  it("rejects non-finite numbers and non-numbers", () => {
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber("1")).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

describe("isCloseTo", () => {
  it("uses PRECISION as the default tolerance", () => {
    expect(isCloseTo(0, 0.00005)).toBe(true);
    expect(isCloseTo(0, 0.0002)).toBe(false);
    expect(isCloseTo(0, -0.0002)).toBe(false);
  });

  it("uses a strict comparison against the tolerance", () => {
    expect(isCloseTo(0, 0.5, 1)).toBe(true);
    expect(isCloseTo(0, 1, 1)).toBe(false);
    expect(isCloseTo(1, 0, 1)).toBe(false);
  });
});
