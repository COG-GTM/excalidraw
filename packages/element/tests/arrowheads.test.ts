import { getArrowheadForPicker, normalizeArrowhead } from "../src/arrowheads";

describe("arrowheads", () => {
  it("normalizes nullish arrowheads to null", () => {
    expect(normalizeArrowhead(null)).toBe(null);
    expect(normalizeArrowhead(undefined)).toBe(null);
    expect(getArrowheadForPicker(null)).toBe(null);
    expect(getArrowheadForPicker(undefined)).toBe(null);
  });

  it("maps legacy arrowhead names to current ones", () => {
    expect(normalizeArrowhead("dot")).toBe("circle");
    expect(normalizeArrowhead("crowfoot_one")).toBe("cardinality_one");
    expect(normalizeArrowhead("crowfoot_many")).toBe("cardinality_many");
    expect(normalizeArrowhead("crowfoot_one_or_many")).toBe(
      "cardinality_one_or_many",
    );
  });

  it("passes through current arrowhead names", () => {
    expect(normalizeArrowhead("arrow")).toBe("arrow");
    expect(normalizeArrowhead("triangle")).toBe("triangle");
    expect(getArrowheadForPicker("bar")).toBe("bar");
    expect(getArrowheadForPicker("dot")).toBe("circle");
  });
});
