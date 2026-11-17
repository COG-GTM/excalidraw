import { pointFrom, type GlobalPoint, type LocalPoint } from "@excalidraw/math";

import type { NullableGridSize } from "@excalidraw/excalidraw/types";

import { getGridPoint, getSizeFromPoints, rescalePoints } from "../src/points";

describe("getSizeFromPoints()", () => {
  it("returns the bounding width and height", () => {
    expect(
      getSizeFromPoints([
        pointFrom<LocalPoint>(-5, 2),
        pointFrom<LocalPoint>(10, -3),
        pointFrom<LocalPoint>(0, 7),
      ]),
    ).toEqual({ width: 15, height: 10 });
  });

  it("returns zero size for a single point", () => {
    expect(getSizeFromPoints([pointFrom<LocalPoint>(3, 4)])).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe("rescalePoints()", () => {
  const points = [
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(10, 5),
    pointFrom<LocalPoint>(20, 10),
  ];

  it("scales the chosen dimension to the new size", () => {
    expect(rescalePoints(0, 40, points, false)).toEqual([
      [0, 0],
      [20, 5],
      [40, 10],
    ]);
    expect(rescalePoints(1, 20, points, false)).toEqual([
      [0, 0],
      [10, 10],
      [20, 20],
    ]);
  });

  it("keeps points unchanged when the dimension has zero size", () => {
    const flat = [pointFrom<LocalPoint>(0, 5), pointFrom<LocalPoint>(10, 5)];
    expect(rescalePoints(1, 100, flat, false)).toEqual([
      [0, 5],
      [10, 5],
    ]);
  });

  it("translates scaled points back to the original minimum when normalizing", () => {
    const offset = [
      pointFrom<LocalPoint>(10, 0),
      pointFrom<LocalPoint>(20, 0),
      pointFrom<LocalPoint>(30, 0),
    ];
    const result = rescalePoints(0, 40, offset, true);
    expect(result).toEqual([
      [10, 0],
      [30, 0],
      [50, 0],
    ]);
  });

  it("does not translate two-point lines when normalizing", () => {
    const line = [pointFrom<LocalPoint>(10, 0), pointFrom<LocalPoint>(20, 0)];
    expect(rescalePoints(0, 20, line, true)).toEqual([
      [20, 0],
      [40, 0],
    ]);
  });
});

describe("getGridPoint()", () => {
  it("snaps to the nearest grid intersection", () => {
    expect(getGridPoint(14, 26, 20 as NullableGridSize)).toEqual(
      pointFrom<GlobalPoint>(20, 20),
    );
    expect(getGridPoint(-9, 31, 20 as NullableGridSize)).toEqual(
      pointFrom<GlobalPoint>(-0, 40),
    );
  });

  it("returns the raw point when grid is disabled", () => {
    expect(getGridPoint(14.5, 26.2, null)).toEqual(
      pointFrom<GlobalPoint>(14.5, 26.2),
    );
  });
});
