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
  it("closes an open polygon", () => {
    const p = polygon(...square);

    expect(p).toHaveLength(5);
    expect(p[4]).toEqual(square[0]);
    expect(polygonFromPoints(square)).toEqual(p);
  });

  it("keeps an already closed polygon as-is", () => {
    const closed = [...square, square[0]];

    expect(polygonFromPoints(closed)).toBe(closed);
  });

  it("detects closure within a tolerance", () => {
    expect(polygonIsClosed(square)).toBe(false);
    expect(polygonIsClosed([...square, pointFrom<GlobalPoint>(0.5, 0)])).toBe(
      false,
    );
    expect(
      polygonIsClosed([...square, pointFrom<GlobalPoint>(0.5, 0)], 1),
    ).toBe(true);
  });
});

describe("polygonIncludesPoint", () => {
  const closedSquare = polygon(...square);

  it("finds points inside", () => {
    expect(polygonIncludesPoint(pointFrom(5, 5), closedSquare)).toBe(true);
    expect(polygonIncludesPoint(pointFrom(0.1, 9.9), closedSquare)).toBe(true);
  });

  it("rejects points outside", () => {
    expect(polygonIncludesPoint(pointFrom(15, 5), closedSquare)).toBe(false);
    expect(polygonIncludesPoint(pointFrom(-1, 5), closedSquare)).toBe(false);
    expect(polygonIncludesPoint(pointFrom(5, 11), closedSquare)).toBe(false);
  });

  it("handles concave polygons", () => {
    // U shape with the notch between x = 3..7 above y = 4
    const u = polygon<GlobalPoint>(
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(10, 10),
      pointFrom(7, 10),
      pointFrom(7, 4),
      pointFrom(3, 4),
      pointFrom(3, 10),
      pointFrom(0, 10),
    );

    expect(polygonIncludesPoint(pointFrom(5, 2), u)).toBe(true);
    expect(polygonIncludesPoint(pointFrom(1, 8), u)).toBe(true);
    expect(polygonIncludesPoint(pointFrom(5, 8), u)).toBe(false);
  });
});

describe("polygonIncludesPointNonZero", () => {
  it("finds points inside regardless of winding direction", () => {
    expect(polygonIncludesPointNonZero(pointFrom(5, 5), square)).toBe(true);
    expect(
      polygonIncludesPointNonZero(pointFrom(5, 5), [...square].reverse()),
    ).toBe(true);
  });

  it("rejects points outside", () => {
    expect(polygonIncludesPointNonZero(pointFrom(15, 5), square)).toBe(false);
    expect(
      polygonIncludesPointNonZero(pointFrom(-5, 5), [...square].reverse()),
    ).toBe(false);
  });

  it("treats the core of a self-overlapping star as inside, unlike even-odd", () => {
    const star: GlobalPoint[] = Array.from({ length: 5 }, (_, i) => {
      const angle = ((-90 + i * 144) * Math.PI) / 180;
      return pointFrom(Math.cos(angle) * 10, Math.sin(angle) * 10);
    });
    const center = pointFrom<GlobalPoint>(0, 0);

    expect(polygonIncludesPointNonZero(center, star)).toBe(true);
    expect(polygonIncludesPoint(center, polygon(...star))).toBe(false);
  });
});

describe("convexHull and simplifyConvexPolygon fallbacks", () => {
  it("returns collinear input unchanged", () => {
    const line: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(5, 0),
      pointFrom(10, 0),
    ];

    expect(convexHull(line)).toEqual(line);
  });

  it("returns the polygon unchanged when too few corners survive", () => {
    expect(simplifyConvexPolygon(square, 10)).toEqual(square);
  });

  it("measures a turn across the ±π seam as a shallow turn", () => {
    // at (0, 0) the heading flips from about -174° to +174°: an ~11° turn
    const quad: GlobalPoint[] = [
      pointFrom(10, 1),
      pointFrom(0, 0),
      pointFrom(-10, 1),
      pointFrom(0, 20),
    ];

    const simplified = simplifyConvexPolygon(quad, 0.5);

    expect(simplified).toHaveLength(3);
    expect(simplified).not.toContainEqual([0, 0]);
  });
});
