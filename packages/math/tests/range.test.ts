import {
  rangeIncludesValue,
  rangeInclusive,
  rangeInclusiveFromPair,
  rangeIntersection,
  rangesOverlap,
} from "../src/range";

describe("range overlap", () => {
  const range1_4 = rangeInclusive(1, 4);

  it("should overlap when range a contains range b", () => {
    expect(rangesOverlap(range1_4, rangeInclusive(2, 3))).toBe(true);
    expect(rangesOverlap(range1_4, range1_4)).toBe(true);
    expect(rangesOverlap(range1_4, rangeInclusive(1, 3))).toBe(true);
    expect(rangesOverlap(range1_4, rangeInclusive(2, 4))).toBe(true);
  });

  it("should overlap when range b contains range a", () => {
    expect(rangesOverlap(rangeInclusive(2, 3), range1_4)).toBe(true);
    expect(rangesOverlap(rangeInclusive(1, 3), range1_4)).toBe(true);
    expect(rangesOverlap(rangeInclusive(2, 4), range1_4)).toBe(true);
  });

  it("should overlap when range a and b intersect", () => {
    expect(rangesOverlap(range1_4, rangeInclusive(2, 5))).toBe(true);
  });
});

describe("range intersection", () => {
  const range1_4 = rangeInclusive(1, 4);

  it("should intersect completely with itself", () => {
    expect(rangeIntersection(range1_4, range1_4)).toEqual(range1_4);
  });

  it("should intersect irrespective of order", () => {
    expect(rangeIntersection(range1_4, rangeInclusive(2, 3))).toEqual([2, 3]);
    expect(rangeIntersection(rangeInclusive(2, 3), range1_4)).toEqual([2, 3]);
    expect(rangeIntersection(range1_4, rangeInclusive(3, 5))).toEqual(
      rangeInclusive(3, 4),
    );
    expect(rangeIntersection(rangeInclusive(3, 5), range1_4)).toEqual(
      rangeInclusive(3, 4),
    );
  });

  it("should intersect at the edge", () => {
    expect(rangeIntersection(range1_4, rangeInclusive(4, 5))).toEqual(
      rangeInclusive(4, 4),
    );
  });

  it("should not intersect", () => {
    expect(rangeIntersection(range1_4, rangeInclusive(5, 7))).toEqual(null);
  });
});

describe("range creation", () => {
  it("should create a range from two numbers", () => {
    expect(rangeInclusive(1, 4)).toEqual([1, 4]);
  });

  it("should create a range from a number pair", () => {
    const pair: [number, number] = [2, 5];

    expect(rangeInclusiveFromPair(pair)).toEqual(rangeInclusive(2, 5));
    expect(rangeInclusiveFromPair(pair)).toBe(pair);
  });
});

describe("range without overlap", () => {
  const range1_4 = rangeInclusive(1, 4);

  it("should not overlap when range b is after range a", () => {
    expect(rangesOverlap(range1_4, rangeInclusive(5, 7))).toBe(false);
  });

  it("should not overlap when range b is before range a", () => {
    expect(rangesOverlap(range1_4, rangeInclusive(-3, 0))).toBe(false);
    expect(rangeIntersection(range1_4, rangeInclusive(-3, 0))).toBe(null);
  });

  it("should overlap when the ranges only share a limit", () => {
    expect(rangesOverlap(range1_4, rangeInclusive(4, 6))).toBe(true);
    expect(rangesOverlap(range1_4, rangeInclusive(-2, 1))).toBe(true);
    expect(rangeIntersection(range1_4, rangeInclusive(-2, 1))).toEqual(
      rangeInclusive(1, 1),
    );
  });
});

describe("range with invalid limits", () => {
  it("should not overlap when a start is not a number", () => {
    expect(rangesOverlap(rangeInclusive(NaN, 4), rangeInclusive(1, 4))).toBe(
      false,
    );
    expect(
      rangeIntersection(rangeInclusive(NaN, 4), rangeInclusive(1, 4)),
    ).toBe(null);
  });
});

describe("range includes value", () => {
  const range1_4 = rangeInclusive(1, 4);

  it("should include values inside the range", () => {
    expect(rangeIncludesValue(2.5, range1_4)).toBe(true);
  });

  it("should include the limits of the range", () => {
    expect(rangeIncludesValue(1, range1_4)).toBe(true);
    expect(rangeIncludesValue(4, range1_4)).toBe(true);
  });

  it("should not include values outside of the range", () => {
    expect(rangeIncludesValue(0.999, range1_4)).toBe(false);
    expect(rangeIncludesValue(4.001, range1_4)).toBe(false);
    expect(rangeIncludesValue(NaN, range1_4)).toBe(false);
  });
});
