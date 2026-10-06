import { describe, expect, it } from "vitest";

import { getArrowheadPoints } from "./TemplatesDialog";

describe("getArrowheadPoints", () => {
  it("creates a symmetric horizontal arrowhead", () => {
    const points = getArrowheadPoints([100, 0], [0, 0], 10)
      .split(" ")
      .map((point) => point.split(",").map(Number));
    const [wing1, tip, wing2] = points;

    expect(points).toHaveLength(3);
    expect(tip).toEqual([100, 0]);
    expect(wing1[0]).toBeLessThan(100);
    expect(wing2[0]).toBeLessThan(100);
    expect(Math.abs(wing1[1] + wing2[1])).toBeLessThanOrEqual(1e-6);

    for (const wing of [wing1, wing2]) {
      expect(
        Math.abs(Math.hypot(wing[0] - tip[0], wing[1] - tip[1]) - 10),
      ).toBeLessThanOrEqual(1e-6);
    }
  });

  it("returns no points for a degenerate arrowhead", () => {
    expect(getArrowheadPoints([5, 5], [5, 5], 10)).toBe("");
  });
});
