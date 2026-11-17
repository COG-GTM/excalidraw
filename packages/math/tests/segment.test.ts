import "@excalidraw/utils/test-utils";

import { pointFrom } from "../src/point";
import {
  lineSegment,
  lineSegmentIntersectionPoints,
  lineSegmentRotate,
  lineSegmentsDistance,
  isLineSegment,
} from "../src/segment";

import type { Radians } from "../src/types";

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

describe("lineSegmentRotate", () => {
  it("should rotate around the segment midpoint when no origin is given", () => {
    const rotated = lineSegmentRotate(
      lineSegment(pointFrom(0, 0), pointFrom(2, 0)),
      (Math.PI / 2) as Radians,
    );

    expect(rotated).toCloselyEqualPoints([
      [1, -1],
      [1, 1],
    ]);
  });

  it("should rotate around the given origin", () => {
    const rotated = lineSegmentRotate(
      lineSegment(pointFrom(0, 0), pointFrom(2, 0)),
      (Math.PI / 2) as Radians,
      pointFrom(0, 0),
    );

    expect(rotated).toCloselyEqualPoints([
      [0, 0],
      [0, 2],
    ]);
  });

  it("should leave the segment unchanged for a zero angle", () => {
    const segment = lineSegment(pointFrom(1, 2), pointFrom(5, 7));

    expect(lineSegmentRotate(segment, 0 as Radians)).toEqual(segment);
  });

  it("should preserve the segment length", () => {
    const segment = lineSegment(pointFrom(1, 2), pointFrom(5, 7));
    const [a, b] = lineSegmentRotate(
      segment,
      1.234 as Radians,
      pointFrom(-3, 4),
    );

    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(Math.hypot(4, 5));
  });
});

describe("lineSegmentsDistance", () => {
  it("should be 0 for intersecting segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(4, 4)),
        lineSegment(pointFrom(0, 4), pointFrom(4, 0)),
      ),
    ).toBe(0);
  });

  it("should be 0 for segments touching at an endpoint", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(4, 0)),
        lineSegment(pointFrom(4, 0), pointFrom(4, 4)),
      ),
    ).toBe(0);
  });

  it("should measure the gap between parallel segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(4, 0)),
        lineSegment(pointFrom(0, 3), pointFrom(4, 3)),
      ),
    ).toBe(3);
  });

  it("should measure the gap between collinear, disjoint segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(1, 0)),
        lineSegment(pointFrom(3, 0), pointFrom(5, 0)),
      ),
    ).toBe(2);
  });

  it("should measure from an endpoint to the interior of the other segment", () => {
    const horizontal = lineSegment(pointFrom(0, 0), pointFrom(4, 0));
    const vertical = lineSegment(pointFrom(2, 1), pointFrom(2, 5));

    expect(lineSegmentsDistance(horizontal, vertical)).toBe(1);
    expect(lineSegmentsDistance(vertical, horizontal)).toBe(1);
  });

  it("should measure between the closest endpoints of skewed segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(1, 1)),
        lineSegment(pointFrom(4, 5), pointFrom(10, 5)),
      ),
    ).toBe(5);
  });
});
