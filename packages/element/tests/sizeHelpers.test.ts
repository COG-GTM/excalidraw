import { vi } from "vitest";

import { SHIFT_LOCKING_ANGLE, arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { LocalPoint } from "@excalidraw/math";
import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

import {
  getLockedLinearCursorAlignSize,
  getNormalizedDimensions,
  getPerfectElementSize,
  isElementCompletelyInViewport,
  isElementInViewport,
  isInvisiblySmallElement,
} from "../src/sizeHelpers";

import type { ExcalidrawElement } from "../src/types";

const EPSILON_DIGITS = 3;
// Needed so that we can mock the value of constants which is done in
// below tests. In Jest this wasn't needed as global override was possible
// but vite doesn't allow that hence we need to mock
vi.mock(
  "@excalidraw/common",
  //@ts-ignore
  async (importOriginal) => {
    const module: any = await importOriginal();
    return { ...module };
  },
);
describe("getPerfectElementSize", () => {
  it("should return height:0 if `elementType` is line and locked angle is 0", () => {
    const { height, width } = getPerfectElementSize("line", 149, 10);
    expect(width).toBeCloseTo(149, EPSILON_DIGITS);
    expect(height).toBeCloseTo(0, EPSILON_DIGITS);
  });

  it("should return width:0 if `elementType` is line and locked angle is 90 deg (Math.PI/2)", () => {
    const { height, width } = getPerfectElementSize("line", 10, 140);
    expect(width).toBeCloseTo(0, EPSILON_DIGITS);
    expect(height).toBeCloseTo(140, EPSILON_DIGITS);
  });

  it("should return height:0 if `elementType` is arrow and locked angle is 0", () => {
    const { height, width } = getPerfectElementSize("arrow", 200, 20);
    expect(width).toBeCloseTo(200, EPSILON_DIGITS);
    expect(height).toBeCloseTo(0, EPSILON_DIGITS);
  });
  it("should return width:0 if `elementType` is arrow and locked angle is 90 deg (Math.PI/2)", () => {
    const { height, width } = getPerfectElementSize("arrow", 10, 100);
    expect(width).toBeCloseTo(0, EPSILON_DIGITS);
    expect(height).toBeCloseTo(100, EPSILON_DIGITS);
  });

  it("should return adjust height to be width * tan(locked angle)", () => {
    const { height, width } = getPerfectElementSize("arrow", 120, 185);
    expect(width).toBeCloseTo(120, EPSILON_DIGITS);
    expect(height).toBeCloseTo(207.846, EPSILON_DIGITS);
  });

  it("should return height equals to width if locked angle is 45 deg", () => {
    const { height, width } = getPerfectElementSize("arrow", 135, 145);
    expect(width).toBeCloseTo(135, EPSILON_DIGITS);
    expect(height).toBeCloseTo(135, EPSILON_DIGITS);
  });

  it("should return height:0 and width:0 when width and height are 0", () => {
    const { height, width } = getPerfectElementSize("arrow", 0, 0);
    expect(width).toBeCloseTo(0, EPSILON_DIGITS);
    expect(height).toBeCloseTo(0, EPSILON_DIGITS);
  });
});

describe("getPerfectElementSize for shapes", () => {
  it("makes non-linear shapes square, keeping the height sign", () => {
    expect(getPerfectElementSize("rectangle", 100, -40)).toEqual({
      width: 100,
      height: -100,
    });
    expect(getPerfectElementSize("ellipse", -80, 20)).toEqual({
      width: -80,
      height: 80,
    });
  });

  it("leaves selection boxes untouched", () => {
    expect(getPerfectElementSize("selection", 100, 40)).toEqual({
      width: 100,
      height: 40,
    });
  });

  it("snaps freedraw like linear elements", () => {
    const { width, height } = getPerfectElementSize("freedraw", 100, -3);
    expect(width).toBe(100);
    expect(height).toBe(0);
  });
});

describe("isInvisiblySmallElement", () => {
  it("is true only for zero-sized shapes", () => {
    expect(
      isInvisiblySmallElement(API.createElement({ width: 0, height: 0 })),
    ).toBe(true);
    expect(
      isInvisiblySmallElement(API.createElement({ width: 10, height: 0 })),
    ).toBe(false);
  });

  it("is true for linear elements with fewer than two points", () => {
    const line = API.createElement({
      type: "line",
      points: [pointFrom<LocalPoint>(0, 0)],
    });
    expect(isInvisiblySmallElement(line)).toBe(true);
  });

  it("is true for arrows whose two points coincide", () => {
    const arrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0.05, 0)],
    });
    expect(isInvisiblySmallElement(arrow)).toBe(true);
  });

  it("is false for two-point lines or arrows with distinct points", () => {
    const line = API.createElement({
      type: "line",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 0)],
    });
    expect(isInvisiblySmallElement(line)).toBe(false);

    const arrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(10, 0)],
    });
    expect(isInvisiblySmallElement(arrow)).toBe(false);
  });

  it("is true for freedraw with a single point", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      points: [pointFrom<LocalPoint>(0, 0)],
    });
    expect(isInvisiblySmallElement(freedraw)).toBe(true);
  });
});

describe("viewport checks", () => {
  const viewTransformations = {
    zoom: { value: 1 as NormalizedZoomValue },
    offsetLeft: 0,
    offsetTop: 0,
    scrollX: 0,
    scrollY: 0,
  };
  const at = (x: number, y: number) =>
    API.createElement({ type: "rectangle", x, y, width: 50, height: 50 });
  const isIn = (el: ExcalidrawElement, transforms = viewTransformations) =>
    isElementInViewport(el, 500, 500, transforms, arrayToMap([el]));
  const isFullyIn = (
    el: ExcalidrawElement,
    padding?: Parameters<typeof isElementCompletelyInViewport>[5],
  ) =>
    isElementCompletelyInViewport(
      [el],
      500,
      500,
      viewTransformations,
      arrayToMap([el]),
      padding,
    );

  it("detects elements fully inside, partially inside and outside", () => {
    expect(isIn(at(100, 100))).toBe(true);
    expect(isIn(at(480, 480))).toBe(true);
    expect(isIn(at(600, 100))).toBe(false);
    expect(isIn(at(-100, 100))).toBe(false);
  });

  it("applies scroll and zoom to the viewport", () => {
    const scrolled = { ...viewTransformations, scrollX: -600 };
    expect(isIn(at(600, 100), scrolled)).toBe(true);
    expect(isIn(at(100, 100), scrolled)).toBe(false);

    const zoomedOut = {
      ...viewTransformations,
      zoom: { value: 0.5 as NormalizedZoomValue },
    };
    expect(isIn(at(900, 100), zoomedOut)).toBe(true);
  });

  it("requires the whole element for complete visibility", () => {
    expect(isFullyIn(at(100, 100))).toBe(true);
    expect(isFullyIn(at(480, 480))).toBe(false);
  });

  it("shrinks the viewport by the given padding", () => {
    const el = at(420, 100);
    expect(isFullyIn(el)).toBe(true);
    expect(isFullyIn(el, { top: 0, right: 50, bottom: 0, left: 0 })).toBe(
      false,
    );
    expect(
      isFullyIn(at(10, 10), { top: 20, right: 0, bottom: 0, left: 0 }),
    ).toBe(false);
  });
});

describe("getLockedLinearCursorAlignSize", () => {
  const angleOf = ({ width, height }: { width: number; height: number }) =>
    Math.atan2(height, width);

  it("snaps near-horizontal and near-vertical lines to the axis", () => {
    expect(getLockedLinearCursorAlignSize(0, 0, 100, 3)).toEqual({
      width: 100,
      height: 0,
    });
    const vertical = getLockedLinearCursorAlignSize(10, 10, 13, 110);
    expect(vertical.width).toBe(0);
    expect(vertical.height).toBe(100);
  });

  it("projects the cursor onto the nearest locked angle", () => {
    const { width, height } = getLockedLinearCursorAlignSize(0, 0, 100, 90);
    expect(width).toBeCloseTo(95);
    expect(height).toBeCloseTo(95);
  });

  it("snaps to a custom angle when close to it", () => {
    const customAngle = 0.3;
    const cursorAngle = 0.28;
    const size = getLockedLinearCursorAlignSize(
      0,
      0,
      100 * Math.cos(cursorAngle),
      100 * Math.sin(cursorAngle),
      customAngle,
    );
    expect(angleOf(size)).toBeCloseTo(customAngle);
  });

  it("snaps to the upper step when above a custom angle", () => {
    const size = getLockedLinearCursorAlignSize(
      0,
      0,
      100 * Math.cos(0.35),
      100 * Math.sin(0.35),
      0.3,
    );
    expect(angleOf(size)).toBeCloseTo(2 * SHIFT_LOCKING_ANGLE);
  });

  it("snaps to the lower step when below a custom angle", () => {
    const size = getLockedLinearCursorAlignSize(
      0,
      0,
      100 * Math.cos(0.3),
      100 * Math.sin(0.3),
      0.45,
    );
    expect(angleOf(size)).toBeCloseTo(SHIFT_LOCKING_ANGLE);
  });

  it("ignores a custom angle outside the cursor's step", () => {
    const size = getLockedLinearCursorAlignSize(0, 0, 100, 100, 0.3);
    expect(angleOf(size)).toBeCloseTo(Math.PI / 4);
  });
});

describe("getNormalizedDimensions", () => {
  it("keeps positive dimensions unchanged", () => {
    expect(
      getNormalizedDimensions({ x: 10, y: 20, width: 30, height: 40 }),
    ).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it("flips negative width and height into positive ones", () => {
    expect(
      getNormalizedDimensions({ x: 10, y: 20, width: -30, height: -40 }),
    ).toEqual({ x: -20, y: -20, width: 30, height: 40 });
  });
});
