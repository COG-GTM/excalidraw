import { arrayToMap, reseed, ROUNDNESS } from "@excalidraw/common";
import {
  type GlobalPoint,
  type LocalPoint,
  lineSegment,
  pointFrom,
} from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import "@excalidraw/utils/test-utils";
import { render } from "@excalidraw/excalidraw/tests/test-utils";

import * as distance from "../src/distance";
import {
  getHoveredElementForBinding,
  hitElementBoundingBox,
  hitElementBoundingBoxOnly,
  hitElementBoundText,
  hitElementItself,
  intersectElementWithLineSegment,
  isPointInElement,
} from "../src/collision";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Ordered,
} from "../src/types";

const toSceneElementsMap = (elements: readonly ExcalidrawElement[]) =>
  arrayToMap(elements) as NonDeletedSceneElementsMap;

const sortPoints = (points: GlobalPoint[]) =>
  [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const expectPointsCloseTo = (
  actual: GlobalPoint[],
  expected: [number, number][],
) => {
  expect(actual).toHaveLength(expected.length);
  sortPoints(actual).forEach((point, i) => {
    expect(point[0]).toBeCloseTo(expected[i][0]);
    expect(point[1]).toBeCloseTo(expected[i][1]);
  });
};

describe("check rotated elements can be hit:", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("arrow", () => {
    UI.createElement("arrow", {
      x: 0,
      y: 0,
      width: 124,
      height: 302,
      angle: 1.8700426423973724,
      points: [
        [0, 0],
        [120, -198],
        [-4, -302],
      ] as LocalPoint[],
    });
    const hit = hitElementItself({
      point: pointFrom<GlobalPoint>(88, -68),
      element: window.h.elements[0],
      threshold: 10,
      elementsMap: window.h.scene.getNonDeletedElementsMap(),
    });
    expect(hit).toBe(true);
  });
});

describe("hitElementItself cache", () => {
  beforeEach(async () => {
    // reset cache
    hitElementItself({
      point: pointFrom<GlobalPoint>(50, 50),
      element: API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        backgroundColor: "#ffffff",
      }),
      threshold: Infinity,
      elementsMap: new Map([]),
    });

    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("reuses cached result when threshold increases", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(100.5, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 1,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    distanceSpy.mockRestore();
  });

  it("does not reuse cache when threshold decreases", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(105, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    expect(
      hitElementItself({
        point,
        element,
        threshold: 6,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(2);
    distanceSpy.mockRestore();
  });

  it("invalidates cache when element version changes", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(100.5, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 1,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    const movedElement = {
      ...element,
      version: element.version + 1,
      versionNonce: element.versionNonce + 1,
    };

    expect(
      hitElementItself({
        point,
        element: movedElement,
        threshold: 1,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(2);
    distanceSpy.mockRestore();
  });

  it("override does not affect caching", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(50, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
      }),
    ).toBe(false);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
        overrideShouldTestInside: true,
      }),
    ).toBe(true);
  });
});

describe("hitElementItself per shape", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  // elements get unique ids, as hitElementItself caches by id + version
  const hit = (element: ExcalidrawElement, x: number, y: number) =>
    hitElementItself({
      point: pointFrom<GlobalPoint>(x, y),
      element,
      threshold: 1,
      elementsMap: arrayToMap([element]),
    });

  it("diamond: hits the border, misses bounding box corners", () => {
    const diamond = API.createElement({
      type: "diamond",
      id: "diamond-transparent",
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });

    // midpoints of the top-left and bottom-right edges
    expect(hit(diamond, 25, 25)).toBe(true);
    expect(hit(diamond, 75, 75)).toBe(true);
    // vertices
    expect(hit(diamond, 50, 0)).toBe(true);
    expect(hit(diamond, 100, 50)).toBe(true);
    // just outside the top-left edge
    expect(hit(diamond, 22, 22)).toBe(false);
    // corners of the bounding box are far from the diamond outline
    expect(hit(diamond, 0, 0)).toBe(false);
    expect(hit(diamond, 100, 100)).toBe(false);
    // transparent diamond cannot be hit from inside
    expect(hit(diamond, 50, 50)).toBe(false);
  });

  it("diamond: filled diamond is hit inside but not outside the outline", () => {
    const diamond = API.createElement({
      type: "diamond",
      id: "diamond-filled",
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "#ff0000",
    });

    expect(hit(diamond, 50, 50)).toBe(true);
    expect(hit(diamond, 40, 30)).toBe(true);
    // inside the bounding box but outside the diamond
    expect(hit(diamond, 5, 5)).toBe(false);
    expect(hit(diamond, 95, 95)).toBe(false);
  });

  it("ellipse: hits the border, misses bounding box corners", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse-transparent",
      width: 100,
      height: 50,
      backgroundColor: "transparent",
    });

    expect(hit(ellipse, 50, 0)).toBe(true);
    expect(hit(ellipse, 0, 25)).toBe(true);
    expect(hit(ellipse, 100, 25)).toBe(true);
    expect(hit(ellipse, 50, 50)).toBe(true);
    // just outside the top of the ellipse
    expect(hit(ellipse, 50, -3)).toBe(false);
    // corners of the bounding box are outside the ellipse outline
    expect(hit(ellipse, 2, 2)).toBe(false);
    expect(hit(ellipse, 98, 48)).toBe(false);
    // transparent ellipse cannot be hit from inside
    expect(hit(ellipse, 50, 15)).toBe(false);
  });

  it("ellipse: filled ellipse is hit inside but not in bounding box corners", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse-filled",
      width: 100,
      height: 50,
      backgroundColor: "#ff0000",
    });

    expect(hit(ellipse, 50, 25)).toBe(true);
    expect(hit(ellipse, 2, 2)).toBe(false);
  });

  it("rounded rectangle: corners are cut off, sharp rectangle corners are not", () => {
    const rounded = API.createElement({
      type: "rectangle",
      id: "rectangle-rounded",
      width: 100,
      height: 100,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
      backgroundColor: "transparent",
    });
    const sharp = API.createElement({
      type: "rectangle",
      id: "rectangle-sharp",
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });

    // straight part of the edges
    expect(hit(rounded, 0, 50)).toBe(true);
    expect(hit(rounded, 50, 100)).toBe(true);
    // just outside the left edge
    expect(hit(rounded, -3, 50)).toBe(false);
    // the rounded corner does not reach the bounding box corner
    expect(hit(rounded, 0, 0)).toBe(false);
    expect(hit(rounded, 100, 100)).toBe(false);

    expect(hit(sharp, 0, 0)).toBe(true);
    expect(hit(sharp, 100, 100)).toBe(true);
  });

  it("freedraw: hits the stroke, misses points away from it", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      id: "freedraw",
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 50),
        pointFrom<LocalPoint>(100, 100),
      ],
    });

    expect(hit(freedraw, 0, 0)).toBe(true);
    expect(hit(freedraw, 50, 50)).toBe(true);
    expect(hit(freedraw, 100, 100)).toBe(true);
    // inside the bounding box, but away from the stroke
    expect(hit(freedraw, 80, 20)).toBe(false);
    expect(hit(freedraw, 20, 80)).toBe(false);
  });
});

describe("hitElementBoundingBox", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("tests against the element's axis-aligned bounds", () => {
    const element = API.createElement({
      type: "ellipse",
      width: 100,
      height: 50,
    });
    const elementsMap = arrayToMap([element]);

    // corner of the bounds, outside of the ellipse itself
    expect(hitElementBoundingBox(pointFrom(2, 2), element, elementsMap)).toBe(
      true,
    );
    expect(
      hitElementBoundingBox(pointFrom(150, 25), element, elementsMap),
    ).toBe(false);
  });

  it("respects tolerance", () => {
    const element = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(105, 50);

    expect(hitElementBoundingBox(point, element, elementsMap)).toBe(false);
    expect(hitElementBoundingBox(point, element, elementsMap, 10)).toBe(true);
  });

  it("respects element rotation", () => {
    // 100x20 rectangle rotated by 90deg around its center (50, 10)
    // covers x: 40..60, y: -40..60
    const element = API.createElement({
      type: "rectangle",
      width: 100,
      height: 20,
      angle: Math.PI / 2,
    });
    const elementsMap = arrayToMap([element]);

    expect(hitElementBoundingBox(pointFrom(50, 50), element, elementsMap)).toBe(
      true,
    );
    expect(
      hitElementBoundingBox(pointFrom(50, -30), element, elementsMap),
    ).toBe(true);
    // inside the unrotated bounds, but outside the rotated ones
    expect(hitElementBoundingBox(pointFrom(90, 10), element, elementsMap)).toBe(
      false,
    );
  });
});

describe("hitElementBoundText", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("returns false for elements without bound text", () => {
    const element = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });

    expect(
      hitElementBoundText(pointFrom(50, 50), element, arrayToMap([element])),
    ).toBe(false);
  });

  it("hits the bound text of a container", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      width: 200,
      height: 100,
      boundElements: [{ type: "text", id: "label" }],
    });
    const text = API.createElement({
      type: "text",
      id: "label",
      x: 75,
      y: 40,
      width: 50,
      height: 20,
      containerId: container.id,
    });
    const elementsMap = arrayToMap([container, text]);

    expect(
      hitElementBoundText(pointFrom(100, 50), container, elementsMap),
    ).toBe(true);
    // inside the container but outside its text
    expect(hitElementBoundText(pointFrom(10, 10), container, elementsMap)).toBe(
      false,
    );
  });

  it("uses the computed label position for arrows", () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      width: 100,
      height: 100,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
      boundElements: [{ type: "text", id: "arrow-label" }],
    });
    // the stored position is stale: the label is rendered at the arrow's
    // midpoint, i.e. x: 25..75, y: 40..60
    const text = API.createElement({
      type: "text",
      id: "arrow-label",
      x: 0,
      y: 0,
      width: 50,
      height: 20,
      containerId: arrow.id,
    });
    const elementsMap = arrayToMap([arrow, text]);

    expect(hitElementBoundText(pointFrom(50, 50), arrow, elementsMap)).toBe(
      true,
    );
    expect(hitElementBoundText(pointFrom(10, 10), arrow, elementsMap)).toBe(
      false,
    );
  });
});

describe("hitElementBoundingBoxOnly", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("is true only inside the bounding box when the element itself is missed", () => {
    const element = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    const elementsMap = arrayToMap([element]);
    const args = (x: number, y: number) => ({
      point: pointFrom<GlobalPoint>(x, y),
      element,
      threshold: 1,
      elementsMap,
    });

    // inside the (transparent) rectangle
    expect(hitElementBoundingBoxOnly(args(50, 50), elementsMap)).toBe(true);
    // on the outline -> element itself is hit
    expect(hitElementBoundingBoxOnly(args(0, 50), elementsMap)).toBe(false);
    // outside the bounding box
    expect(hitElementBoundingBoxOnly(args(150, 150), elementsMap)).toBe(false);
  });

  it("treats bound text as part of the element", () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      width: 100,
      height: 100,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
      boundElements: [{ type: "text", id: "arrow-label" }],
    });
    const text = API.createElement({
      type: "text",
      id: "arrow-label",
      width: 50,
      height: 20,
      containerId: arrow.id,
    });
    const unlabeledArrow = API.createElement({
      type: "arrow",
      width: 100,
      height: 100,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
    });
    const elementsMap = arrayToMap([arrow, text, unlabeledArrow]);
    // ~10px away from the arrow's stroke, but inside its label
    const point = pointFrom<GlobalPoint>(60, 45);

    expect(
      hitElementBoundingBoxOnly(
        { point, element: arrow, threshold: 1, elementsMap },
        elementsMap,
      ),
    ).toBe(false);
    expect(
      hitElementBoundingBoxOnly(
        { point, element: unlabeledArrow, threshold: 1, elementsMap },
        elementsMap,
      ),
    ).toBe(true);
  });
});

describe("getHoveredElementForBinding", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const getHovered = (
    elements: ExcalidrawElement[],
    x: number,
    y: number,
    tolerance?: number,
  ) =>
    getHoveredElementForBinding(
      pointFrom<GlobalPoint>(x, y),
      elements as Ordered<NonDeletedExcalidrawElement>[],
      toSceneElementsMap(elements),
      tolerance,
    );

  it("returns the bindable element under the point", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      backgroundColor: "#ff0000",
    });

    expect(getHovered([rectangle], 50, 50)?.id).toBe(rectangle.id);
    expect(getHovered([rectangle], 500, 500)).toBe(null);
  });

  it("respects tolerance around the element's border", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      roundness: null,
    });

    expect(getHovered([rectangle], 103, 50)).toBe(null);
    expect(getHovered([rectangle], 103, 50, 5)?.id).toBe(rectangle.id);
  });

  it("matches diamond and ellipse shapes, not just their bounds", () => {
    const diamond = API.createElement({
      type: "diamond",
      width: 100,
      height: 100,
      roundness: null,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });

    expect(getHovered([diamond, ellipse], 50, 50)?.id).toBe(diamond.id);
    expect(getHovered([diamond, ellipse], 250, 50)?.id).toBe(ellipse.id);
    // bounding box corners of the shapes
    expect(getHovered([diamond, ellipse], 5, 5)).toBe(null);
    expect(getHovered([diamond, ellipse], 205, 5)).toBe(null);
  });

  it("prefers the smaller of overlapping transparent shapes", () => {
    const large = API.createElement({
      type: "rectangle",
      width: 200,
      height: 200,
      backgroundColor: "transparent",
    });
    const small = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      backgroundColor: "transparent",
    });

    expect(getHovered([large, small], 75, 75)?.id).toBe(small.id);
    expect(getHovered([small, large], 75, 75)?.id).toBe(small.id);
  });

  it("stops at the topmost filled shape", () => {
    const small = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      backgroundColor: "transparent",
    });
    const largeFilledOnTop = API.createElement({
      type: "rectangle",
      width: 200,
      height: 200,
      backgroundColor: "#ff0000",
    });

    expect(getHovered([small, largeFilledOnTop], 75, 75)?.id).toBe(
      largeFilledOnTop.id,
    );
  });

  it("ignores non-bindable and locked elements", () => {
    const line = API.createElement({
      type: "line",
      width: 100,
      height: 100,
    });
    const locked = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      backgroundColor: "#ff0000",
      locked: true,
    });

    expect(getHovered([line], 50, 50)).toBe(null);
    expect(getHovered([locked], 50, 50)).toBe(null);
  });
});

describe("intersectElementWithLineSegment", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const horizontal = (y: number) =>
    lineSegment(pointFrom<GlobalPoint>(-50, y), pointFrom<GlobalPoint>(150, y));

  it("returns no intersections for a segment outside the element", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      roundness: null,
    });

    expect(
      intersectElementWithLineSegment(
        rectangle,
        arrayToMap([rectangle]),
        horizontal(500),
      ),
    ).toEqual([]);
  });

  it("intersects rectangle sides, honoring offset and onlyFirst", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      roundness: null,
    });
    const elementsMap = arrayToMap([rectangle]);

    expectPointsCloseTo(
      intersectElementWithLineSegment(rectangle, elementsMap, horizontal(50)),
      [
        [0, 50],
        [100, 50],
      ],
    );
    expectPointsCloseTo(
      intersectElementWithLineSegment(
        rectangle,
        elementsMap,
        horizontal(50),
        10,
      ),
      [
        [-10, 50],
        [110, 50],
      ],
    );
    expect(
      intersectElementWithLineSegment(
        rectangle,
        elementsMap,
        horizontal(50),
        0,
        true,
      ),
    ).toHaveLength(1);
  });

  it("intersects rotated rectangles", () => {
    // 100x20 rectangle rotated by 90deg covers x: 40..60, y: -40..60
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 20,
      angle: Math.PI / 2,
      roundness: null,
    });

    expectPointsCloseTo(
      intersectElementWithLineSegment(
        rectangle,
        arrayToMap([rectangle]),
        horizontal(10),
      ),
      [
        [40, 10],
        [60, 10],
      ],
    );
  });

  it("intersects diamond sides", () => {
    const diamond = API.createElement({
      type: "diamond",
      width: 100,
      height: 100,
      roundness: null,
    });
    const elementsMap = arrayToMap([diamond]);

    // diamond vertices are (51, 0), (100, 51), (51, 100), (0, 51)
    expectPointsCloseTo(
      intersectElementWithLineSegment(diamond, elementsMap, horizontal(25)),
      [
        [26, 25],
        [51 + (49 * 25) / 51, 25],
      ],
    );
    // passes through the diamond's bounds, but not the diamond itself
    expect(
      intersectElementWithLineSegment(
        diamond,
        elementsMap,
        lineSegment(
          pointFrom<GlobalPoint>(0, 20),
          pointFrom<GlobalPoint>(20, 0),
        ),
      ),
    ).toEqual([]);
  });

  it("intersects ellipses", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      width: 100,
      height: 50,
    });

    expectPointsCloseTo(
      intersectElementWithLineSegment(
        ellipse,
        arrayToMap([ellipse]),
        horizontal(25),
      ),
      [
        [0, 25],
        [100, 25],
      ],
    );
  });

  it("intersects linear elements", () => {
    const line = API.createElement({
      type: "line",
      width: 100,
      height: 100,
      roundness: null,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
    });

    expectPointsCloseTo(
      intersectElementWithLineSegment(line, arrayToMap([line]), horizontal(50)),
      [[50, 50]],
    );
  });
});

describe("isPointInElement", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const isIn = (element: ExcalidrawElement, x: number, y: number) =>
    isPointInElement(
      pointFrom<GlobalPoint>(x, y),
      element,
      arrayToMap([element]),
    );

  it("rectangle", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      roundness: null,
    });

    expect(isIn(rectangle, 50, 50)).toBe(true);
    expect(isIn(rectangle, 5, 95)).toBe(true);
    expect(isIn(rectangle, 150, 50)).toBe(false);
  });

  it("diamond", () => {
    const diamond = API.createElement({
      type: "diamond",
      width: 100,
      height: 100,
      roundness: null,
    });

    expect(isIn(diamond, 50, 50)).toBe(true);
    expect(isIn(diamond, 40, 30)).toBe(true);
    expect(isIn(diamond, 5, 5)).toBe(false);
    expect(isIn(diamond, 95, 95)).toBe(false);
  });

  it("ellipse", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      width: 100,
      height: 50,
    });

    expect(isIn(ellipse, 50, 25)).toBe(true);
    expect(isIn(ellipse, 10, 25)).toBe(true);
    expect(isIn(ellipse, 2, 2)).toBe(false);
    expect(isIn(ellipse, 98, 48)).toBe(false);
  });

  it("open linear paths have no inside", () => {
    const line = API.createElement({
      type: "line",
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
      ],
    });

    expect(isIn(line, 75, 25)).toBe(false);
  });

  it("closed linear paths have an inside", () => {
    const polygon = API.createElement({
      type: "line",
      width: 100,
      height: 100,
      roundness: null,
      polygon: true,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
    });

    expect(isIn(polygon, 50, 50)).toBe(true);
    expect(isIn(polygon, 150, 50)).toBe(false);
  });
});
