import { pointFrom } from "../src/point";
import {
  rectangle,
  rectangleFromNumberSequence,
  rectangleIntersectLineSegment,
  rectangleIntersectRectangle,
} from "../src/rectangle";
import { lineSegment } from "../src/segment";

import type { GlobalPoint } from "../src/types";

const expectPointsCloseTo = (
  actual: readonly GlobalPoint[],
  expected: [number, number][],
) => {
  expect(actual).toHaveLength(expected.length);
  expected.forEach(([x, y], idx) => {
    expect(actual[idx][0]).toBeCloseTo(x);
    expect(actual[idx][1]).toBeCloseTo(y);
  });
};

describe("rectangle creation", () => {
  it("should create a rectangle from its top left and bottom right points", () => {
    const topLeft = pointFrom<GlobalPoint>(1, 2);
    const bottomRight = pointFrom<GlobalPoint>(3, 4);
    const r = rectangle(topLeft, bottomRight);

    expect(r).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(r[0]).toBe(topLeft);
    expect(r[1]).toBe(bottomRight);
  });

  it("should create a rectangle from a number sequence", () => {
    expect(rectangleFromNumberSequence(-1, -2, 3, 4)).toEqual(
      rectangle(pointFrom(-1, -2), pointFrom(3, 4)),
    );
  });
});

describe("rectangle and line segment intersection", () => {
  const r = rectangle<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 10));

  it("should find both points when the segment crosses the rectangle", () => {
    const points = rectangleIntersectLineSegment(
      r,
      lineSegment(pointFrom(-5, 5), pointFrom(15, 5)),
    );

    // Reported in the order of the sides: top, right, bottom, left
    expectPointsCloseTo(points, [
      [10, 5],
      [0, 5],
    ]);
  });

  it("should find a single point when the segment ends inside", () => {
    expect(
      rectangleIntersectLineSegment(
        r,
        lineSegment(pointFrom(5, 5), pointFrom(5, 15)),
      ),
    ).toEqual([[5, 10]]);
    expect(
      rectangleIntersectLineSegment(
        r,
        lineSegment(pointFrom(5, 5), pointFrom(5, -15)),
      ),
    ).toEqual([[5, 0]]);
  });

  it("should find the points of a diagonal crossing", () => {
    const points = rectangleIntersectLineSegment(
      r,
      lineSegment(pointFrom(-2, 4), pointFrom(4, -2)),
    );

    expectPointsCloseTo(points, [
      [2, 0],
      [0, 2],
    ]);
  });

  it("should find nothing when the segment is fully inside", () => {
    expect(
      rectangleIntersectLineSegment(
        r,
        lineSegment(pointFrom(2, 2), pointFrom(8, 8)),
      ),
    ).toEqual([]);
  });

  it("should find nothing when the segment is fully outside", () => {
    expect(
      rectangleIntersectLineSegment(
        r,
        lineSegment(pointFrom(11, -5), pointFrom(20, 15)),
      ),
    ).toEqual([]);
  });

  it("should find nothing when the segment stops short of the rectangle", () => {
    expect(
      rectangleIntersectLineSegment(
        r,
        lineSegment(pointFrom(-10, 5), pointFrom(-1, 5)),
      ),
    ).toEqual([]);
  });
});

describe("rectangle and rectangle intersection", () => {
  const r = rectangleFromNumberSequence<GlobalPoint>(0, 0, 10, 10);

  it("should intersect when partially overlapping", () => {
    expect(
      rectangleIntersectRectangle(r, rectangleFromNumberSequence(5, 5, 15, 15)),
    ).toBe(true);
    expect(
      rectangleIntersectRectangle(rectangleFromNumberSequence(5, 5, 15, 15), r),
    ).toBe(true);
  });

  it("should intersect when one contains the other", () => {
    expect(
      rectangleIntersectRectangle(r, rectangleFromNumberSequence(2, 2, 4, 4)),
    ).toBe(true);
    expect(
      rectangleIntersectRectangle(rectangleFromNumberSequence(2, 2, 4, 4), r),
    ).toBe(true);
    expect(rectangleIntersectRectangle(r, r)).toBe(true);
  });

  it("should not intersect when apart on either axis", () => {
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence(11, 0, 20, 10),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence(-20, 0, -11, 10),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence(0, 11, 10, 20),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence(0, -20, 10, -11),
      ),
    ).toBe(false);
  });

  it("should not intersect when the rectangles only share an edge or a corner", () => {
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence(10, 0, 20, 10),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence(10, 10, 20, 20),
      ),
    ).toBe(false);
  });
});
