import "../src/test-utils";

describe("toCloselyEqualPoints", () => {
  it("passes when points are within the default tolerance", () => {
    expect([
      [0, 0],
      [10, 10],
    ]).toCloselyEqualPoints([
      [0.5, 0.5],
      [10.5, 9.5],
    ]);
  });

  it("respects a custom precision", () => {
    expect([[1, 1]]).toCloselyEqualPoints([[1.05, 0.95]], -1);
    expect(() => expect([[1, 1]]).toCloselyEqualPoints([[1.5, 1]], -1)).toThrow(
      "The provided array of points are not close enough",
    );
  });

  it("fails with a diff when points are too far apart", () => {
    expect(() => expect([[0, 0]]).toCloselyEqualPoints([[1000, 0]])).toThrow(
      "The provided array of points are not close enough",
    );
  });

  it("supports negation", () => {
    expect([[0, 0]]).not.toCloselyEqualPoints([[1000, 1000]]);
    expect(() => expect([[0, 0]]).not.toCloselyEqualPoints([[0, 0]])).toThrow(
      "to not be close to",
    );
  });

  it("throws when the inputs are not point arrays", () => {
    expect(() => expect("not points").toCloselyEqualPoints([[0, 0]])).toThrow(
      "expected and received are not point arrays",
    );
  });
});
