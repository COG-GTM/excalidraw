import { pointFrom, type GlobalPoint, type LocalPoint } from "@excalidraw/math";

import type { NullableGridSize } from "@excalidraw/excalidraw/types";

import { getGridPoint, getSizeFromPoints, rescalePoints } from "../src/points";

describe("getSizeFromPoints", () => {
  it("returns the width and height of the points' bounding box", () => {
    expect(
      getSizeFromPoints([
        pointFrom<LocalPoint>(-10, 5),
        pointFrom<LocalPoint>(30, -15),
        pointFrom<LocalPoint>(0, 25),
      ]),
    ).toEqual({ width: 40, height: 40 });
  });

  it("returns zero size for a single point", () => {
    expect(getSizeFromPoints([pointFrom<GlobalPoint>(3, 4)])).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe("rescalePoints", () => {
  const points = [
    pointFrom<LocalPoint>(10, 0),
    pointFrom<LocalPoint>(15, 1),
    pointFrom<LocalPoint>(20, 2),
  ];

  it("scales the given dimension without normalizing", () => {
    expect(rescalePoints(0, 20, points, false)).toEqual([
      [20, 0],
      [30, 1],
      [40, 2],
    ]);
  });

  it("scales the y dimension only", () => {
    expect(rescalePoints(1, 4, points, false)).toEqual([
      [10, 0],
      [15, 2],
      [20, 4],
    ]);
  });

  it("keeps the original min coordinate when normalizing", () => {
    expect(rescalePoints(0, 20, points, true)).toEqual([
      [10, 0],
      [20, 1],
      [30, 2],
    ]);
  });

  it("does not translate two-point lines when normalizing", () => {
    expect(
      rescalePoints(
        0,
        20,
        [pointFrom<LocalPoint>(10, 0), pointFrom<LocalPoint>(20, 0)],
        true,
      ),
    ).toEqual([
      [20, 0],
      [40, 0],
    ]);
  });

  it("uses a scale of 1 when the dimension has zero size", () => {
    const vertical = [
      pointFrom<LocalPoint>(5, 1),
      pointFrom<LocalPoint>(5, 2),
      pointFrom<LocalPoint>(5, 3),
    ];
    expect(rescalePoints(0, 100, vertical, true)).toEqual([
      [5, 1],
      [5, 2],
      [5, 3],
    ]);
  });
});

describe("getGridPoint", () => {
  it("snaps to the nearest grid point", () => {
    expect(getGridPoint(14, 26, 20 as NullableGridSize)).toEqual([20, 20]);
    expect(getGridPoint(-9, 31, 20 as NullableGridSize)).toEqual([-0, 40]);
  });

  it("returns the point unchanged without a grid size", () => {
    expect(getGridPoint(14.5, 26.25, null)).toEqual([14.5, 26.25]);
  });
});
