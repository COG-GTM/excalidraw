import { pointFrom } from "../src/point";
import {
  distanceToLineSegment,
  lineSegment,
  lineSegmentIntersectionPoints,
  lineSegmentRotate,
  lineSegmentsDistance,
  isLineSegment,
  pointOnLineSegment,
  segmentsIntersectAt,
} from "../src/segment";

import type { GlobalPoint, Radians } from "../src/types";

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
  const segment = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 0));

  it("should rotate around the midpoint when no origin is given", () => {
    const [a, b] = lineSegmentRotate(segment, (Math.PI / 2) as Radians);

    expect(a[0]).toBeCloseTo(5);
    expect(a[1]).toBeCloseTo(-5);
    expect(b[0]).toBeCloseTo(5);
    expect(b[1]).toBeCloseTo(5);
  });

  it("should rotate around the provided origin", () => {
    const [a, b] = lineSegmentRotate(
      segment,
      (Math.PI / 2) as Radians,
      pointFrom(0, 0),
    );

    expect(a[0]).toBeCloseTo(0);
    expect(a[1]).toBeCloseTo(0);
    expect(b[0]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(10);
  });

  it("should swap the end points on a half turn around the midpoint", () => {
    const [a, b] = lineSegmentRotate(segment, Math.PI as Radians);

    expect(a[0]).toBeCloseTo(10);
    expect(a[1]).toBeCloseTo(0);
    expect(b[0]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(0);
  });

  it("should return the same points when the angle is zero", () => {
    expect(lineSegmentRotate(segment, 0 as Radians)).toEqual(segment);
  });
});

describe("segmentsIntersectAt", () => {
  it("should return the point two segments cross at", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 10)),
        lineSegment(pointFrom(0, 10), pointFrom(10, 0)),
      ),
    ).toEqual([5, 5]);
  });

  it("should return null for parallel segments", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(0, 5), pointFrom(10, 5)),
      ),
    ).toBe(null);
  });

  it("should return null when the segments do not reach each other", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(5, 1), pointFrom(5, 10)),
      ),
    ).toBe(null);
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(4, 0)),
        lineSegment(pointFrom(5, -5), pointFrom(5, 5)),
      ),
    ).toBe(null);
  });
});

describe("distance to line segment", () => {
  const segment = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 0));

  it("should measure the perpendicular distance next to the segment", () => {
    expect(distanceToLineSegment(pointFrom(5, 3), segment)).toBe(3);
    expect(distanceToLineSegment(pointFrom(5, -3), segment)).toBe(3);
  });

  it("should measure to the closest end point beyond the segment", () => {
    expect(distanceToLineSegment(pointFrom(-3, 4), segment)).toBe(5);
    expect(distanceToLineSegment(pointFrom(13, -4), segment)).toBe(5);
  });

  it("should be zero for points on the segment", () => {
    expect(distanceToLineSegment(pointFrom(0, 0), segment)).toBe(0);
    expect(distanceToLineSegment(pointFrom(7, 0), segment)).toBe(0);
  });

  it("should measure to the point of a zero-length segment", () => {
    expect(
      distanceToLineSegment(
        pointFrom(3, 4),
        lineSegment(pointFrom(0, 0), pointFrom(0, 0)),
      ),
    ).toBe(5);
  });
});

describe("pointOnLineSegment", () => {
  const segment = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 10));

  it("should accept points on the segment", () => {
    expect(pointOnLineSegment(pointFrom(5, 5), segment)).toBe(true);
    expect(pointOnLineSegment(pointFrom(10, 10), segment)).toBe(true);
  });

  it("should reject points off the segment", () => {
    expect(pointOnLineSegment(pointFrom(5, 6), segment)).toBe(false);
    expect(pointOnLineSegment(pointFrom(11, 11), segment)).toBe(false);
  });

  it("should respect the threshold", () => {
    expect(pointOnLineSegment(pointFrom(5, 6), segment, 1)).toBe(true);
    expect(pointOnLineSegment(pointFrom(5, 8), segment, 1)).toBe(false);
  });
});

describe("line-segment intersection threshold", () => {
  const horizontal = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(5, 0));
  const almostReaching = lineSegment<GlobalPoint>(
    pointFrom(6, -2),
    pointFrom(6, 2),
  );

  it("should not intersect when one segment stops short of the other", () => {
    expect(lineSegmentIntersectionPoints(horizontal, almostReaching)).toBe(
      null,
    );
  });

  it("should intersect within the provided threshold", () => {
    expect(
      lineSegmentIntersectionPoints(horizontal, almostReaching, 1.5),
    ).toEqual([6, 0]);
  });

  it("should not intersect parallel segments", () => {
    expect(
      lineSegmentIntersectionPoints(
        horizontal,
        lineSegment(pointFrom(0, 1), pointFrom(5, 1)),
      ),
    ).toBe(null);
  });
});

describe("distance between line segments", () => {
  const horizontal = lineSegment<GlobalPoint>(
    pointFrom(0, 0),
    pointFrom(10, 0),
  );

  it("should be zero for intersecting segments", () => {
    expect(
      lineSegmentsDistance(
        horizontal,
        lineSegment(pointFrom(5, -5), pointFrom(5, 5)),
      ),
    ).toBe(0);
  });

  it("should be the gap between parallel segments", () => {
    expect(
      lineSegmentsDistance(
        horizontal,
        lineSegment(pointFrom(0, 4), pointFrom(10, 4)),
      ),
    ).toBe(4);
  });

  it("should measure from the closest end point", () => {
    expect(
      lineSegmentsDistance(
        horizontal,
        lineSegment(pointFrom(5, 2), pointFrom(5, 9)),
      ),
    ).toBe(2);
    expect(
      lineSegmentsDistance(
        horizontal,
        lineSegment(pointFrom(13, 4), pointFrom(20, 20)),
      ),
    ).toBe(5);
  });

  it("should not depend on the order of the segments", () => {
    const other = lineSegment<GlobalPoint>(
      pointFrom(-3, -4),
      pointFrom(-9, -9),
    );

    expect(lineSegmentsDistance(horizontal, other)).toBe(5);
    expect(lineSegmentsDistance(other, horizontal)).toBe(5);
  });
});
