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
  it("rotates around the midpoint by default", () => {
    const [[x0, y0], [x1, y1]] = lineSegmentRotate(
      lineSegment(pointFrom<GlobalPoint>(0, 0), pointFrom<GlobalPoint>(10, 0)),
      (Math.PI / 2) as Radians,
    );

    expect(x0).toBeCloseTo(5);
    expect(y0).toBeCloseTo(-5);
    expect(x1).toBeCloseTo(5);
    expect(y1).toBeCloseTo(5);
  });

  it("rotates around a given origin", () => {
    const [[x0, y0], [x1, y1]] = lineSegmentRotate(
      lineSegment(pointFrom<GlobalPoint>(0, 0), pointFrom<GlobalPoint>(10, 0)),
      (Math.PI / 2) as Radians,
      pointFrom<GlobalPoint>(0, 0),
    );

    expect(x0).toBeCloseTo(0);
    expect(y0).toBeCloseTo(0);
    expect(x1).toBeCloseTo(0);
    expect(y1).toBeCloseTo(10);
  });
});

describe("segmentsIntersectAt", () => {
  const horizontal = lineSegment(
    pointFrom<GlobalPoint>(0, 0),
    pointFrom<GlobalPoint>(10, 0),
  );

  it("returns the crossing point", () => {
    expect(
      segmentsIntersectAt(
        horizontal,
        lineSegment(
          pointFrom<GlobalPoint>(4, -5),
          pointFrom<GlobalPoint>(4, 5),
        ),
      ),
    ).toEqual([4, 0]);
  });

  it("returns null for parallel segments", () => {
    expect(
      segmentsIntersectAt(
        horizontal,
        lineSegment(
          pointFrom<GlobalPoint>(0, 1),
          pointFrom<GlobalPoint>(10, 1),
        ),
      ),
    ).toBeNull();
  });

  it("returns null when the lines cross outside either segment", () => {
    expect(
      segmentsIntersectAt(
        horizontal,
        lineSegment(
          pointFrom<GlobalPoint>(20, -5),
          pointFrom<GlobalPoint>(20, 5),
        ),
      ),
    ).toBeNull();
    expect(
      segmentsIntersectAt(
        horizontal,
        lineSegment(pointFrom<GlobalPoint>(4, 1), pointFrom<GlobalPoint>(4, 5)),
      ),
    ).toBeNull();
  });

  it("ignores touches at the start of the second segment and the end of the first", () => {
    expect(
      segmentsIntersectAt(
        horizontal,
        lineSegment(pointFrom<GlobalPoint>(4, 0), pointFrom<GlobalPoint>(4, 5)),
      ),
    ).toBeNull();
    expect(
      segmentsIntersectAt(
        horizontal,
        lineSegment(
          pointFrom<GlobalPoint>(10, -5),
          pointFrom<GlobalPoint>(10, 5),
        ),
      ),
    ).toBeNull();
  });
});

describe("distanceToLineSegment", () => {
  const s = lineSegment(
    pointFrom<GlobalPoint>(0, 0),
    pointFrom<GlobalPoint>(10, 0),
  );

  it("measures perpendicular distance within the segment", () => {
    expect(distanceToLineSegment(pointFrom<GlobalPoint>(5, 3), s)).toBe(3);
  });

  it("measures to the nearest end point beyond the segment", () => {
    expect(distanceToLineSegment(pointFrom<GlobalPoint>(-3, 4), s)).toBe(5);
    expect(distanceToLineSegment(pointFrom<GlobalPoint>(13, 4), s)).toBe(5);
  });

  it("measures to the point of a zero-length segment", () => {
    expect(
      distanceToLineSegment(
        pointFrom<GlobalPoint>(3, 4),
        lineSegment(pointFrom<GlobalPoint>(0, 0), pointFrom<GlobalPoint>(0, 0)),
      ),
    ).toBe(5);
  });
});

describe("pointOnLineSegment", () => {
  const s = lineSegment(
    pointFrom<GlobalPoint>(0, 0),
    pointFrom<GlobalPoint>(10, 10),
  );

  it("accepts points exactly on the segment", () => {
    expect(pointOnLineSegment(pointFrom<GlobalPoint>(5, 5), s)).toBe(true);
    expect(pointOnLineSegment(pointFrom<GlobalPoint>(0, 0), s)).toBe(true);
  });

  it("accepts points within the threshold", () => {
    expect(pointOnLineSegment(pointFrom<GlobalPoint>(5, 5.00001), s)).toBe(
      true,
    );
    expect(pointOnLineSegment(pointFrom<GlobalPoint>(5, 6), s, 1)).toBe(true);
  });

  it("rejects points off the segment or past its ends", () => {
    expect(pointOnLineSegment(pointFrom<GlobalPoint>(5, 6), s)).toBe(false);
    expect(pointOnLineSegment(pointFrom<GlobalPoint>(11, 11), s)).toBe(false);
  });
});

describe("lineSegmentIntersectionPoints edge cases", () => {
  it("returns null for parallel segments", () => {
    expect(
      lineSegmentIntersectionPoints(
        lineSegment(pointFrom<GlobalPoint>(0, 0), pointFrom<GlobalPoint>(5, 0)),
        lineSegment(pointFrom<GlobalPoint>(0, 1), pointFrom<GlobalPoint>(5, 1)),
      ),
    ).toBeNull();
  });

  it("returns null when the crossing lies on only one segment", () => {
    expect(
      lineSegmentIntersectionPoints(
        lineSegment(pointFrom<GlobalPoint>(0, 0), pointFrom<GlobalPoint>(5, 0)),
        lineSegment(
          pointFrom<GlobalPoint>(8, -2),
          pointFrom<GlobalPoint>(8, 2),
        ),
      ),
    ).toBeNull();
  });
});

describe("lineSegmentsDistance", () => {
  it("is 0 for crossing segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(
          pointFrom<GlobalPoint>(0, 0),
          pointFrom<GlobalPoint>(10, 0),
        ),
        lineSegment(
          pointFrom<GlobalPoint>(5, -5),
          pointFrom<GlobalPoint>(5, 5),
        ),
      ),
    ).toBe(0);
  });

  it("is the gap between parallel segments", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(
          pointFrom<GlobalPoint>(0, 0),
          pointFrom<GlobalPoint>(10, 0),
        ),
        lineSegment(pointFrom<GlobalPoint>(2, 3), pointFrom<GlobalPoint>(8, 3)),
      ),
    ).toBe(3);
  });

  it("uses the closest end point of either segment", () => {
    expect(
      lineSegmentsDistance(
        lineSegment(
          pointFrom<GlobalPoint>(0, 0),
          pointFrom<GlobalPoint>(10, 0),
        ),
        lineSegment(
          pointFrom<GlobalPoint>(13, -4),
          pointFrom<GlobalPoint>(20, -20),
        ),
      ),
    ).toBe(5);
  });
});
