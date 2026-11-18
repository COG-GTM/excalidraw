import { pointFrom, vector } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint } from "@excalidraw/math";

import { getElementBounds } from "../src/bounds";
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

describe("heading helpers", () => {
  it("vectorToHeading snaps to the dominant axis", () => {
    expect(vectorToHeading(vector(10, 1))).toEqual(HEADING_RIGHT);
    expect(vectorToHeading(vector(-10, 1))).toEqual(HEADING_LEFT);
    expect(vectorToHeading(vector(1, 10))).toEqual(HEADING_DOWN);
    expect(vectorToHeading(vector(1, -10))).toEqual(HEADING_UP);
  });

  it("headingForPoint and headingForPointIsHorizontal", () => {
    const origin = pointFrom<GlobalPoint>(0, 0);
    expect(headingForPoint(pointFrom<GlobalPoint>(5, 0), origin)).toEqual(
      HEADING_RIGHT,
    );
    expect(headingForPoint(pointFrom<GlobalPoint>(0, 5), origin)).toEqual(
      HEADING_DOWN,
    );
    expect(
      headingForPointIsHorizontal(pointFrom<GlobalPoint>(-5, 1), origin),
    ).toBe(true);
    expect(
      headingForPointIsHorizontal(pointFrom<GlobalPoint>(1, -5), origin),
    ).toBe(false);
  });

  it("compares, classifies and flips headings", () => {
    expect(compareHeading(HEADING_UP, HEADING_UP)).toBe(true);
    expect(compareHeading(HEADING_UP, HEADING_DOWN)).toBe(false);

    expect(headingIsHorizontal(HEADING_LEFT)).toBe(true);
    expect(headingIsHorizontal(HEADING_UP)).toBe(false);
    expect(headingIsVertical(HEADING_DOWN)).toBe(true);
    expect(headingIsVertical(HEADING_RIGHT)).toBe(false);

    expect(flipHeading(HEADING_UP)).toEqual(HEADING_DOWN);
    expect(flipHeading(HEADING_DOWN)).toEqual(HEADING_UP);
    expect(flipHeading(HEADING_LEFT)).toEqual(HEADING_RIGHT);
    expect(flipHeading(HEADING_RIGHT)).toEqual(HEADING_LEFT);
  });
});

describe("headingForPointFromElement", () => {
  const headingFor = (
    element: ExcalidrawBindableElement,
    x: number,
    y: number,
  ) =>
    headingForPointFromElement(
      element,
      getElementBounds(element, new Map()),
      pointFrom<GlobalPoint>(x, y),
    );

  it("uses search cones around rectangles", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;

    expect(headingFor(rect, 50, -20)).toEqual(HEADING_UP);
    expect(headingFor(rect, 120, 50)).toEqual(HEADING_RIGHT);
    expect(headingFor(rect, 50, 120)).toEqual(HEADING_DOWN);
    expect(headingFor(rect, -20, 50)).toEqual(HEADING_LEFT);
  });

  it("resolves diamond corners", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;

    expect(headingFor(diamond, 50, -20)).toEqual(HEADING_UP);
    expect(headingFor(diamond, 120, 50)).toEqual(HEADING_RIGHT);
    expect(headingFor(diamond, 50, 120)).toEqual(HEADING_DOWN);
    expect(headingFor(diamond, -20, 50)).toEqual(HEADING_LEFT);
  });

  it("resolves diamond sides depending on the element aspect ratio", () => {
    const wide = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    }) as ExcalidrawBindableElement;
    const tall = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 200,
    }) as ExcalidrawBindableElement;

    // points just outside the middle of each side
    expect(headingFor(wide, 160, 10)).toEqual(HEADING_UP);
    expect(headingFor(wide, 160, 90)).toEqual(HEADING_DOWN);
    expect(headingFor(wide, 40, 90)).toEqual(HEADING_DOWN);
    expect(headingFor(wide, 40, 10)).toEqual(HEADING_UP);

    expect(headingFor(tall, 90, 40)).toEqual(HEADING_RIGHT);
    expect(headingFor(tall, 90, 160)).toEqual(HEADING_RIGHT);
    expect(headingFor(tall, 10, 160)).toEqual(HEADING_LEFT);
    expect(headingFor(tall, 10, 40)).toEqual(HEADING_LEFT);
  });

  it("throws for degenerate diamonds in test env", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }) as ExcalidrawBindableElement;

    expect(() => headingFor(diamond, 50, 50)).toThrow();
  });
});
