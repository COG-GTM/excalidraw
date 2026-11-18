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

const gp = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

describe("lineSegmentRotate", () => {
  it("rotates around the midpoint by default", () => {
    const [a, b] = lineSegmentRotate(
      lineSegment(gp(0, 0), gp(10, 0)),
      (Math.PI / 2) as Radians,
    );
    expect(a[0]).toBeCloseTo(5);
    expect(a[1]).toBeCloseTo(-5);
    expect(b[0]).toBeCloseTo(5);
    expect(b[1]).toBeCloseTo(5);
  });

  it("rotates around a given origin", () => {
    const [a, b] = lineSegmentRotate(
      lineSegment(gp(0, 0), gp(10, 0)),
      (Math.PI / 2) as Radians,
      gp(0, 0),
    );
    expect(a[0]).toBeCloseTo(0);
    expect(a[1]).toBeCloseTo(0);
    expect(b[0]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(10);
  });
});

describe("segmentsIntersectAt", () => {
  it("finds the crossing point", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(gp(0, 0), gp(10, 10)),
        lineSegment(gp(0, 10), gp(10, 0)),
      ),
    ).toEqual([5, 5]);
  });

  it("returns null for parallel segments", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(gp(0, 0), gp(10, 0)),
        lineSegment(gp(0, 5), gp(10, 5)),
      ),
    ).toBeNull();
  });

  it("returns null when the lines cross outside the segments", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(gp(0, 0), gp(1, 1)),
        lineSegment(gp(5, 0), gp(5, 10)),
      ),
    ).toBeNull();
  });

  it("returns null when the second segment starts on the first", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(gp(0, 0), gp(10, 0)),
        lineSegment(gp(5, 0), gp(5, 10)),
      ),
    ).toBeNull();
  });
});

describe("pointOnLineSegment", () => {
  const s = lineSegment(gp(0, 0), gp(10, 0));

  it("detects points on the segment", () => {
    expect(pointOnLineSegment(gp(5, 0), s)).toBe(true);
    expect(pointOnLineSegment(gp(5, 0.00001), s)).toBe(true);
  });

  it("rejects points off the segment", () => {
    expect(pointOnLineSegment(gp(5, 1), s)).toBe(false);
    expect(pointOnLineSegment(gp(11, 0), s)).toBe(false);
  });

  it("accepts a custom threshold", () => {
    expect(pointOnLineSegment(gp(5, 1), s, 2)).toBe(true);
  });
});

describe("distanceToLineSegment", () => {
  const s = lineSegment(gp(0, 0), gp(10, 0));

  it("measures the perpendicular distance", () => {
    expect(distanceToLineSegment(gp(5, 5), s)).toBe(5);
  });

  it("measures to the nearest endpoint beyond the segment", () => {
    expect(distanceToLineSegment(gp(-3, 4), s)).toBe(5);
    expect(distanceToLineSegment(gp(13, 4), s)).toBe(5);
  });

  it("handles a zero-length segment", () => {
    expect(
      distanceToLineSegment(gp(3, 4), lineSegment(gp(0, 0), gp(0, 0))),
    ).toBe(5);
  });
});

describe("lineSegmentsDistance", () => {
  it("is 0 for intersecting segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(gp(0, 0), gp(10, 10)),
        lineSegment(gp(0, 10), gp(10, 0)),
      ),
    ).toBe(0);
  });

  it("is the gap between parallel segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(gp(0, 0), gp(10, 0)),
        lineSegment(gp(0, 5), gp(10, 5)),
      ),
    ).toBe(5);
  });

  it("is the distance between the closest endpoints", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(gp(0, 0), gp(10, 0)),
        lineSegment(gp(13, 4), gp(20, 4)),
      ),
    ).toBe(5);
  });
});
