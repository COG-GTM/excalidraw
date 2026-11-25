import { pointFrom } from "../src/point";
import { triangleIncludesPoint } from "../src/triangle";

import type { GlobalPoint, Triangle } from "../src/types";

const p = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);
const triangle = (a: GlobalPoint, b: GlobalPoint, c: GlobalPoint) =>
  [a, b, c] as Triangle<GlobalPoint>;

// Counter-clockwise in a y-down canvas coordinate system
const ccw = triangle(p(0, 0), p(10, 0), p(0, 10));
// Same triangle, opposite winding
const cw = triangle(p(0, 0), p(0, 10), p(10, 0));

describe("triangleIncludesPoint", () => {
  it("includes a point strictly inside the triangle for either winding", () => {
    expect(triangleIncludesPoint(ccw, p(2, 2))).toBe(true);
    expect(triangleIncludesPoint(cw, p(2, 2))).toBe(true);
    expect(triangleIncludesPoint(ccw, p(4.9, 4.9))).toBe(true);
    expect(triangleIncludesPoint(cw, p(4.9, 4.9))).toBe(true);
  });

  it("excludes points beyond each edge", () => {
    for (const t of [ccw, cw]) {
      // beyond a-b (above the x axis)
      expect(triangleIncludesPoint(t, p(5, -1))).toBe(false);
      // beyond c-a (left of the y axis)
      expect(triangleIncludesPoint(t, p(-1, 5))).toBe(false);
      // beyond the hypotenuse
      expect(triangleIncludesPoint(t, p(6, 6))).toBe(false);
    }
  });

  it("excludes points beyond the vertices", () => {
    expect(triangleIncludesPoint(ccw, p(-1, -1))).toBe(false);
    expect(triangleIncludesPoint(ccw, p(11, -1))).toBe(false);
    expect(triangleIncludesPoint(ccw, p(-1, 11))).toBe(false);
    expect(triangleIncludesPoint(ccw, p(100, 100))).toBe(false);
  });

  it("does not depend on which vertex comes first", () => {
    const rotated = triangle(ccw[1], ccw[2], ccw[0]);

    expect(triangleIncludesPoint(rotated, p(2, 2))).toBe(true);
    expect(triangleIncludesPoint(rotated, p(6, 6))).toBe(false);
  });

  it("works for triangles away from the origin", () => {
    const shifted = triangle(p(100, 100), p(200, 120), p(140, 220));

    expect(triangleIncludesPoint(shifted, p(150, 140))).toBe(true);
    expect(triangleIncludesPoint(shifted, p(100, 200))).toBe(false);
    expect(triangleIncludesPoint(shifted, p(210, 200))).toBe(false);
  });
});
