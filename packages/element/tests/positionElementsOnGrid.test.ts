import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { getCommonBounds } from "../src/bounds";
import { positionElementsOnGrid } from "../src/positionElementsOnGrid";

describe("positionElementsOnGrid", () => {
  it("returns an empty array for empty input", () => {
    expect(positionElementsOnGrid([], 0, 0)).toEqual([]);
  });

  it("centers a single element around the given point", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 500,
      y: 500,
      width: 100,
      height: 40,
    });

    const [positioned] = positionElementsOnGrid([rect], 0, 0);

    expect(positioned.id).toBe(rect.id);
    expect(positioned.x).toBeCloseTo(-50);
    expect(positioned.y).toBeCloseTo(-20);
    // returns new instances, does not mutate the input
    expect(positioned).not.toBe(rect);
    expect(rect.x).toBe(500);
  });

  it("lays out a flat array into a roughly square grid with padding", () => {
    const elements = Array.from({ length: 4 }, (_, i) =>
      API.createElement({
        type: "rectangle",
        x: i * 1000,
        y: i * 1000,
        width: 100,
        height: 100,
      }),
    );

    const res = positionElementsOnGrid(elements, 0, 0, 20);

    expect(res).toHaveLength(4);
    // 2 columns x 2 rows, centered at 0,0 => total 220 x 220
    expect(res.map((el) => [el.x, el.y])).toEqual([
      [-110, -110],
      [10, -110],
      [-110, 10],
      [10, 10],
    ]);

    const [minX, minY, maxX, maxY] = getCommonBounds(res);
    expect(minX).toBeCloseTo(-110);
    expect(minY).toBeCloseTo(-110);
    expect(maxX).toBeCloseTo(110);
    expect(maxY).toBeCloseTo(110);
  });

  it("uses the tallest unit for row height and centers each row", () => {
    const tall = API.createElement({ width: 100, height: 200 });
    const short = API.createElement({ width: 100, height: 50 });
    const last = API.createElement({ width: 60, height: 60 });

    const res = positionElementsOnGrid([tall, short, last], 0, 0, 10);

    // ceil(sqrt(3)) = 2 columns -> rows [tall, short], [last]
    // total height = 200 + 60 + 10 = 270 -> start at -135
    const [t, s, l] = res;
    expect(t.y).toBeCloseTo(-135);
    expect(s.y).toBeCloseTo(-135);
    expect(t.x).toBeCloseTo(-105);
    expect(s.x).toBeCloseTo(5);
    // second row starts after tallest unit + padding, centered horizontally
    expect(l.y).toBeCloseTo(-135 + 200 + 10);
    expect(l.x).toBeCloseTo(-30);
  });

  it("keeps grouped (atomic) units together", () => {
    const a1 = API.createElement({ x: 0, y: 0, width: 50, height: 50 });
    const a2 = API.createElement({ x: 100, y: 0, width: 50, height: 50 });
    const b = API.createElement({ x: 900, y: 900, width: 50, height: 50 });

    const res = positionElementsOnGrid([[a1, a2], [b]], 0, 0, 0);

    const [pa1, pa2, pb] = res;
    // relative offset inside the unit is preserved
    expect(pa2.x - pa1.x).toBeCloseTo(100);
    expect(pa2.y - pa1.y).toBeCloseTo(0);
    // two units on one row: widths 150 + 50 => starts at -100
    expect(pa1.x).toBeCloseTo(-100);
    expect(pb.x).toBeCloseTo(50);
    expect(pa1.y).toBeCloseTo(-25);
    expect(pb.y).toBeCloseTo(-25);
  });
});
