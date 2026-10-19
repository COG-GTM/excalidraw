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
  it.each([
    ["below range", -5, 0, 10, 0],
    ["within range", 5, 0, 10, 5],
    ["above range", 15, 0, 10, 10],
    ["at min", 0, 0, 10, 0],
    ["at max", 10, 0, 10, 10],
    ["negative range", -7, -10, -5, -7],
  ])("%s", (_, value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected);
  });
});

describe("round", () => {
  it.each([
    ["default mode is round", 1.2345, 2, undefined, 1.23],
    ["round up", 1.235, 2, "round", 1.24],
    ["floor", 1.239, 2, "floor", 1.23],
    ["ceil", 1.231, 2, "ceil", 1.24],
    ["EPSILON correction (1.005)", 1.005, 2, "round", 1.01],
    ["precision 0", 2.5, 0, "round", 3],
    ["negative precision", 1234.5678, -2, "round", 1200],
    ["negative precision floor", 1299, -2, "floor", 1200],
    ["negative precision ceil", 1201, -2, "ceil", 1300],
    ["negative value floor", -1.231, 2, "floor", -1.24],
    ["negative value ceil", -1.239, 2, "ceil", -1.23],
  ] as const)("%s", (_, value, precision, func, expected) => {
    expect(round(value, precision, func)).toBeCloseTo(expected, 10);
  });
});

describe("roundToStep", () => {
  it.each([
    ["round down to nearest step", 1.3, 0.25, "round", 1.25],
    ["round up to nearest step", 1.4, 0.25, "round", 1.5],
    ["default mode is round", 1.4, 0.25, undefined, 1.5],
    ["floor", 1.49, 0.25, "floor", 1.25],
    ["ceil", 1.26, 0.25, "ceil", 1.5],
    ["exact multiple is unchanged", 1.5, 0.25, "floor", 1.5],
    ["zoom-like 0.1 step floor", 1.27, 0.1, "floor", 1.2],
    ["integer step", 17, 5, "round", 15],
    ["integer step ceil", 16, 5, "ceil", 20],
  ] as const)("%s", (_, value, step, func, expected) => {
    expect(roundToStep(value, step, func)).toBeCloseTo(expected, 10);
  });
});

describe("average", () => {
  it.each([
    [0, 10, 5],
    [-4, 4, 0],
    [1, 2, 1.5],
    [-3, -1, -2],
  ])("average(%d, %d) = %d", (a, b, expected) => {
    expect(average(a, b)).toBe(expected);
  });
});

describe("isFiniteNumber", () => {
  it.each([
    [0, true],
    [-12.5, true],
    [Number.MAX_VALUE, true],
    [NaN, false],
    [Infinity, false],
    [-Infinity, false],
    ["1", false],
    [null, false],
    [undefined, false],
    [{}, false],
  ])("%s -> %s", (value, expected) => {
    expect(isFiniteNumber(value)).toBe(expected);
  });
});

describe("isCloseTo", () => {
  it("uses PRECISION by default", () => {
    expect(isCloseTo(1, 1)).toBe(true);
    expect(isCloseTo(1, 1 + PRECISION / 2)).toBe(true);
    expect(isCloseTo(1, 1 - PRECISION / 2)).toBe(true);
    expect(isCloseTo(1, 1 + PRECISION * 2)).toBe(false);
    expect(isCloseTo(1, 1 - PRECISION * 2)).toBe(false);
  });

  it("is exclusive at the precision boundary", () => {
    expect(isCloseTo(0, 0.5, 0.5)).toBe(false);
    expect(isCloseTo(0, 0.49, 0.5)).toBe(true);
  });

  it("respects a custom precision", () => {
    expect(isCloseTo(10, 10.4, 1)).toBe(true);
    expect(isCloseTo(10, 11.5, 1)).toBe(false);
  });
});
