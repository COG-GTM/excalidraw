import { pointFrom } from "../src/point";
import {
  distanceToLineSegment,
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

describe("line-segment rotation", () => {
  const segment = lineSegment(pointFrom(0, 0), pointFrom(2, 0));

  it("should rotate around the midpoint when no origin is given", () => {
    const [a, b] = lineSegmentRotate(segment, (Math.PI / 2) as Radians);

    expect(a[0]).toBeCloseTo(1);
    expect(a[1]).toBeCloseTo(-1);
    expect(b[0]).toBeCloseTo(1);
    expect(b[1]).toBeCloseTo(1);
  });

  it("should swap the endpoints on a half turn around the midpoint", () => {
    const [a, b] = lineSegmentRotate(segment, Math.PI as Radians);

    expect(a[0]).toBeCloseTo(2);
    expect(a[1]).toBeCloseTo(0);
    expect(b[0]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(0);
  });

  it("should rotate around the given origin", () => {
    const [a, b] = lineSegmentRotate(
      segment,
      (Math.PI / 2) as Radians,
      pointFrom(0, 0),
    );

    expect(a[0]).toBeCloseTo(0);
    expect(a[1]).toBeCloseTo(0);
    expect(b[0]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(2);
  });

  it("should leave the segment unchanged for a zero angle", () => {
    expect(lineSegmentRotate(segment, 0 as Radians)).toEqual(segment);
  });
});

describe("point to line-segment distance", () => {
  const segment = lineSegment(pointFrom(0, 0), pointFrom(10, 0));

  it("should measure perpendicular distance within the segment", () => {
    expect(distanceToLineSegment(pointFrom(5, 3), segment)).toBe(3);
    expect(distanceToLineSegment(pointFrom(5, 0), segment)).toBe(0);
  });

  it("should measure to the nearest endpoint outside the segment", () => {
    expect(distanceToLineSegment(pointFrom(-3, 4), segment)).toBe(5);
    expect(distanceToLineSegment(pointFrom(13, -4), segment)).toBe(5);
  });

  it("should handle a zero-length segment", () => {
    expect(
      distanceToLineSegment(
        pointFrom(3, 4),
        lineSegment(pointFrom(0, 0), pointFrom(0, 0)),
      ),
    ).toBe(5);
  });
});

describe("line-segments distance", () => {
  it("should be 0 for intersecting segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(10, 10)),
        lineSegment(pointFrom(0, 10), pointFrom(10, 0)),
      ),
    ).toBe(0);
  });

  it("should be 0 for segments touching at an endpoint", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(10, 0), pointFrom(10, 10)),
      ),
    ).toBe(0);
  });

  it("should be the gap between parallel segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(0, 5), pointFrom(10, 5)),
      ),
    ).toBe(5);
  });

  it("should be the gap between collinear, disjoint segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(1, 0)),
        lineSegment(pointFrom(3, 0), pointFrom(4, 0)),
      ),
    ).toBe(2);
  });

  it("should measure from an endpoint to the other segment's interior", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(5, 2), pointFrom(5, 8)),
      ),
    ).toBe(2);
  });

  it("should measure between the closest endpoints", () => {
    const a = lineSegment(pointFrom(0, 0), pointFrom(1, 0));
    const b = lineSegment(pointFrom(4, 4), pointFrom(5, 4));

    expect(lineSegmentsDistance(a, b)).toBe(5);
    expect(lineSegmentsDistance(b, a)).toBe(5);
  });
});
