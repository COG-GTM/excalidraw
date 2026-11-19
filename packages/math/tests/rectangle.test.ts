import { pointFrom } from "../src/point";
import {
  rectangle,
  rectangleFromNumberSequence,
  rectangleIntersectLineSegment,
  rectangleIntersectRectangle,
} from "../src/rectangle";
import { lineSegment } from "../src/segment";

import type { GlobalPoint } from "../src/types";

const rect = rectangle<GlobalPoint>(pointFrom(0, 0), pointFrom(10, 10));

const sortPoints = (points: GlobalPoint[]) =>
  [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe("rectangle creation", () => {
  it("should create a rectangle from its corners", () => {
    expect(rect).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });

  it("should create a rectangle from a min/max number sequence", () => {
    expect(rectangleFromNumberSequence(1, 2, 3, 4)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe("rectangle and line segment intersection", () => {
  it("should find both sides a segment passes through", () => {
    const points = rectangleIntersectLineSegment(
      rect,
      lineSegment(pointFrom(-5, 5), pointFrom(15, 5)),
    );

    expect(points.length).toBe(2);
    const [left, right] = sortPoints(points);
    expect(left[0]).toBeCloseTo(0);
    expect(left[1]).toBeCloseTo(5);
    expect(right[0]).toBeCloseTo(10);
    expect(right[1]).toBeCloseTo(5);
  });

  it("should find the top and bottom sides for a vertical segment", () => {
    const points = rectangleIntersectLineSegment(
      rect,
      lineSegment(pointFrom(3, -5), pointFrom(3, 15)),
    );

    expect(points.length).toBe(2);
    const [top, bottom] = sortPoints(points);
    expect(top[0]).toBeCloseTo(3);
    expect(top[1]).toBeCloseTo(0);
    expect(bottom[0]).toBeCloseTo(3);
    expect(bottom[1]).toBeCloseTo(10);
  });

  it("should find the single side a segment leaves the rectangle through", () => {
    const points = rectangleIntersectLineSegment(
      rect,
      lineSegment(pointFrom(5, 5), pointFrom(5, 20)),
    );

    expect(points.length).toBe(1);
    expect(points[0][0]).toBeCloseTo(5);
    expect(points[0][1]).toBeCloseTo(10);
  });

  it("should find adjacent sides for a segment cutting a corner off", () => {
    const points = rectangleIntersectLineSegment(
      rect,
      lineSegment(pointFrom(-2, 4), pointFrom(4, -2)),
    );

    expect(points.length).toBe(2);
    const [left, top] = sortPoints(points);
    expect(left[0]).toBeCloseTo(0);
    expect(left[1]).toBeCloseTo(2);
    expect(top[0]).toBeCloseTo(2);
    expect(top[1]).toBeCloseTo(0);
  });

  it("should find nothing for a segment inside the rectangle", () => {
    expect(
      rectangleIntersectLineSegment(
        rect,
        lineSegment(pointFrom(2, 2), pointFrom(8, 7)),
      ),
    ).toEqual([]);
  });

  it("should find nothing for a segment outside the rectangle", () => {
    expect(
      rectangleIntersectLineSegment(
        rect,
        lineSegment(pointFrom(12, -5), pointFrom(20, 15)),
      ),
    ).toEqual([]);
  });
});

describe("rectangle and rectangle intersection", () => {
  it("should detect partially overlapping rectangles", () => {
    const other = rectangle<GlobalPoint>(pointFrom(5, 5), pointFrom(15, 15));

    expect(rectangleIntersectRectangle(rect, other)).toBe(true);
    expect(rectangleIntersectRectangle(other, rect)).toBe(true);
  });

  it("should detect a rectangle containing the other", () => {
    const inner = rectangle<GlobalPoint>(pointFrom(2, 2), pointFrom(4, 4));

    expect(rectangleIntersectRectangle(rect, inner)).toBe(true);
    expect(rectangleIntersectRectangle(inner, rect)).toBe(true);
    expect(rectangleIntersectRectangle(rect, rect)).toBe(true);
  });

  it("should not detect rectangles apart on either axis", () => {
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangle(pointFrom(11, 0), pointFrom(20, 10)),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangle(pointFrom(-20, 0), pointFrom(-1, 10)),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangle(pointFrom(0, 11), pointFrom(10, 20)),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangle(pointFrom(0, -20), pointFrom(10, -1)),
      ),
    ).toBe(false);
  });

  it("should not detect rectangles that only share an edge or a corner", () => {
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangle(pointFrom(10, 0), pointFrom(20, 10)),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangle(pointFrom(10, 10), pointFrom(20, 20)),
      ),
    ).toBe(false);
  });
});
