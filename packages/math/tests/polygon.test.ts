import { pointFrom } from "../src/point";
import {
  convexHull,
  polygon,
  polygonArea,
  polygonFromPoints,
  polygonIncludesPoint,
  polygonIncludesPointNonZero,
  polygonIsClosed,
  polygonSignedArea,
  simplifyConvexPolygon,
} from "../src/polygon";

import type { GlobalPoint } from "../src/types";

const square: GlobalPoint[] = [
  pointFrom(0, 0),
  pointFrom(10, 0),
  pointFrom(10, 10),
  pointFrom(0, 10),
];

describe("polygonArea", () => {
  it("measures a polygon, whichever way it winds", () => {
    expect(polygonArea(square)).toBe(100);
    expect(polygonArea([...square].reverse())).toBe(100);
  });

  it("ignores a repeated closing vertex", () => {
    expect(polygonArea([...square, square[0]])).toBe(100);
  });

  it("reports the winding direction in the sign", () => {
    expect(polygonSignedArea(square)).toBe(100);
    expect(polygonSignedArea([...square].reverse())).toBe(-100);
  });
});

describe("convexHull", () => {
  it("drops the points inside the hull", () => {
    const hull = convexHull([...square, pointFrom<GlobalPoint>(5, 5)]);

    expect(hull).toHaveLength(4);
    expect(hull).toEqual(expect.arrayContaining(square));
  });

  it("drops collinear points", () => {
    expect(convexHull([...square, pointFrom<GlobalPoint>(5, 0)])).toHaveLength(
      4,
    );
  });

  it("wraps a point cloud whatever order it arrives in", () => {
    const cloud: GlobalPoint[] = Array.from({ length: 30 }, (_, i) =>
      pointFrom(Math.cos(i * 2.4) * 10, Math.sin(i * 2.4) * 10),
    );
    const hull = convexHull(cloud);

    expect(polygonArea(hull)).toBeCloseTo(
      polygonArea(convexHull([...cloud].reverse())),
    );
    // Every point is inside or on the hull it produced.
    expect(polygonArea(hull)).toBeGreaterThan(250);
    expect(polygonArea(hull)).toBeLessThanOrEqual(Math.PI * 100);
  });

  it("returns degenerate input as-is", () => {
    const two = square.slice(0, 2);

    expect(convexHull(two)).toEqual(two);
  });
});

describe("simplifyConvexPolygon", () => {
  const circle = (n: number): GlobalPoint[] =>
    Array.from({ length: n }, (_, i) =>
      pointFrom(
        Math.cos((i * 2 * Math.PI) / n) * 100,
        Math.sin((i * 2 * Math.PI) / n) * 100,
      ),
    );

  it("keeps the corners of a polygon and drops the wobble along its sides", () => {
    // A square whose sides bulge slightly outward, as a hand-drawn one would.
    const wobbly = convexHull([
      ...square,
      pointFrom<GlobalPoint>(5, -0.2),
      pointFrom<GlobalPoint>(10.2, 5),
      pointFrom<GlobalPoint>(5, 10.2),
      pointFrom<GlobalPoint>(-0.2, 5),
    ]);

    expect(simplifyConvexPolygon(wobbly, (25 * Math.PI) / 180)).toHaveLength(4);
  });

  it("spreads an ellipse's turn over many corners", () => {
    const corners = simplifyConvexPolygon(
      convexHull(circle(64)),
      (25 * Math.PI) / 180,
    );

    // A full turn is 360°, emitted in ~25° steps.
    expect(corners.length).toBeGreaterThan(10);
    expect(corners.length).toBeLessThanOrEqual(15);
  });

  it("does not depend on where the hull happens to start", () => {
    const hull = convexHull([
      ...square,
      pointFrom<GlobalPoint>(5, -0.2),
      pointFrom<GlobalPoint>(10.2, 5),
    ]);
    const rotated = [...hull.slice(2), ...hull.slice(0, 2)];

    expect(simplifyConvexPolygon(rotated, (25 * Math.PI) / 180)).toHaveLength(
      simplifyConvexPolygon(hull, (25 * Math.PI) / 180).length,
    );
  });

  it("returns degenerate input as-is", () => {
    const two = square.slice(0, 2);

    expect(simplifyConvexPolygon(two, 0.4)).toEqual(two);
  });
});

describe("polygon construction", () => {
  it("closes an open polygon by repeating the first vertex", () => {
    const p = polygon(...square);

    expect(p).toHaveLength(5);
    expect(p[4]).toEqual(square[0]);
  });

  it("leaves an already closed polygon as-is", () => {
    const closed = [...square, square[0]];

    expect(polygonFromPoints(closed)).toBe(closed);
  });

  it("closes the polygon built from a point array", () => {
    expect(polygonFromPoints(square)).toEqual([...square, square[0]]);
  });
});

describe("polygonIsClosed", () => {
  it("is true when the last vertex matches the first", () => {
    expect(polygonIsClosed([...square, square[0]])).toBe(true);
  });

  it("is false when the last vertex differs from the first", () => {
    expect(polygonIsClosed(square)).toBe(false);
  });

  it("respects the tolerance", () => {
    const almost = [...square, pointFrom<GlobalPoint>(0.5, 0.5)];

    expect(polygonIsClosed(almost)).toBe(false);
    expect(polygonIsClosed(almost, 1)).toBe(true);
  });
});

describe("polygonIncludesPoint", () => {
  const closed = polygon(...square);

  it("finds points inside the polygon", () => {
    expect(polygonIncludesPoint(pointFrom<GlobalPoint>(5, 5), closed)).toBe(
      true,
    );
  });

  it("rejects points outside the polygon", () => {
    expect(polygonIncludesPoint(pointFrom<GlobalPoint>(15, 5), closed)).toBe(
      false,
    );
    expect(polygonIncludesPoint(pointFrom<GlobalPoint>(5, -1), closed)).toBe(
      false,
    );
  });

  it("handles concave polygons", () => {
    // A "U" shape: the notch between the arms is outside.
    const u = polygon<GlobalPoint>(
      pointFrom(0, 0),
      pointFrom(3, 0),
      pointFrom(3, 10),
      pointFrom(7, 10),
      pointFrom(7, 0),
      pointFrom(10, 0),
      pointFrom(10, 12),
      pointFrom(0, 12),
    );

    expect(polygonIncludesPoint(pointFrom<GlobalPoint>(5, 5), u)).toBe(false);
    expect(polygonIncludesPoint(pointFrom<GlobalPoint>(1, 5), u)).toBe(true);
    expect(polygonIncludesPoint(pointFrom<GlobalPoint>(5, 11), u)).toBe(true);
  });
});

describe("polygonIncludesPointNonZero", () => {
  it("finds points inside a polygon of either winding", () => {
    expect(polygonIncludesPointNonZero([5, 5], square)).toBe(true);
    expect(polygonIncludesPointNonZero([5, 5], [...square].reverse())).toBe(
      true,
    );
  });

  it("rejects points outside the polygon", () => {
    expect(polygonIncludesPointNonZero([15, 5], square)).toBe(false);
    expect(polygonIncludesPointNonZero([-5, 5], square)).toBe(false);
    expect(polygonIncludesPointNonZero([5, 15], square)).toBe(false);
  });

  it("counts self-overlapping regions as inside, unlike even-odd", () => {
    // A pentagram: its center is wound twice.
    const star: GlobalPoint[] = [0, 2, 4, 1, 3].map((i) =>
      pointFrom(
        Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * 10,
        Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * 10,
      ),
    );
    const center = pointFrom<GlobalPoint>(0, 0);

    expect(polygonIncludesPointNonZero(center, star)).toBe(true);
    expect(polygonIncludesPoint(center, polygon(...star))).toBe(false);
  });
});

describe("simplifyConvexPolygon fallback", () => {
  it("returns the input when fewer than three corners clear the threshold", () => {
    expect(simplifyConvexPolygon(square, 10)).toEqual(square);
  });
});
