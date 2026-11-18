import { ROUNDNESS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { LocalPoint } from "@excalidraw/math";

import {
  canApplyRoundnessTypeToElement,
  canBecomePolygon,
  getDefaultRoundnessTypeForElement,
  getLinearElementSubType,
  isArrowBoundToElement,
  isCurvedArrow,
  isEligibleFrameChildType,
  isSharpArrow,
  isUsingProportionalRadius,
  isValidPolygon,
} from "../src/typeChecks";

import type { ExcalidrawArrowElement } from "../src/types";

const lp = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

describe("typeChecks helpers", () => {
  const sharp = API.createElement({ type: "arrow", roundness: null });
  const curved = API.createElement({
    type: "arrow",
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
  });
  const elbow = API.createElement({ type: "arrow", elbowed: true });
  const line = API.createElement({ type: "line" });

  it("classifies arrow variants", () => {
    expect(isSharpArrow(sharp)).toBe(true);
    expect(isSharpArrow(curved)).toBe(false);
    expect(isSharpArrow(elbow)).toBe(false);
    expect(isCurvedArrow(curved)).toBe(true);
    expect(isCurvedArrow(sharp)).toBe(false);
    expect(isCurvedArrow(elbow)).toBe(false);
  });

  it("getLinearElementSubType", () => {
    expect(getLinearElementSubType(sharp)).toBe("sharpArrow");
    expect(getLinearElementSubType(curved)).toBe("curvedArrow");
    expect(getLinearElementSubType(elbow)).toBe("elbowArrow");
    expect(getLinearElementSubType(line)).toBe("line");
  });

  it("isArrowBoundToElement", () => {
    const binding = {
      elementId: "rect",
      fixedPoint: [0.5, 0.5],
      mode: "orbit",
    } as unknown as ExcalidrawArrowElement["startBinding"];

    expect(isArrowBoundToElement(sharp as ExcalidrawArrowElement)).toBe(false);
    expect(
      isArrowBoundToElement({
        ...(sharp as ExcalidrawArrowElement),
        endBinding: binding,
      }),
    ).toBe(true);
  });

  it("roundness helpers", () => {
    const rect = API.createElement({ type: "rectangle" });
    const diamond = API.createElement({ type: "diamond" });
    const ellipse = API.createElement({ type: "ellipse" });

    expect(isUsingProportionalRadius("diamond")).toBe(true);
    expect(isUsingProportionalRadius("rectangle")).toBe(false);

    expect(
      canApplyRoundnessTypeToElement(ROUNDNESS.ADAPTIVE_RADIUS, rect),
    ).toBe(true);
    expect(canApplyRoundnessTypeToElement(ROUNDNESS.LEGACY, rect)).toBe(true);
    expect(
      canApplyRoundnessTypeToElement(ROUNDNESS.PROPORTIONAL_RADIUS, diamond),
    ).toBe(true);
    expect(
      canApplyRoundnessTypeToElement(ROUNDNESS.PROPORTIONAL_RADIUS, rect),
    ).toBe(false);
    expect(
      canApplyRoundnessTypeToElement(ROUNDNESS.ADAPTIVE_RADIUS, ellipse),
    ).toBe(false);

    expect(getDefaultRoundnessTypeForElement(diamond)).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
    expect(getDefaultRoundnessTypeForElement(rect)).toEqual({
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    });
    expect(getDefaultRoundnessTypeForElement(ellipse)).toBe(null);
  });

  it("polygon helpers", () => {
    const closed = [lp(0, 0), lp(10, 0), lp(10, 10), lp(0, 0)];
    const open = [lp(0, 0), lp(10, 0), lp(10, 10), lp(0, 10)];

    expect(isValidPolygon(closed)).toBe(true);
    expect(isValidPolygon(open)).toBe(false);
    expect(isValidPolygon([lp(0, 0), lp(1, 1), lp(0, 0)])).toBe(false);

    expect(canBecomePolygon(open)).toBe(true);
    expect(canBecomePolygon([lp(0, 0), lp(10, 0), lp(10, 10)])).toBe(true);
    expect(canBecomePolygon([lp(0, 0), lp(10, 0), lp(0, 0)])).toBe(false);
    expect(canBecomePolygon([lp(0, 0), lp(10, 0)])).toBe(false);
  });

  it("isEligibleFrameChildType", () => {
    expect(isEligibleFrameChildType("rectangle")).toBe(true);
    expect(isEligibleFrameChildType("embeddable")).toBe(true);
    expect(isEligibleFrameChildType("magicframe")).toBe(false);
    expect(isEligibleFrameChildType("selection")).toBe(false);
  });
});
