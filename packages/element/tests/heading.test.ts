import { pointFrom, vector } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";
import type { Bounds } from "@excalidraw/common";

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

const bindable = (
  type: "rectangle" | "diamond" | "ellipse",
  width: number,
  height: number,
) =>
  API.createElement({
    type,
    x: 0,
    y: 0,
    width,
    height,
  }) as ExcalidrawBindableElement;

const aabbOf = (el: ExcalidrawBindableElement): Bounds => [
  el.x,
  el.y,
  el.x + el.width,
  el.y + el.height,
];

describe("vectorToHeading", () => {
  it("maps axis-aligned vectors to the matching heading", () => {
    expect(vectorToHeading(vector(5, 0))).toEqual(HEADING_RIGHT);
    expect(vectorToHeading(vector(-5, 0))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vector(0, 5))).toEqual(HEADING_DOWN);
    expect(vectorToHeading(vector(0, -5))).toEqual(HEADING_UP);
  });

  it("picks the dominant axis for off-axis vectors", () => {
    expect(vectorToHeading(vector(10, 3))).toEqual(HEADING_RIGHT);
    expect(vectorToHeading(vector(-10, -3))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vector(3, 10))).toEqual(HEADING_DOWN);
    expect(vectorToHeading(vector(-3, -10))).toEqual(HEADING_UP);
  });

  it("resolves exact diagonals and the zero vector deterministically", () => {
    // x === |y| is not "right"; x === -|y| is "left"; y === |x| falls to "up"
    expect(vectorToHeading(vector(1, 1))).toEqual(HEADING_UP);
    expect(vectorToHeading(vector(1, -1))).toEqual(HEADING_UP);
    expect(vectorToHeading(vector(-1, 1))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vector(-1, -1))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vector(0, 0))).toEqual(HEADING_LEFT);
  });
});

describe("headingForPoint", () => {
  it("returns the heading of the vector from origin to point", () => {
    const o = pointFrom<LocalPoint>(10, 10);
    expect(headingForPoint(pointFrom<LocalPoint>(20, 12), o)).toEqual(
      HEADING_RIGHT,
    );
    expect(headingForPoint(pointFrom<LocalPoint>(0, 8), o)).toEqual(
      HEADING_LEFT,
    );
    expect(headingForPoint(pointFrom<LocalPoint>(12, 30), o)).toEqual(
      HEADING_DOWN,
    );
    expect(headingForPoint(pointFrom<LocalPoint>(8, -30), o)).toEqual(
      HEADING_UP,
    );
  });

  it("reports whether the heading is horizontal", () => {
    const o = pointFrom<GlobalPoint>(0, 0);
    expect(headingForPointIsHorizontal(pointFrom<GlobalPoint>(-9, 1), o)).toBe(
      true,
    );
    expect(headingForPointIsHorizontal(pointFrom<GlobalPoint>(1, 9), o)).toBe(
      false,
    );
  });
});

describe("heading comparisons", () => {
  it("compareHeading checks both components", () => {
    expect(compareHeading(HEADING_UP, [0, -1])).toBe(true);
    expect(compareHeading(HEADING_UP, HEADING_DOWN)).toBe(false);
    expect(compareHeading(HEADING_LEFT, HEADING_RIGHT)).toBe(false);
  });

  it("classifies headings as horizontal or vertical", () => {
    expect(headingIsHorizontal(HEADING_LEFT)).toBe(true);
    expect(headingIsHorizontal(HEADING_RIGHT)).toBe(true);
    expect(headingIsHorizontal(HEADING_UP)).toBe(false);
    expect(headingIsVertical(HEADING_UP)).toBe(true);
    expect(headingIsVertical(HEADING_DOWN)).toBe(true);
    expect(headingIsVertical(HEADING_RIGHT)).toBe(false);
  });

  it("flipHeading returns the opposite heading", () => {
    expect(flipHeading(HEADING_UP)).toEqual(HEADING_DOWN);
    expect(flipHeading(HEADING_DOWN)).toEqual(HEADING_UP);
    expect(flipHeading(HEADING_LEFT)).toEqual(HEADING_RIGHT);
    expect(flipHeading(HEADING_RIGHT)).toEqual(HEADING_LEFT);
  });
});

describe("headingForPointFromElement", () => {
  describe("rectangle (search cones)", () => {
    const rect = bindable("rectangle", 100, 100);
    const aabb = aabbOf(rect);

    it.each([
      [pointFrom<GlobalPoint>(50, -10), HEADING_UP],
      [pointFrom<GlobalPoint>(110, 50), HEADING_RIGHT],
      [pointFrom<GlobalPoint>(50, 110), HEADING_DOWN],
      [pointFrom<GlobalPoint>(-10, 50), HEADING_LEFT],
      [pointFrom<GlobalPoint>(60, 20), HEADING_UP],
      [pointFrom<GlobalPoint>(80, 45), HEADING_RIGHT],
    ])("point %j -> %j", (point, expected) => {
      expect(headingForPointFromElement(rect, aabb, point)).toEqual(expected);
    });

    it("uses the aabb center, not the element position", () => {
      const shiftedAabb: Bounds = [200, 200, 300, 300];
      // the point is right of the element itself but up-left of the aabb center
      expect(
        headingForPointFromElement(
          rect,
          shiftedAabb,
          pointFrom<GlobalPoint>(240, 150),
        ),
      ).toEqual(HEADING_UP);
    });
  });

  describe("diamond", () => {
    const diamond = bindable("diamond", 100, 100);
    const aabb = aabbOf(diamond);

    it.each([
      [pointFrom<GlobalPoint>(50, -20), HEADING_UP],
      [pointFrom<GlobalPoint>(120, 50), HEADING_RIGHT],
      [pointFrom<GlobalPoint>(50, 120), HEADING_DOWN],
      [pointFrom<GlobalPoint>(-20, 50), HEADING_LEFT],
    ])("corner region point %j -> %j", (point, expected) => {
      expect(headingForPointFromElement(diamond, aabb, point)).toEqual(
        expected,
      );
    });

    it.each([
      // square diamonds resolve the sides to the horizontal vertex
      [pointFrom<GlobalPoint>(90, 10), HEADING_RIGHT],
      [pointFrom<GlobalPoint>(90, 90), HEADING_RIGHT],
      [pointFrom<GlobalPoint>(10, 90), HEADING_LEFT],
      [pointFrom<GlobalPoint>(10, 10), HEADING_LEFT],
    ])("side region of a square diamond %j -> %j", (point, expected) => {
      expect(headingForPointFromElement(diamond, aabb, point)).toEqual(
        expected,
      );
    });

    it.each([
      // wide diamonds resolve the sides to the vertical vertex
      [pointFrom<GlobalPoint>(180, 10), HEADING_UP],
      [pointFrom<GlobalPoint>(180, 90), HEADING_DOWN],
      [pointFrom<GlobalPoint>(20, 90), HEADING_DOWN],
      [pointFrom<GlobalPoint>(20, 10), HEADING_UP],
    ])("side region of a wide diamond %j -> %j", (point, expected) => {
      const wide = bindable("diamond", 200, 100);
      expect(headingForPointFromElement(wide, aabbOf(wide), point)).toEqual(
        expected,
      );
    });

    it("throws in test env for a degenerate diamond", () => {
      const flat = bindable("diamond", 100, 0);
      expect(() =>
        headingForPointFromElement(
          flat,
          aabbOf(flat),
          pointFrom<GlobalPoint>(50, -10),
        ),
      ).toThrow("Diamond element has no width or height");
    });

    it("throws in test env when the point is the diamond center", () => {
      expect(() =>
        headingForPointFromElement(
          diamond,
          aabb,
          pointFrom<GlobalPoint>(50, 50),
        ),
      ).toThrow("too close to the element mid point");
    });
  });
});
