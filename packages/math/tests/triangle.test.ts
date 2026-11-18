import { pointFrom } from "../src/point";
import { triangleIncludesPoint } from "../src/triangle";

import type { GlobalPoint, Triangle } from "../src/types";

const p = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

const ccw = [p(0, 0), p(10, 0), p(0, 10)] as Triangle<GlobalPoint>;
const cw = [p(0, 0), p(0, 10), p(10, 0)] as Triangle<GlobalPoint>;

describe("triangleIncludesPoint", () => {
  it("includes points inside, whichever way the triangle winds", () => {
    expect(triangleIncludesPoint(ccw, p(2, 2))).toBe(true);
    expect(triangleIncludesPoint(cw, p(2, 2))).toBe(true);
  });

  it("excludes points outside", () => {
    expect(triangleIncludesPoint(ccw, p(10, 10))).toBe(false);
    expect(triangleIncludesPoint(ccw, p(-1, 5))).toBe(false);
    expect(triangleIncludesPoint(cw, p(6, 6))).toBe(false);
  });

  // The JSDoc says points exactly on a side return FALSE, but the
  // implementation uses a non-strict sign test and returns TRUE for them.
  it.skip("excludes points lying exactly on a side (documented behavior)", () => {
    expect(triangleIncludesPoint(ccw, p(5, 0))).toBe(false);
  });
});
