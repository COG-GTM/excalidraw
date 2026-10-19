import { arrayToMap, invariant } from "@excalidraw/common";
import { pointFrom, vector } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, Radians, Vector } from "@excalidraw/math";

import { aabbForElement } from "../src/bounds";
import {
  compareHeading,
  flipHeading,
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  headingForPoint,
  headingForPointFromElement,
  headingForPointIsHorizontal,
  headingIsHorizontal,
  headingIsVertical,
  vectorToHeading,
} from "../src/heading";

import type { Heading } from "../src/heading";
import type { ExcalidrawBindableElement } from "../src/types";

const createBindable = (
  opts: Parameters<typeof API.createElement>[0],
): ExcalidrawBindableElement => {
  const element = API.createElement(opts);
  invariant(
    element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse",
    "expected a bindable element",
  );
  return element;
};

const headingFor = (element: ExcalidrawBindableElement, point: GlobalPoint) =>
  headingForPointFromElement(
    element,
    aabbForElement(element, arrayToMap([element])),
    point,
  );

describe("vectorToHeading", () => {
  it.each<[string, Vector, Heading]>([
    ["right", vector(1, 0), HEADING_RIGHT],
    ["down", vector(0, 1), HEADING_DOWN],
    ["left", vector(-1, 0), HEADING_LEFT],
    ["up", vector(0, -1), HEADING_UP],
    ["mostly right", vector(10, -9), HEADING_RIGHT],
    ["mostly down", vector(9, 10), HEADING_DOWN],
    ["mostly left", vector(-10, 9), HEADING_LEFT],
    ["mostly up", vector(-9, -10), HEADING_UP],
  ])("%s", (_, vec, expected) => {
    expect(vectorToHeading(vec)).toEqual(expected);
  });

  // Ties between |x| and |y| are not symmetric: negative x wins as LEFT,
  // everything else falls back to UP.
  it.each<[string, Vector, Heading]>([
    ["down-right diagonal", vector(1, 1), HEADING_UP],
    ["up-right diagonal", vector(1, -1), HEADING_UP],
    ["down-left diagonal", vector(-1, 1), HEADING_LEFT],
    ["up-left diagonal", vector(-1, -1), HEADING_LEFT],
    ["zero vector", vector(0, 0), HEADING_LEFT],
  ])("tie-break: %s", (_, vec, expected) => {
    expect(vectorToHeading(vec)).toEqual(expected);
  });
});

describe("headingForPoint", () => {
  it("returns the heading of the vector from origin to point", () => {
    const o = pointFrom<GlobalPoint>(10, 10);
    expect(headingForPoint(pointFrom<GlobalPoint>(20, 10), o)).toEqual(
      HEADING_RIGHT,
    );
    expect(headingForPoint(pointFrom<GlobalPoint>(10, 20), o)).toEqual(
      HEADING_DOWN,
    );
    expect(headingForPoint(pointFrom<GlobalPoint>(0, 10), o)).toEqual(
      HEADING_LEFT,
    );
    expect(headingForPoint(pointFrom<GlobalPoint>(10, 0), o)).toEqual(
      HEADING_UP,
    );
  });

  it("headingForPointIsHorizontal", () => {
    const o = pointFrom<GlobalPoint>(0, 0);
    expect(headingForPointIsHorizontal(pointFrom<GlobalPoint>(5, 1), o)).toBe(
      true,
    );
    expect(headingForPointIsHorizontal(pointFrom<GlobalPoint>(-5, 1), o)).toBe(
      true,
    );
    expect(headingForPointIsHorizontal(pointFrom<GlobalPoint>(1, 5), o)).toBe(
      false,
    );
    expect(headingForPointIsHorizontal(pointFrom<GlobalPoint>(1, -5), o)).toBe(
      false,
    );
  });
});

describe("heading predicates", () => {
  it("compareHeading", () => {
    expect(compareHeading(HEADING_UP, [0, -1])).toBe(true);
    expect(compareHeading(HEADING_UP, HEADING_DOWN)).toBe(false);
    expect(compareHeading(HEADING_LEFT, HEADING_RIGHT)).toBe(false);
    expect(compareHeading(HEADING_RIGHT, HEADING_DOWN)).toBe(false);
  });

  it("headingIsHorizontal / headingIsVertical", () => {
    expect(headingIsHorizontal(HEADING_LEFT)).toBe(true);
    expect(headingIsHorizontal(HEADING_RIGHT)).toBe(true);
    expect(headingIsHorizontal(HEADING_UP)).toBe(false);
    expect(headingIsHorizontal(HEADING_DOWN)).toBe(false);
    expect(headingIsVertical(HEADING_UP)).toBe(true);
    expect(headingIsVertical(HEADING_DOWN)).toBe(true);
    expect(headingIsVertical(HEADING_LEFT)).toBe(false);
    expect(headingIsVertical(HEADING_RIGHT)).toBe(false);
  });
});

describe("flipHeading", () => {
  it.each<[Heading, Heading]>([
    [HEADING_UP, HEADING_DOWN],
    [HEADING_DOWN, HEADING_UP],
    [HEADING_LEFT, HEADING_RIGHT],
    [HEADING_RIGHT, HEADING_LEFT],
  ])("flips %j to %j", (heading, expected) => {
    expect(flipHeading(heading)).toEqual(expected);
  });

  it.each<[Heading]>([
    [HEADING_UP],
    [HEADING_DOWN],
    [HEADING_LEFT],
    [HEADING_RIGHT],
  ])("round-trips %j", (heading) => {
    expect(flipHeading(flipHeading(heading))).toEqual(heading);
  });
});

describe("headingForPointFromElement", () => {
  describe("rectangle", () => {
    const rectangle = createBindable({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    it.each<[string, GlobalPoint, Heading]>([
      ["top side", pointFrom(50, -10), HEADING_UP],
      ["right side", pointFrom(110, 50), HEADING_RIGHT],
      ["bottom side", pointFrom(50, 110), HEADING_DOWN],
      ["left side", pointFrom(-10, 50), HEADING_LEFT],
      ["near top-right corner, above", pointFrom(95, -5), HEADING_UP],
      ["near top-right corner, right", pointFrom(105, 5), HEADING_RIGHT],
      ["near bottom-left corner, below", pointFrom(5, 105), HEADING_DOWN],
      ["near bottom-left corner, left", pointFrom(-5, 95), HEADING_LEFT],
    ])("point at %s", (_, point, expected) => {
      expect(headingFor(rectangle, point)).toEqual(expected);
    });

    it("uses the aspect ratio of the bounds for the search cones", () => {
      const wide = createBindable({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
      });
      // Above the top edge, but closer to the right edge than a square
      // element's 45deg cone would allow.
      expect(headingFor(wide, pointFrom(190, -5))).toEqual(HEADING_UP);
      expect(headingFor(wide, pointFrom(210, 50))).toEqual(HEADING_RIGHT);
    });

    it("uses the axis-aligned bounds of a rotated element", () => {
      const rotated = createBindable({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        angle: (Math.PI / 4) as Radians,
      });
      // Rotated 45deg the corners point up/right/down/left from the center
      const halfDiagonal = 50 * Math.SQRT2;
      expect(headingFor(rotated, pointFrom(50, 50 - halfDiagonal - 5))).toEqual(
        HEADING_UP,
      );
      expect(headingFor(rotated, pointFrom(50 + halfDiagonal + 5, 50))).toEqual(
        HEADING_RIGHT,
      );
      expect(headingFor(rotated, pointFrom(50, 50 + halfDiagonal + 5))).toEqual(
        HEADING_DOWN,
      );
      expect(headingFor(rotated, pointFrom(50 - halfDiagonal - 5, 50))).toEqual(
        HEADING_LEFT,
      );
    });
  });

  describe("diamond", () => {
    const diamond = createBindable({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    it.each<[string, GlobalPoint, Heading]>([
      ["top vertex", pointFrom(50, -5), HEADING_UP],
      ["right vertex", pointFrom(105, 50), HEADING_RIGHT],
      ["bottom vertex", pointFrom(50, 105), HEADING_DOWN],
      ["left vertex", pointFrom(-5, 50), HEADING_LEFT],
    ])("point near %s", (_, point, expected) => {
      expect(headingFor(diamond, point)).toEqual(expected);
    });

    it("follows the vertices of a rotated diamond", () => {
      const rotated = createBindable({
        type: "diamond",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        angle: (Math.PI / 2) as Radians,
      });
      // Rotated 90deg clockwise: the original top vertex now points right
      expect(headingFor(rotated, pointFrom(105, 50))).toEqual(HEADING_RIGHT);
      expect(headingFor(rotated, pointFrom(50, 105))).toEqual(HEADING_DOWN);
    });

    it("prefers the vertex on the longer axis for points beside an edge", () => {
      const wide = createBindable({
        type: "diamond",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
      });
      const tall = createBindable({
        type: "diamond",
        x: 0,
        y: 0,
        width: 100,
        height: 200,
      });
      // Outside the top-right edge, away from both vertices
      expect(headingFor(wide, pointFrom(160, 10))).toEqual(HEADING_UP);
      expect(headingFor(tall, pointFrom(80, 40))).toEqual(HEADING_RIGHT);
    });

    it("throws for a diamond without width or height", () => {
      const flat = createBindable({
        type: "diamond",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
      });
      expect(() => headingFor(flat, pointFrom(50, -10))).toThrow(
        "Diamond element has no width or height",
      );
    });

    it("throws for a point at the diamond's center", () => {
      expect(() => headingFor(diamond, pointFrom(50, 50))).toThrow(
        "The point is too close to the element mid point to determine heading",
      );
    });
  });
});
