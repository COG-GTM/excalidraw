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

describe("lineSegmentRotate", () => {
  const segment = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 0));

  it("should rotate around the midpoint by default", () => {
    const [start, end] = lineSegmentRotate(segment, (Math.PI / 2) as Radians);

    expect(start[0]).toBeCloseTo(5);
    expect(start[1]).toBeCloseTo(-5);
    expect(end[0]).toBeCloseTo(5);
    expect(end[1]).toBeCloseTo(5);
  });

  it("should rotate around the given origin", () => {
    const [start, end] = lineSegmentRotate(
      segment,
      (Math.PI / 2) as Radians,
      pointFrom(10, 0),
    );

    expect(start[0]).toBeCloseTo(10);
    expect(start[1]).toBeCloseTo(-10);
    expect(end[0]).toBeCloseTo(10);
    expect(end[1]).toBeCloseTo(0);
  });

  it("should leave the segment in place for a 0 angle", () => {
    expect(lineSegmentRotate(segment, 0 as Radians)).toEqual(segment);
  });
});

describe("segmentsIntersectAt", () => {
  const diagonal = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 10));

  it("should return the point two crossing segments meet at", () => {
    expect(
      segmentsIntersectAt(
        diagonal,
        lineSegment(pointFrom(0, 10), pointFrom(10, 0)),
      ),
    ).toEqual([5, 5]);
  });

  it("should return null for parallel segments", () => {
    expect(
      segmentsIntersectAt(
        diagonal,
        lineSegment(pointFrom(0, 1), pointFrom(10, 11)),
      ),
    ).toBe(null);
  });

  it("should return null when the lines only cross outside of a segment", () => {
    expect(
      segmentsIntersectAt(
        diagonal,
        lineSegment(pointFrom(20, 0), pointFrom(0, 40)),
      ),
    ).toBe(null);
    expect(
      segmentsIntersectAt(
        diagonal,
        lineSegment(pointFrom(0, 30), pointFrom(11, 19)),
      ),
    ).toBe(null);
  });
});

describe("distanceToLineSegment", () => {
  const segment = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 0));

  it("should measure perpendicular to the segment", () => {
    expect(distanceToLineSegment(pointFrom(5, 5), segment)).toBe(5);
    expect(distanceToLineSegment(pointFrom(5, -5), segment)).toBe(5);
  });

  it("should be 0 for a point on the segment", () => {
    expect(distanceToLineSegment(pointFrom(3, 0), segment)).toBe(0);
    expect(distanceToLineSegment(pointFrom(10, 0), segment)).toBe(0);
  });

  it("should measure to the start for a point before the segment", () => {
    expect(distanceToLineSegment(pointFrom(-3, 4), segment)).toBe(5);
  });

  it("should measure to the end for a point past the segment", () => {
    expect(distanceToLineSegment(pointFrom(13, 4), segment)).toBe(5);
  });

  it("should measure to the point of a zero length segment", () => {
    expect(
      distanceToLineSegment(
        pointFrom(4, 5),
        lineSegment(pointFrom(1, 1), pointFrom(1, 1)),
      ),
    ).toBe(5);
  });
});

describe("pointOnLineSegment", () => {
  const segment = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 0));

  it("should accept a point on the segment", () => {
    expect(pointOnLineSegment(pointFrom(5, 0), segment)).toBe(true);
    expect(pointOnLineSegment(pointFrom(0, 0), segment)).toBe(true);
  });

  it("should accept a point within the default precision", () => {
    expect(pointOnLineSegment(pointFrom(5, 0.00001), segment)).toBe(true);
  });

  it("should reject a point off the segment", () => {
    expect(pointOnLineSegment(pointFrom(5, 0.01), segment)).toBe(false);
    expect(pointOnLineSegment(pointFrom(10.01, 0), segment)).toBe(false);
  });

  it("should honor a custom threshold", () => {
    expect(pointOnLineSegment(pointFrom(5, 0.4), segment, 0.5)).toBe(true);
    expect(pointOnLineSegment(pointFrom(5, 0.5), segment, 0.5)).toBe(false);
    expect(pointOnLineSegment(pointFrom(5, 0), segment, 0)).toBe(true);
  });
});

describe("line-segment intersection threshold", () => {
  const horizontal = lineSegment<GlobalPoint>(pointFrom(0, 0), pointFrom(5, 0));
  const short = lineSegment<GlobalPoint>(pointFrom(2, 0.5), pointFrom(2, 5));

  it("should not detect an intersection for a segment ending short", () => {
    expect(lineSegmentIntersectionPoints(horizontal, short)).toBe(null);
  });

  it("should detect a near miss within the threshold", () => {
    expect(lineSegmentIntersectionPoints(horizontal, short, 1)).toEqual([2, 0]);
  });

  it("should not detect an intersection for parallel segments", () => {
    expect(
      lineSegmentIntersectionPoints(
        horizontal,
        lineSegment(pointFrom(0, 1), pointFrom(5, 1)),
        10,
      ),
    ).toBe(null);
  });
});

describe("lineSegmentsDistance", () => {
  const horizontal = lineSegment<GlobalPoint>(
    pointFrom(0, 0),
    pointFrom(10, 0),
  );

  it("should be 0 for intersecting segments", () => {
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
        lineSegment(pointFrom(0, 5), pointFrom(10, 5)),
      ),
    ).toBe(5);
  });

  it("should measure from the end of one segment to the body of the other", () => {
    expect(
      lineSegmentsDistance(
        horizontal,
        lineSegment(pointFrom(5, 2), pointFrom(5, 8)),
      ),
    ).toBe(2);
    expect(
      lineSegmentsDistance(
        lineSegment(pointFrom(5, 2), pointFrom(5, 8)),
        horizontal,
      ),
    ).toBe(2);
  });

  it("should measure between the closest ends of segments apart", () => {
    expect(
      lineSegmentsDistance(
        horizontal,
        lineSegment(pointFrom(13, 4), pointFrom(20, 4)),
      ),
    ).toBe(5);
  });
});
