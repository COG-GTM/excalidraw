import { douglasPeucker } from "../src/simplify";

import type { Point } from "../src/math";

describe("douglasPeucker", () => {
  it("returns the input unchanged when epsilon is 0", () => {
    const points: Point[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ];
    expect(douglasPeucker(points, 0)).toBe(points);
  });

  it("returns inputs with two or fewer points unchanged", () => {
    const empty: Point[] = [];
    const one: Point[] = [[1, 1, 0]];
    const two: Point[] = [
      [0, 0, 0],
      [5, 5, 0],
    ];
    expect(douglasPeucker(empty, 1)).toBe(empty);
    expect(douglasPeucker(one, 1)).toBe(one);
    expect(douglasPeucker(two, 1)).toBe(two);
  });

  it("collapses collinear points to the endpoints", () => {
    expect(
      douglasPeucker(
        [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
          [3, 0, 0],
        ],
        0.1,
      ),
    ).toEqual([
      [0, 0, 0],
      [3, 0, 0],
    ]);
  });

  it("drops points that deviate less than epsilon", () => {
    expect(
      douglasPeucker(
        [
          [0, 0, 0],
          [5, 0.4, 0],
          [10, 0, 0],
        ],
        0.5,
      ),
    ).toEqual([
      [0, 0, 0],
      [10, 0, 0],
    ]);
  });

  it("keeps a point whose distance equals epsilon", () => {
    const points: Point[] = [
      [0, 0, 0],
      [5, 1, 0],
      [10, 0, 0],
    ];
    expect(douglasPeucker(points, 1)).toEqual(points);
  });

  it("keeps the farthest point and recurses into both halves", () => {
    const points: Point[] = [
      [0, 0, 0],
      [1, 0.01, 0],
      [2, 5, 0],
      [3, 10, 0],
      [4, 5, 0],
      [5, 0.01, 0],
      [6, 0, 0],
    ];
    expect(douglasPeucker(points, 2)).toEqual([
      [0, 0, 0],
      [3, 10, 0],
      [6, 0, 0],
    ]);
  });

  it("keeps every corner of a zig-zag", () => {
    const points: Point[] = [
      [0, 0, 0],
      [1, 5, 0],
      [2, 0, 0],
      [3, 5, 0],
      [4, 0, 0],
    ];
    expect(douglasPeucker(points, 1)).toEqual(points);
  });

  it("preserves the pressure component of kept points", () => {
    expect(
      douglasPeucker(
        [
          [0, 0, 0.1],
          [5, 5, 0.7],
          [10, 0, 0.3],
        ],
        1,
      ),
    ).toEqual([
      [0, 0, 0.1],
      [5, 5, 0.7],
      [10, 0, 0.3],
    ]);
  });

  it("does not mutate the input", () => {
    const points: Point[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 3, 0],
      [3, 0, 0],
    ];
    const copy = points.map((p) => [...p]);
    douglasPeucker(points, 0.5);
    expect(points).toEqual(copy);
  });
});
