import { pointFrom } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { Bounds } from "@excalidraw/common";
import type { GlobalPoint, LocalPoint, Vector } from "@excalidraw/math";

import {
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  compareHeading,
  flipHeading,
  headingForPoint,
  headingForPointFromElement,
  headingForPointIsHorizontal,
  headingIsHorizontal,
  headingIsVertical,
  vectorToHeading,
} from "../src/heading";

import type { ExcalidrawBindableElement } from "../src/types";

const vec = (x: number, y: number) => [x, y] as Vector;
const gp = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

const elementBounds = (el: ExcalidrawBindableElement): Bounds => [
  el.x,
  el.y,
  el.x + el.width,
  el.y + el.height,
];

describe("vectorToHeading", () => {
  it("maps axis-aligned vectors to their heading", () => {
    expect(vectorToHeading(vec(5, 0))).toEqual(HEADING_RIGHT);
    expect(vectorToHeading(vec(-5, 0))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vec(0, 5))).toEqual(HEADING_DOWN);
    expect(vectorToHeading(vec(0, -5))).toEqual(HEADING_UP);
  });

  it("picks the dominant axis for skewed vectors", () => {
    expect(vectorToHeading(vec(10, 3))).toEqual(HEADING_RIGHT);
    expect(vectorToHeading(vec(10, -3))).toEqual(HEADING_RIGHT);
    expect(vectorToHeading(vec(-10, 3))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vec(3, 10))).toEqual(HEADING_DOWN);
    expect(vectorToHeading(vec(-3, -10))).toEqual(HEADING_UP);
  });

  it("resolves exact diagonals and the zero vector deterministically", () => {
    expect(vectorToHeading(vec(1, 1))).toEqual(HEADING_UP);
    expect(vectorToHeading(vec(1, -1))).toEqual(HEADING_UP);
    expect(vectorToHeading(vec(-1, 1))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vec(-1, -1))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vec(0, 0))).toEqual(HEADING_LEFT);
  });
});

describe("heading helpers", () => {
  it("headingForPoint uses the vector from origin to point", () => {
    const origin = pointFrom<LocalPoint>(10, 10);
    expect(headingForPoint(pointFrom<LocalPoint>(20, 10), origin)).toEqual(
      HEADING_RIGHT,
    );
    expect(headingForPoint(pointFrom<LocalPoint>(10, 0), origin)).toEqual(
      HEADING_UP,
    );
  });

  it("headingForPointIsHorizontal reports horizontal headings only", () => {
    const origin = gp(0, 0);
    expect(headingForPointIsHorizontal(gp(-10, 1), origin)).toBe(true);
    expect(headingForPointIsHorizontal(gp(1, 10), origin)).toBe(false);
  });

  it("compareHeading compares both components", () => {
    expect(compareHeading(HEADING_UP, [0, -1])).toBe(true);
    expect(compareHeading(HEADING_UP, HEADING_DOWN)).toBe(false);
    expect(compareHeading(HEADING_LEFT, HEADING_RIGHT)).toBe(false);
  });

  it("headingIsHorizontal and headingIsVertical are complementary", () => {
    for (const heading of [HEADING_LEFT, HEADING_RIGHT]) {
      expect(headingIsHorizontal(heading)).toBe(true);
      expect(headingIsVertical(heading)).toBe(false);
    }
    for (const heading of [HEADING_UP, HEADING_DOWN]) {
      expect(headingIsHorizontal(heading)).toBe(false);
      expect(headingIsVertical(heading)).toBe(true);
    }
  });

  it("flipHeading returns the opposite heading", () => {
    expect(flipHeading(HEADING_UP)).toEqual(HEADING_DOWN);
    expect(flipHeading(HEADING_DOWN)).toEqual(HEADING_UP);
    expect(flipHeading(HEADING_LEFT)).toEqual(HEADING_RIGHT);
    expect(flipHeading(HEADING_RIGHT)).toEqual(HEADING_LEFT);
  });
});

describe("headingForPointFromElement", () => {
  describe("rectangle", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;
    const aabb = elementBounds(rect);

    it("returns the heading of the side the point faces", () => {
      expect(headingForPointFromElement(rect, aabb, gp(50, -10))).toEqual(
        HEADING_UP,
      );
      expect(headingForPointFromElement(rect, aabb, gp(110, 50))).toEqual(
        HEADING_RIGHT,
      );
      expect(headingForPointFromElement(rect, aabb, gp(50, 110))).toEqual(
        HEADING_DOWN,
      );
      expect(headingForPointFromElement(rect, aabb, gp(-10, 50))).toEqual(
        HEADING_LEFT,
      );
    });

    it("uses the search cones for points near the corners", () => {
      expect(headingForPointFromElement(rect, aabb, gp(90, -20))).toEqual(
        HEADING_UP,
      );
      expect(headingForPointFromElement(rect, aabb, gp(120, 10))).toEqual(
        HEADING_RIGHT,
      );
      expect(headingForPointFromElement(rect, aabb, gp(10, 120))).toEqual(
        HEADING_DOWN,
      );
    });

    it("falls back to LEFT for points outside every search cone", () => {
      expect(headingForPointFromElement(rect, aabb, gp(1000, 1000))).toEqual(
        HEADING_LEFT,
      );
    });
  });

  describe("diamond", () => {
    const createDiamond = (width: number, height: number, angle = 0) =>
      API.createElement({
        type: "diamond",
        x: 0,
        y: 0,
        width,
        height,
        angle,
      }) as ExcalidrawBindableElement;

    it("returns the corner heading for points beyond each tip", () => {
      const diamond = createDiamond(100, 100);
      const aabb = elementBounds(diamond);
      expect(headingForPointFromElement(diamond, aabb, gp(50, -20))).toEqual(
        HEADING_UP,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(120, 50))).toEqual(
        HEADING_RIGHT,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(50, 120))).toEqual(
        HEADING_DOWN,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(-20, 50))).toEqual(
        HEADING_LEFT,
      );
    });

    it("prefers the horizontal tips on the sides of a square/tall diamond", () => {
      const diamond = createDiamond(100, 100);
      const aabb = elementBounds(diamond);
      expect(headingForPointFromElement(diamond, aabb, gp(80, 20))).toEqual(
        HEADING_RIGHT,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(80, 80))).toEqual(
        HEADING_RIGHT,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(20, 80))).toEqual(
        HEADING_LEFT,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(20, 20))).toEqual(
        HEADING_LEFT,
      );
    });

    it("prefers the vertical tips on the sides of a wide diamond", () => {
      const diamond = createDiamond(200, 100);
      const aabb = elementBounds(diamond);
      expect(headingForPointFromElement(diamond, aabb, gp(160, 20))).toEqual(
        HEADING_UP,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(160, 80))).toEqual(
        HEADING_DOWN,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(40, 80))).toEqual(
        HEADING_DOWN,
      );
      expect(headingForPointFromElement(diamond, aabb, gp(40, 20))).toEqual(
        HEADING_UP,
      );
    });

    it("throws for degenerate diamonds or points at the center", () => {
      const flat = createDiamond(100, 0);
      expect(() =>
        headingForPointFromElement(flat, elementBounds(flat), gp(50, -20)),
      ).toThrow("Diamond element has no width or height");

      const diamond = createDiamond(100, 100);
      expect(() =>
        headingForPointFromElement(diamond, elementBounds(diamond), gp(50, 50)),
      ).toThrow(/too close to the element mid point/);
    });
  });
});
