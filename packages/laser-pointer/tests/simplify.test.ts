import { douglasPeucker } from "../src/simplify";

import type { Point } from "../src/math";

describe("douglasPeucker", () => {
  it("returns the same array when epsilon is 0", () => {
    const points: Point[] = [
      [0, 0, 1],
      [1, 5, 1],
      [2, 0, 1],
    ];
    expect(douglasPeucker(points, 0)).toBe(points);
  });

  it("returns paths with two or fewer points unchanged", () => {
    const empty: Point[] = [];
    const one: Point[] = [[1, 1, 1]];
    const two: Point[] = [
      [0, 0, 1],
      [9, 9, 1],
    ];
    expect(douglasPeucker(empty, 1)).toBe(empty);
    expect(douglasPeucker(one, 1)).toBe(one);
    expect(douglasPeucker(two, 1)).toBe(two);
  });

  it("collapses collinear points to the endpoints", () => {
    const points: Point[] = [
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
      [3, 0, 4],
    ];
    expect(douglasPeucker(points, 0.1)).toEqual([
      [0, 0, 1],
      [3, 0, 4],
    ]);
  });

  it("drops points closer to the chord than epsilon", () => {
    const points: Point[] = [
      [0, 0, 1],
      [5, 0.4, 1],
      [10, 0, 1],
    ];
    expect(douglasPeucker(points, 0.5)).toEqual([
      [0, 0, 1],
      [10, 0, 1],
    ]);
  });

  it("keeps a point whose distance equals epsilon", () => {
    const points: Point[] = [
      [0, 0, 1],
      [5, 0.5, 1],
      [10, 0, 1],
    ];
    expect(douglasPeucker(points, 0.5)).toEqual(points);
  });

  it("keeps the farthest point and simplifies each half recursively", () => {
    const points: Point[] = [
      [0, 0, 1],
      [2.5, 2.6, 1],
      [5, 5, 1],
      [7.5, 2.6, 1],
      [10, 0, 1],
    ];
    expect(douglasPeucker(points, 1)).toEqual([
      [0, 0, 1],
      [5, 5, 1],
      [10, 0, 1],
    ]);
  });

  it("keeps every vertex of a zigzag larger than epsilon", () => {
    const points: Point[] = [
      [0, 0, 1],
      [1, 5, 1],
      [2, 0, 1],
      [3, 5, 1],
      [4, 0, 1],
    ];
    expect(douglasPeucker(points, 1)).toEqual(points);
  });

  it("does not mutate the input", () => {
    const points: Point[] = [
      [0, 0, 1],
      [1, 0.01, 1],
      [2, 0, 1],
    ];
    const copy = points.map((p) => [...p]);
    douglasPeucker(points, 1);
    expect(points).toEqual(copy);
  });
});
