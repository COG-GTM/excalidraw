import {
  getGridPoint,
  getSizeFromPoints,
  rescalePoints,
} from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";
import type { NullableGridSize } from "@excalidraw/excalidraw/types";

describe("getSizeFromPoints", () => {
  it("returns the bounding width and height of the points", () => {
    expect(
      getSizeFromPoints([
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(10, -5),
        pointFrom<LocalPoint>(-4, 20),
      ]),
    ).toEqual({ width: 14, height: 25 });
  });

  it("returns zero size for a single point", () => {
    expect(getSizeFromPoints([pointFrom<LocalPoint>(3, 7)])).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe("rescalePoints", () => {
  it("scales only the x dimension when dimension is 0", () => {
    const points = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(10, 5),
      pointFrom<LocalPoint>(20, 10),
    ];
    expect(rescalePoints(0, 40, points, false)).toEqual([
      [0, 0],
      [20, 5],
      [40, 10],
    ]);
  });

  it("scales only the y dimension when dimension is 1", () => {
    const points = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(5, 10),
      pointFrom<LocalPoint>(10, 20),
    ];
    expect(rescalePoints(1, 10, points, false)).toEqual([
      [0, 0],
      [5, 5],
      [10, 10],
    ]);
  });

  it("keeps coordinates when all points share the dimension value", () => {
    const points = [pointFrom<LocalPoint>(5, 0), pointFrom<LocalPoint>(5, 10)];
    expect(rescalePoints(0, 100, points, true)).toEqual([
      [5, 0],
      [5, 10],
    ]);
  });

  it("does not translate two-point lines when normalizing", () => {
    const points = [pointFrom<LocalPoint>(10, 0), pointFrom<LocalPoint>(20, 0)];
    // scale = 30 / 10 = 3 -> [30, 60] untranslated
    expect(rescalePoints(0, 30, points, true)).toEqual([
      [30, 0],
      [60, 0],
    ]);
  });

  it("translates scaled points back to the original minimum when normalizing", () => {
    const points = [
      pointFrom<LocalPoint>(10, 1),
      pointFrom<LocalPoint>(20, 2),
      pointFrom<LocalPoint>(30, 3),
    ];
    // scale = 40 / 20 = 2 -> [20, 40, 60], translated by 10 - 20 = -10
    const result = rescalePoints(0, 40, points, true);
    expect(result).toEqual([
      [10, 1],
      [30, 2],
      [50, 3],
    ]);
    expect(getSizeFromPoints(result).width).toBe(40);
  });

  it("does not translate when not normalizing", () => {
    const points = [
      pointFrom<LocalPoint>(10, 1),
      pointFrom<LocalPoint>(20, 2),
      pointFrom<LocalPoint>(30, 3),
    ];
    expect(rescalePoints(0, 40, points, false)).toEqual([
      [20, 1],
      [40, 2],
      [60, 3],
    ]);
  });

  it("does not mutate the input points", () => {
    const points = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(10, 10),
      pointFrom<LocalPoint>(20, 20),
    ];
    rescalePoints(1, 100, points, true);
    expect(points).toEqual([
      [0, 0],
      [10, 10],
      [20, 20],
    ]);
  });
});

describe("getGridPoint", () => {
  it("snaps coordinates to the nearest grid multiple", () => {
    expect(getGridPoint(14, 26, 10 as NullableGridSize)).toEqual([10, 30]);
    expect(getGridPoint(-14, 15, 20 as NullableGridSize)).toEqual([-20, 20]);
  });

  it("returns the original coordinates when the grid is disabled", () => {
    expect(getGridPoint(14.3, 26.7, null)).toEqual(
      pointFrom<GlobalPoint>(14.3, 26.7),
    );
  });
});
