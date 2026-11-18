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

describe("range construction", () => {
  it("builds a range from two numbers or a pair", () => {
    expect(rangeInclusive(1, 3)).toEqual([1, 3]);
    expect(rangeInclusiveFromPair([2, 4])).toEqual([2, 4]);
  });
});

describe("range non-overlap", () => {
  it("does not overlap when the ranges are disjoint, in either order", () => {
    expect(rangesOverlap(rangeInclusive(1, 3), rangeInclusive(4, 5))).toBe(
      false,
    );
    expect(rangesOverlap(rangeInclusive(4, 5), rangeInclusive(1, 3))).toBe(
      false,
    );
  });

  it("overlaps when the ranges touch at an edge", () => {
    expect(rangesOverlap(rangeInclusive(4, 5), rangeInclusive(1, 4))).toBe(
      true,
    );
  });

  it("does not overlap when a bound is NaN", () => {
    expect(rangesOverlap(rangeInclusive(NaN, 1), rangeInclusive(0, 1))).toBe(
      false,
    );
  });
});

describe("rangeIncludesValue", () => {
  const range = rangeInclusive(1, 3);

  it("includes values within the range, bounds included", () => {
    expect(rangeIncludesValue(2, range)).toBe(true);
    expect(rangeIncludesValue(1, range)).toBe(true);
    expect(rangeIncludesValue(3, range)).toBe(true);
  });

  it("excludes values outside the range", () => {
    expect(rangeIncludesValue(0, range)).toBe(false);
    expect(rangeIncludesValue(3.5, range)).toBe(false);
  });
});
