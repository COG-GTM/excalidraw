import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { getCommonBounds } from "../src/bounds";
import { positionElementsOnGrid } from "../src/positionElementsOnGrid";

const rect = (id: string, x: number, y: number, width = 100, height = 100) =>
  API.createElement({ type: "rectangle", id, x, y, width, height });

const positions = (elements: { id: string; x: number; y: number }[]) =>
  Object.fromEntries(elements.map((el) => [el.id, [el.x, el.y]]));

describe("positionElementsOnGrid", () => {
  it("returns an empty array for empty input", () => {
    expect(positionElementsOnGrid([], 0, 0)).toEqual([]);
  });

  it("centers a single element on the given point", () => {
    const res = positionElementsOnGrid([rect("a", 500, 400, 100, 50)], 0, 0);

    expect(res).toHaveLength(1);
    expect(res[0].x).toBe(-50);
    expect(res[0].y).toBe(-25);
    expect(res[0].width).toBe(100);
    expect(res[0].height).toBe(50);
  });

  it("lays out four elements in a 2x2 grid with default padding", () => {
    const res = positionElementsOnGrid(
      [rect("a", 0, 0), rect("b", 900, 0), rect("c", 0, 900), rect("d", 7, 7)],
      0,
      0,
    );

    expect(positions(res)).toEqual({
      a: [-125, -125],
      b: [25, -125],
      c: [-125, 25],
      d: [25, 25],
    });
  });

  it("honors a custom padding", () => {
    const res = positionElementsOnGrid(
      [rect("a", 0, 0), rect("b", 0, 0)],
      100,
      100,
      10,
    );

    // 2 units -> 2 columns, single row of width 100 + 10 + 100
    expect(positions(res)).toEqual({
      a: [-5, 50],
      b: [105, 50],
    });
  });

  it("centers a shorter last row horizontally", () => {
    const res = positionElementsOnGrid(
      [rect("a", 0, 0), rect("b", 0, 0), rect("c", 0, 0)],
      0,
      0,
    );

    // ceil(sqrt(3)) = 2 columns -> rows [a, b] and [c]
    expect(positions(res)).toEqual({
      a: [-125, -125],
      b: [25, -125],
      c: [-50, 25],
    });
  });

  it("uses the tallest unit in a row to space the following row", () => {
    const res = positionElementsOnGrid(
      [
        rect("a", 0, 0, 100, 300),
        rect("b", 0, 0, 100, 100),
        rect("c", 0, 0, 100, 100),
      ],
      0,
      0,
    );

    // total height = 300 + 50 + 100 = 450 -> first row starts at -225
    const byId = positions(res);
    expect(byId.a).toEqual([-125, -225]);
    // shorter units are top-aligned within their row
    expect(byId.b).toEqual([25, -225]);
    expect(byId.c).toEqual([-50, 125]);
  });

  it("uses ceil(sqrt(n)) columns", () => {
    const elements = Array.from({ length: 5 }, (_, i) => rect(`e${i}`, 0, 0));
    const res = positionElementsOnGrid(elements, 0, 0);

    const rowYs = new Set(res.map((el) => el.y));
    const firstRow = res.filter((el) => el.y === Math.min(...rowYs));
    expect(rowYs.size).toBe(2);
    expect(firstRow).toHaveLength(3);
  });

  it("treats nested arrays as atomic units and keeps their internal layout", () => {
    const groupA = [rect("a1", 1000, 1000, 50, 50), rect("a2", 1100, 1050)];
    const groupB = [rect("b1", -300, -300)];

    const res = positionElementsOnGrid([groupA, groupB], 0, 0);
    const byId = positions(res);

    // relative offset between group members is preserved
    expect(byId.a2[0] - byId.a1[0]).toBe(100);
    expect(byId.a2[1] - byId.a1[1]).toBe(50);

    // groupA is 200x150, groupB is 100x100 -> row width 200 + 50 + 100
    expect(byId.a1).toEqual([-175, -75]);
    expect(byId.b1).toEqual([75, -75]);

    const [minX, minY, maxX, maxY] = getCommonBounds(res);
    expect((minX + maxX) / 2).toBe(0);
    expect((minY + maxY) / 2).toBe(0);
  });

  it("returns new element versions without mutating the inputs", () => {
    const original = rect("a", 300, 300);
    const { x, y, version } = original;

    const [moved] = positionElementsOnGrid([original], 0, 0);

    expect(moved).not.toBe(original);
    expect(moved.id).toBe("a");
    expect(moved.version).toBe(version + 1);
    expect(original.x).toBe(x);
    expect(original.y).toBe(y);
    expect(original.version).toBe(version);
  });
});
