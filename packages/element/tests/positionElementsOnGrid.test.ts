import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { getCommonBounds } from "../src/bounds";
import { positionElementsOnGrid } from "../src/positionElementsOnGrid";

import type { ExcalidrawElement } from "../src/types";

const rect = (
  width: number,
  height: number,
  x = 0,
  y = 0,
  opts: { groupIds?: string[] } = {},
) => API.createElement({ type: "rectangle", x, y, width, height, ...opts });

const byId = (elements: readonly ExcalidrawElement[]) =>
  new Map(elements.map((el) => [el.id, el]));

const center = (elements: readonly ExcalidrawElement[]) => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
};

describe("positionElementsOnGrid", () => {
  it("returns an empty array for empty input", () => {
    expect(positionElementsOnGrid([], 100, 100)).toEqual([]);
  });

  it("centers a single element on (centerX, centerY)", () => {
    const el = rect(100, 60, 1000, -500);
    const [positioned] = positionElementsOnGrid([el], 300, 200);

    expect(positioned.id).toBe(el.id);
    expect(positioned.x).toBe(250);
    expect(positioned.y).toBe(170);
    expect(positioned.width).toBe(100);
    expect(positioned.height).toBe(60);
  });

  it("lays out 4 equal elements as a 2x2 grid centered on the target with padding gaps", () => {
    const elements = [
      rect(100, 100),
      rect(100, 100),
      rect(100, 100),
      rect(100, 100),
    ];
    const padding = 20;
    const res = positionElementsOnGrid(elements, 0, 0, padding);

    expect(res.map((el) => el.id)).toEqual(elements.map((el) => el.id));
    // grid is 100 + 20 + 100 = 220 wide and tall
    expect(res.map((el) => [el.x, el.y])).toEqual([
      [-110, -110],
      [10, -110],
      [-110, 10],
      [10, 10],
    ]);
    expect(getCommonBounds(res)).toEqual([-110, -110, 110, 110]);
    expect(center(res)).toEqual([0, 0]);
  });

  it("uses the default padding of 50", () => {
    const res = positionElementsOnGrid([rect(100, 100), rect(100, 100)], 0, 0);
    // 2 units -> ceil(sqrt(2)) = 2 columns, single row 250 wide
    expect(res.map((el) => [el.x, el.y])).toEqual([
      [-125, -50],
      [25, -50],
    ]);
  });

  it("lays out 5 elements as 3 + 2 with the last row centered", () => {
    const elements = Array.from({ length: 5 }, () => rect(100, 100));
    const padding = 10;
    const res = positionElementsOnGrid(elements, 500, 500, padding);

    // ceil(sqrt(5)) = 3 columns; total height = 100 + 10 + 100 = 210
    const firstRow = res.slice(0, 3);
    const lastRow = res.slice(3);

    // first row: 3 * 100 + 2 * 10 = 320 wide
    expect(firstRow.map((el) => [el.x, el.y])).toEqual([
      [340, 395],
      [450, 395],
      [560, 395],
    ]);
    // last row: 2 * 100 + 10 = 210 wide, centered on x = 500
    expect(lastRow.map((el) => [el.x, el.y])).toEqual([
      [395, 505],
      [505, 505],
    ]);
    expect(center(lastRow)[0]).toBe(500);
    expect(center(res)).toEqual([500, 500]);
  });

  it("uses ceil(sqrt(n)) columns", () => {
    const rowsFor = (n: number) => {
      const res = positionElementsOnGrid(
        Array.from({ length: n }, () => rect(10, 10)),
        0,
        0,
        0,
      );
      return new Set(res.map((el) => el.y)).size;
    };
    expect(rowsFor(1)).toBe(1);
    expect(rowsFor(2)).toBe(1);
    expect(rowsFor(3)).toBe(2); // 2 columns
    expect(rowsFor(4)).toBe(2);
    expect(rowsFor(9)).toBe(3);
    expect(rowsFor(10)).toBe(3); // 4 columns
  });

  it("uses the tallest unit in a row as the row height", () => {
    const a = rect(100, 50);
    const b = rect(80, 200);
    const c = rect(60, 40);
    const padding = 10;
    const res = byId(positionElementsOnGrid([a, b, c], 0, 0, padding));

    // 2 columns: row 1 = [a, b] (height 200), row 2 = [c] (height 40)
    // total height = 200 + 10 + 40 = 250 -> starts at y = -125
    expect(res.get(a.id)!.y).toBe(-125);
    expect(res.get(b.id)!.y).toBe(-125);
    expect(res.get(c.id)!.y).toBe(-125 + 200 + padding);

    // row 1 width = 100 + 10 + 80 = 190
    expect(res.get(a.id)!.x).toBe(-95);
    expect(res.get(b.id)!.x).toBe(-95 + 100 + padding);
    // row 2 width = 60
    expect(res.get(c.id)!.x).toBe(-30);
  });

  it("moves nested groups as a single unit, preserving relative offsets", () => {
    const g1a = rect(50, 50, 1000, 1000, { groupIds: ["g1"] });
    const g1b = rect(50, 50, 1100, 1030, { groupIds: ["g1"] });
    const g2 = rect(100, 100, -300, 40);
    const padding = 20;

    const res = positionElementsOnGrid([[g1a, g1b], [g2]], 0, 0, padding);
    expect(res.map((el) => el.id)).toEqual([g1a.id, g1b.id, g2.id]);

    const map = byId(res);
    const pa = map.get(g1a.id)!;
    const pb = map.get(g1b.id)!;
    const p2 = map.get(g2.id)!;

    // relative offset inside the group is preserved
    expect(pb.x - pa.x).toBe(100);
    expect(pb.y - pa.y).toBe(30);

    // 2 units -> 1 row: group (150x80) + padding + g2 (100x100) = 270 wide, 100 tall
    expect([pa.x, pa.y]).toEqual([-135, -50]);
    expect([p2.x, p2.y]).toEqual([-135 + 150 + padding, -50]);
    expect(center(res)).toEqual([0, 0]);
  });

  it("does not mutate input elements and returns new element versions", () => {
    const elements = [rect(100, 100, 5, 5), rect(100, 100, 5, 5)];
    const snapshot = elements.map((el) => ({ ...el }));

    const res = positionElementsOnGrid(elements, 400, 400);

    expect(elements).toEqual(snapshot);
    res.forEach((el, i) => {
      expect(el).not.toBe(elements[i]);
      expect(el.id).toBe(elements[i].id);
      expect(el.version).toBeGreaterThan(elements[i].version);
    });
  });
});
