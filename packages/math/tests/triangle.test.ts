import { pointFrom } from "../src/point";
import { triangleIncludesPoint } from "../src/triangle";

import type { GlobalPoint, Triangle } from "../src/types";

const triangle = (...points: [number, number][]) =>
  points.map(([x, y]) => pointFrom<GlobalPoint>(x, y)) as Triangle<GlobalPoint>;

// Same triangle, counter-clockwise and clockwise vertex order (y-down)
const ccw = triangle([0, 0], [10, 0], [0, 10]);
const cw = triangle([0, 0], [0, 10], [10, 0]);

describe("triangleIncludesPoint", () => {
  describe.each([
    ["CCW winding", ccw],
    ["CW winding", cw],
  ])("%s", (_, t) => {
    it.each([
      ["near the centroid", [3, 3]],
      ["close to a vertex", [0.1, 0.1]],
      ["close to the hypotenuse", [4.9, 4.9]],
    ] as const)("includes a point %s", (__, [x, y]) => {
      expect(triangleIncludesPoint(t, pointFrom<GlobalPoint>(x, y))).toBe(true);
    });

    it.each([
      ["beyond the bottom edge", [5, -1]],
      ["beyond the left edge", [-1, 5]],
      ["beyond the hypotenuse", [6, 6]],
      ["past a vertex", [11, 0.5]],
      ["far away", [100, 100]],
    ] as const)("excludes a point %s", (__, [x, y]) => {
      expect(triangleIncludesPoint(t, pointFrom<GlobalPoint>(x, y))).toBe(
        false,
      );
    });

    // NOTE: the JSDoc on `triangleIncludesPoint` says points exactly on the
    // sides return FALSE, but the implementation is inclusive: a zero sign on
    // one edge does not flip the result. These cases pin current behavior.
    it.each([
      ["on the bottom edge", [5, 0]],
      ["on the left edge", [0, 5]],
      ["on the hypotenuse", [5, 5]],
      ["on a vertex", [10, 0]],
    ] as const)("treats a point %s as included", (__, [x, y]) => {
      expect(triangleIncludesPoint(t, pointFrom<GlobalPoint>(x, y))).toBe(true);
    });
  });

  it("gives the same result regardless of winding", () => {
    // half-unit grid so edge points are exactly representable
    for (let i = -4; i <= 24; i++) {
      for (let j = -4; j <= 24; j++) {
        const p = pointFrom<GlobalPoint>(i / 2, j / 2);
        expect(triangleIncludesPoint(ccw, p)).toBe(
          triangleIncludesPoint(cw, p),
        );
      }
    }
  });
});
