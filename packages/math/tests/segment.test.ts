import { pointFrom } from "../src/point";
import {
  distanceToLineSegment,
  lineSegment,
  lineSegmentIntersectionPoints,
  lineSegmentsDistance,
  isLineSegment,
} from "../src/segment";

import type { GlobalPoint } from "../src/types";

const seg = (x1: number, y1: number, x2: number, y2: number) =>
  lineSegment(pointFrom<GlobalPoint>(x1, y1), pointFrom<GlobalPoint>(x2, y2));

describe("line-segment intersections", () => {
  it("should correctly detect intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        lineSegment(pointFrom(0, 0), pointFrom(5, 0)),
        lineSegment(pointFrom(2, -2), pointFrom(3, 2)),
      ),
    ).toEqual(pointFrom(2.5, 0));
  });
  it("should correctly detect non-intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        lineSegment(pointFrom(0, 0), pointFrom(5, 0)),
        lineSegment(pointFrom(3, 1), pointFrom(4, 4)),
      ),
    ).toEqual(null);
  });
});
describe("isLineSegment validation", () => {
  it("should return true for a valid segment", () => {
    expect(
      isLineSegment([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(true);
  });

  it("should return false if second element is not a point", () => {
    const invalidSegment = [[0, 0], "not-a-point"] as any;

    expect(isLineSegment(invalidSegment)).toBe(false);
  });

  it("should return false for wrong length", () => {
    expect(isLineSegment([[0, 0]])).toBe(false);
  });
});

describe("distanceToLineSegment", () => {
  const s = seg(0, 0, 10, 0);

  it.each([
    ["projects onto the middle", [5, 3], 3],
    ["projects onto the middle (other side)", [2, -4], 4],
    ["lies on the segment", [7, 0], 0],
    ["projects before the start (nearest is start)", [-3, 4], 5],
    ["projects after the end (nearest is end)", [13, 4], 5],
    ["collinear before the start", [-2, 0], 2],
    ["collinear after the end", [12, 0], 2],
    ["is the start point", [0, 0], 0],
    ["is the end point", [10, 0], 0],
  ] as const)("point %s", (_, [x, y], expected) => {
    expect(distanceToLineSegment(pointFrom<GlobalPoint>(x, y), s)).toBeCloseTo(
      expected,
    );
  });

  it("handles a diagonal segment", () => {
    expect(
      distanceToLineSegment(pointFrom<GlobalPoint>(0, 10), seg(0, 0, 10, 10)),
    ).toBeCloseTo(Math.sqrt(50));
  });

  it("measures to the point for a zero-length segment", () => {
    const degenerate = seg(2, 2, 2, 2);
    const d = distanceToLineSegment(pointFrom<GlobalPoint>(5, 6), degenerate);
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBeCloseTo(5);
    expect(
      distanceToLineSegment(pointFrom<GlobalPoint>(2, 2), degenerate),
    ).toBe(0);
  });
});

describe("lineSegmentsDistance", () => {
  it.each([
    ["crossing segments", seg(0, 0, 10, 10), seg(0, 10, 10, 0), 0],
    ["T-touching segments", seg(0, 0, 10, 0), seg(5, 0, 5, 10), 0],
    ["parallel non-touching segments", seg(0, 0, 10, 0), seg(0, 3, 10, 3), 3],
    [
      "parallel offset segments (endpoint to endpoint)",
      seg(0, 0, 10, 0),
      seg(13, 4, 20, 4),
      5,
    ],
    [
      "perpendicular near-miss past the end",
      seg(0, 0, 10, 0),
      seg(12, -5, 12, 5),
      2,
    ],
    [
      "perpendicular near-miss above the middle",
      seg(0, 0, 10, 0),
      seg(5, 2, 5, 10),
      2,
    ],
    ["collinear disjoint segments", seg(0, 0, 4, 0), seg(7, 0, 10, 0), 3],
  ])("%s", (_, a, b, expected) => {
    expect(lineSegmentsDistance(a, b)).toBeCloseTo(expected);
    expect(lineSegmentsDistance(b, a)).toBeCloseTo(expected);
  });
});
