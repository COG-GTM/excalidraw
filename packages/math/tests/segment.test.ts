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
  it("rotates around the segment's midpoint by default", () => {
    const [[x0, y0], [x1, y1]] = lineSegmentRotate(
      lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
      (Math.PI / 2) as Radians,
    );

    expect([x0, y0, x1, y1].map((n) => Math.round(n))).toEqual([5, -5, 5, 5]);
  });

  it("rotates around a given origin", () => {
    const [[x0, y0], [x1, y1]] = lineSegmentRotate(
      lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
      (Math.PI / 2) as Radians,
      pointFrom(0, 0),
    );

    expect([x0, y0, x1, y1].map((n) => Math.round(n))).toEqual([0, 0, 0, 10]);
  });
});

describe("segmentsIntersectAt", () => {
  it("returns the crossing point of two crossing segments", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 10)),
        lineSegment(pointFrom(0, 10), pointFrom(10, 0)),
      ),
    ).toEqual([5, 5]);
  });

  it("returns null for parallel segments", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(0, 5), pointFrom(10, 5)),
      ),
    ).toBeNull();
  });

  it("returns null when the lines cross outside the segments", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(1, 1)),
        lineSegment(pointFrom(0, 10), pointFrom(10, 0)),
      ),
    ).toBeNull();
  });

  it("returns null when the second segment starts on the first", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(5, 0), pointFrom(5, 10)),
      ),
    ).toBeNull();
  });

  it("treats the end of either segment as exclusive", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(5, 0)),
        lineSegment(pointFrom(5, -5), pointFrom(5, 5)),
      ),
    ).toBeNull();
  });
});

describe("distanceToLineSegment", () => {
  const s = lineSegment(pointFrom(0, 0), pointFrom(10, 0));

  it("measures the perpendicular distance when the projection is on the segment", () => {
    expect(distanceToLineSegment(pointFrom(5, 3), s)).toBe(3);
  });

  it("measures to the start point when the projection is before it", () => {
    expect(distanceToLineSegment(pointFrom(-3, 4), s)).toBe(5);
  });

  it("measures to the end point when the projection is past it", () => {
    expect(distanceToLineSegment(pointFrom(13, -4), s)).toBe(5);
  });

  it("handles a zero-length segment as a point", () => {
    expect(
      distanceToLineSegment(
        pointFrom(3, 4),
        lineSegment(pointFrom(0, 0), pointFrom(0, 0)),
      ),
    ).toBe(5);
  });
});

describe("pointOnLineSegment", () => {
  const s = lineSegment(pointFrom(0, 0), pointFrom(10, 10));

  it("is true for a point exactly on the segment", () => {
    expect(pointOnLineSegment(pointFrom(5, 5), s)).toBe(true);
  });

  it("is true for a point within the threshold", () => {
    expect(pointOnLineSegment(pointFrom(5, 5.00001), s)).toBe(true);
    expect(pointOnLineSegment(pointFrom(5, 6), s, 1)).toBe(true);
  });

  it("is false for a point beyond the threshold or past the ends", () => {
    expect(pointOnLineSegment(pointFrom(5, 6), s)).toBe(false);
    expect(pointOnLineSegment(pointFrom(11, 11), s)).toBe(false);
  });
});

describe("lineSegmentsDistance", () => {
  it("is zero for intersecting segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(10, 10)),
        lineSegment(pointFrom(0, 10), pointFrom(10, 0)),
      ),
    ).toBe(0);
  });

  it("is the smallest endpoint-to-segment distance otherwise", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(5, 3), pointFrom(5, 10)),
      ),
    ).toBe(3);
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(0, 2), pointFrom(10, 2)),
      ),
    ).toBe(2);
  });
});
