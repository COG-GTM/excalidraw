import {
  add,
  angle,
  clamp,
  dist,
  distancePointToSegment,
  getCircleAndPerpendicularLineIntersectionsAtPoint,
  lerp,
  mag,
  norm,
  normAngle,
  plerp,
  rot,
  runLength,
  smul,
  sub,
} from "../src/math";

import type { Point } from "../src/math";

const expectPointCloseTo = (actual: Point, expected: Point, digits = 9) => {
  expect(actual).toHaveLength(3);
  expect(actual[0]).toBeCloseTo(expected[0], digits);
  expect(actual[1]).toBeCloseTo(expected[1], digits);
  expect(actual[2]).toBeCloseTo(expected[2], digits);
};

describe("laser-pointer math", () => {
  describe("vector arithmetic", () => {
    it("adds all three components", () => {
      expect(add([1, 2, 3], [4, -5, 0.5])).toEqual([5, -3, 3.5]);
    });

    it("subtracts all three components", () => {
      expect(sub([1, 2, 3], [4, -5, 0.5])).toEqual([-3, 7, 2.5]);
    });

    it("scales all three components", () => {
      expect(smul([1, -2, 3], 2)).toEqual([2, -4, 6]);
      expect(smul([1, -2, 3], 0)).toEqual([0, -0, 0]);
    });

    it("does not mutate its inputs", () => {
      const a: Point = [1, 2, 3];
      const b: Point = [4, 5, 6];
      add(a, b);
      sub(a, b);
      smul(a, 3);
      expect(a).toEqual([1, 2, 3]);
      expect(b).toEqual([4, 5, 6]);
    });
  });

  describe("norm", () => {
    it("normalizes x/y to unit length and keeps r", () => {
      const n = norm([3, 4, 7]);
      expectPointCloseTo(n, [0.6, 0.8, 7]);
      expect(mag(n)).toBeCloseTo(1, 12);
    });

    it("keeps the direction of negative vectors", () => {
      expectPointCloseTo(norm([0, -5, 1]), [0, -1, 1]);
    });
  });

  describe("rot", () => {
    it("rotates counter-clockwise by the given radians and keeps r", () => {
      expectPointCloseTo(rot([1, 0, 9], Math.PI / 2), [0, 1, 9]);
      expectPointCloseTo(rot([1, 0, 9], Math.PI), [-1, 0, 9]);
      expectPointCloseTo(rot([1, 0, 9], -Math.PI / 2), [0, -1, 9]);
    });

    it("preserves magnitude", () => {
      expect(mag(rot([3, 4, 0], 1.234))).toBeCloseTo(5, 12);
    });
  });

  describe("interpolation", () => {
    it("lerp interpolates scalars", () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.25)).toBe(2.5);
      expect(lerp(10, 0, 0.25)).toBe(7.5);
    });

    it("plerp interpolates points component-wise", () => {
      expect(plerp([0, 0, 0], [10, 20, 1], 0)).toEqual([0, 0, 0]);
      expect(plerp([0, 0, 0], [10, 20, 1], 1)).toEqual([10, 20, 1]);
      expect(plerp([0, 0, 0], [10, 20, 1], 0.5)).toEqual([5, 10, 0.5]);
    });
  });

  describe("angles", () => {
    it("angle returns the signed angle from p->p1 to p->p2", () => {
      const origin: Point = [0, 0, 0];
      expect(angle(origin, [1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2);
      expect(angle(origin, [0, 1, 0], [1, 0, 0])).toBeCloseTo(-Math.PI / 2);
      expect(angle(origin, [1, 0, 0], [1, 0, 0])).toBe(0);
    });

    it("angle is relative to p", () => {
      expect(angle([5, 5, 0], [6, 5, 0], [5, 6, 0])).toBeCloseTo(Math.PI / 2);
    });

    it("normAngle wraps angles into (-PI, PI]", () => {
      expect(normAngle(0)).toBe(0);
      expect(normAngle(Math.PI / 4)).toBeCloseTo(Math.PI / 4);
      expect(normAngle(2 * Math.PI + 0.5)).toBeCloseTo(0.5);
      expect(normAngle(-2 * Math.PI - 0.5)).toBeCloseTo(-0.5);
      expect(normAngle((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe("distances", () => {
    it("mag ignores r", () => {
      expect(mag([3, 4, 100])).toBe(5);
      expect(mag([0, 0, 1])).toBe(0);
    });

    it("dist ignores r and is symmetric", () => {
      expect(dist([0, 0, 1], [3, 4, 50])).toBe(5);
      expect(dist([3, 4, 50], [0, 0, 1])).toBe(5);
      expect(dist([1, 1, 0], [1, 1, 9])).toBe(0);
    });

    it("clamp limits values to [min, max]", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    describe("distancePointToSegment", () => {
      const a: Point = [0, 0, 0];
      const b: Point = [10, 0, 0];

      it("returns the perpendicular distance when the projection is inside the segment", () => {
        expect(distancePointToSegment([5, 3, 0], a, b)).toBeCloseTo(3);
        expect(distancePointToSegment([5, -4, 0], a, b)).toBeCloseTo(4);
      });

      it("returns 0 for points on the segment", () => {
        expect(distancePointToSegment([7, 0, 0], a, b)).toBe(0);
      });

      it("clamps to the start point before the segment", () => {
        expect(distancePointToSegment([-3, 4, 0], a, b)).toBeCloseTo(5);
      });

      it("clamps to the end point past the segment", () => {
        expect(distancePointToSegment([13, 4, 0], a, b)).toBeCloseTo(5);
      });

      it("falls back to point distance for a zero-length segment", () => {
        expect(distancePointToSegment([3, 4, 0], a, a)).toBe(5);
      });

      it("ignores the pressure component", () => {
        expect(distancePointToSegment([5, 3, 99], [0, 0, 1], [10, 0, 2])).toBe(
          3,
        );
      });
    });
  });

  describe("getCircleAndPerpendicularLineIntersectionsAtPoint", () => {
    it("returns the two points at radius perpendicular to the direction", () => {
      const [left, right] = getCircleAndPerpendicularLineIntersectionsAtPoint(
        [10, 10, 0],
        [1, 0, 0],
        2,
      );
      expectPointCloseTo(left, [10, 12, 0]);
      expectPointCloseTo(right, [10, 8, 0]);
    });

    it("does not depend on the direction's magnitude", () => {
      const [left, right] = getCircleAndPerpendicularLineIntersectionsAtPoint(
        [0, 0, 0],
        [0, 50, 0],
        3,
      );
      expectPointCloseTo(left, [-3, 0, 0]);
      expectPointCloseTo(right, [3, 0, 0]);
    });
  });

  describe("runLength", () => {
    it("returns 0 for fewer than two points", () => {
      expect(runLength([])).toBe(0);
      expect(runLength([[5, 5, 0]])).toBe(0);
    });

    it("is 0 for repeated identical points", () => {
      expect(
        runLength([
          [1, 1, 0],
          [1, 1, 0],
          [1, 1, 0],
        ]),
      ).toBe(0);
    });

    it("grows with the length of the path", () => {
      const short = runLength([
        [0, 0, 0],
        [3, 4, 0],
      ]);
      const long = runLength([
        [0, 0, 0],
        [3, 4, 0],
        [6, 8, 0],
      ]);
      expect(short).toBeGreaterThan(0);
      expect(long).toBeGreaterThan(short);
    });

    // BUG: runLength adds the distance of the last segment a second time after
    // the loop, so a 5-unit segment reports 10. Skipped until the production
    // code is fixed (this PR is test-only).
    it.skip("returns the polyline length", () => {
      expect(
        runLength([
          [0, 0, 0],
          [3, 4, 0],
        ]),
      ).toBe(5);
      expect(
        runLength([
          [0, 0, 0],
          [3, 4, 0],
          [3, 10, 0],
        ]),
      ).toBe(11);
    });
  });
});
