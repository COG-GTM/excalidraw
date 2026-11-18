import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import { distanceToElement } from "../src/distance";

const p = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

describe("distanceToElement", () => {
  const elementsMap = new Map();

  it("rectangle", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });

    expect(distanceToElement(rect, elementsMap, p(150, 50))).toBeCloseTo(50);
    expect(distanceToElement(rect, elementsMap, p(50, 50))).toBeCloseTo(50);
    expect(distanceToElement(rect, elementsMap, p(100, 30))).toBeCloseTo(0);
  });

  it("rotated rectangle", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      roundness: null,
    });

    // the rotated corner reaches 50 * sqrt(2) from the center
    expect(
      distanceToElement(rect, elementsMap, p(50 + 50 * Math.SQRT2 + 10, 50)),
    ).toBeCloseTo(10);
  });

  it("diamond", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });

    expect(distanceToElement(diamond, elementsMap, p(150, 50))).toBeCloseTo(
      50,
      0,
    );
    // inner distance to the (slightly offset) diamond edge
    const inner = distanceToElement(diamond, elementsMap, p(50, 50));
    expect(inner).toBeGreaterThan(33);
    expect(inner).toBeLessThan(36);
  });

  it("ellipse", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    expect(distanceToElement(ellipse, elementsMap, p(150, 50))).toBeCloseTo(
      50,
      1,
    );
    expect(distanceToElement(ellipse, elementsMap, p(50, -10))).toBeCloseTo(
      10,
      1,
    );
  });

  it("linear elements", () => {
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      roundness: null,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    });

    expect(distanceToElement(line, elementsMap, p(50, 30))).toBeCloseTo(30);
    expect(distanceToElement(line, elementsMap, p(130, 40))).toBeCloseTo(50);
  });
});
