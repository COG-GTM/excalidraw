import { pointFrom } from "../src/point";
import {
  rectangle,
  rectangleFromNumberSequence,
  rectangleIntersectLineSegment,
  rectangleIntersectRectangle,
} from "../src/rectangle";
import { lineSegment } from "../src/segment";

import type { GlobalPoint } from "../src/types";

const r = rectangle(
  pointFrom<GlobalPoint>(0, 0),
  pointFrom<GlobalPoint>(10, 10),
);

describe("rectangle", () => {
  it("is built from its corners", () => {
    expect(r).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });

  it("is built from a number sequence", () => {
    expect(rectangleFromNumberSequence<GlobalPoint>(1, 2, 3, 4)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe("rectangleIntersectLineSegment", () => {
  it("finds where a segment crosses the sides", () => {
    const hits = rectangleIntersectLineSegment(
      r,
      lineSegment(pointFrom<GlobalPoint>(-5, 5), pointFrom<GlobalPoint>(15, 5)),
    );
    expect(hits).toHaveLength(2);
    expect(hits[0][0]).toBeCloseTo(10);
    expect(hits[0][1]).toBeCloseTo(5);
    expect(hits[1][0]).toBeCloseTo(0);
    expect(hits[1][1]).toBeCloseTo(5);
  });

  it("finds a single crossing when the segment starts inside", () => {
    const hits = rectangleIntersectLineSegment(
      r,
      lineSegment(pointFrom<GlobalPoint>(5, 5), pointFrom<GlobalPoint>(5, 20)),
    );
    expect(hits).toEqual([[5, 10]]);
  });

  it("returns nothing for a segment fully inside", () => {
    expect(
      rectangleIntersectLineSegment(
        r,
        lineSegment(pointFrom<GlobalPoint>(2, 3), pointFrom<GlobalPoint>(8, 7)),
      ),
    ).toEqual([]);
  });

  it("returns nothing for a segment fully outside", () => {
    expect(
      rectangleIntersectLineSegment(
        r,
        lineSegment(
          pointFrom<GlobalPoint>(20, 0),
          pointFrom<GlobalPoint>(30, 10),
        ),
      ),
    ).toEqual([]);
  });
});

describe("rectangleIntersectRectangle", () => {
  it("detects overlapping rectangles", () => {
    const other = rectangleFromNumberSequence<GlobalPoint>(5, 5, 15, 15);
    expect(rectangleIntersectRectangle(r, other)).toBe(true);
    expect(rectangleIntersectRectangle(other, r)).toBe(true);
  });

  it("detects containment", () => {
    const inner = rectangleFromNumberSequence<GlobalPoint>(2, 2, 4, 4);
    expect(rectangleIntersectRectangle(r, inner)).toBe(true);
  });

  it("rejects disjoint rectangles", () => {
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence<GlobalPoint>(20, 20, 30, 30),
      ),
    ).toBe(false);
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence<GlobalPoint>(0, 20, 10, 30),
      ),
    ).toBe(false);
  });

  it("treats rectangles that only share an edge as not intersecting", () => {
    expect(
      rectangleIntersectRectangle(
        r,
        rectangleFromNumberSequence<GlobalPoint>(10, 0, 20, 10),
      ),
    ).toBe(false);
  });
});
