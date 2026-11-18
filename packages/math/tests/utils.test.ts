import {
  average,
  clamp,
  isCloseTo,
  isFiniteNumber,
  PRECISION,
  round,
  roundToStep,
} from "../src/utils";

describe("clamp", () => {
  it("clamps into the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("round", () => {
  it("rounds to the given precision", () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.25, 1)).toBe(1.3);
    expect(round(12.5, 0)).toBe(13);
  });

  it("supports floor and ceil", () => {
    expect(round(1.29, 1, "floor")).toBe(1.2);
    expect(round(1.21, 1, "ceil")).toBe(1.3);
  });
});

describe("roundToStep", () => {
  it("rounds to the nearest step", () => {
    expect(roundToStep(7, 5)).toBe(5);
    expect(roundToStep(8, 5)).toBe(10);
  });

  it("supports floor and ceil", () => {
    expect(roundToStep(0.37, 0.25, "floor")).toBe(0.25);
    expect(roundToStep(0.37, 0.25, "ceil")).toBe(0.5);
  });
});

describe("average", () => {
  it("averages two numbers", () => {
    expect(average(2, 4)).toBe(3);
    expect(average(-1, 1)).toBe(0);
  });
});

describe("isFiniteNumber", () => {
  it("accepts finite numbers only", () => {
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(-0.5)).toBe(true);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber("1")).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
  });
});

describe("isCloseTo", () => {
  it("uses PRECISION by default", () => {
    expect(isCloseTo(1, 1 + PRECISION / 2)).toBe(true);
    expect(isCloseTo(1, 1.001)).toBe(false);
  });

  it("accepts a custom precision", () => {
    expect(isCloseTo(1, 1.001, 0.01)).toBe(true);
    expect(isCloseTo(1, 1.1, 0.01)).toBe(false);
  });
});
