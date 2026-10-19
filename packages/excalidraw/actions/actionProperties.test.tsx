import { fireEvent, queryByTestId } from "@testing-library/react";

import {
  ARROW_TYPE,
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  FREEDRAW_STROKE_WIDTH,
  FONT_FAMILY,
  ROUNDNESS,
  STROKE_WIDTH,
} from "@excalidraw/common";
import { LinearElementEditor } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import "@excalidraw/utils/test-utils";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionChangeArrowType } from "./actionProperties";

const { h } = window;

describe("element locking", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("properties when tool selected", () => {
    it("should show active background top picks", () => {
      UI.clickTool("rectangle");

      const color = DEFAULT_ELEMENT_BACKGROUND_PICKS[1];

      // just in case we change it in the future
      expect(color).not.toBe(COLOR_PALETTE.transparent);

      API.setAppState({
        currentItemBackgroundColor: color,
      });
      const activeColor = queryByTestId(
        document.body,
        `color-top-pick-${color}`,
      );
      expect(activeColor).toHaveClass("active");
    });

    it("should show fill style when background non-transparent", () => {
      UI.clickTool("rectangle");

      const color = DEFAULT_ELEMENT_BACKGROUND_PICKS[1];

      // just in case we change it in the future
      expect(color).not.toBe(COLOR_PALETTE.transparent);

      API.setAppState({
        currentItemBackgroundColor: color,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toHaveClass("active");
      API.setAppState({
        currentItemFillStyle: "solid",
      });
      const solidFillStyle = queryByTestId(document.body, `fill-solid`);
      expect(solidFillStyle).toHaveClass("active");
    });

    it("should not show fill style when background transparent", () => {
      UI.clickTool("rectangle");

      API.setAppState({
        currentItemBackgroundColor: COLOR_PALETTE.transparent,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toBe(null);
    });

    it("should show horizontal text align for text tool", () => {
      UI.clickTool("text");

      API.setAppState({
        currentItemTextAlign: "right",
      });

      const centerTextAlign = queryByTestId(document.body, `align-right`);
      expect(centerTextAlign).toBeChecked();
    });
  });

  describe("properties when elements selected", () => {
    it("should show active styles when single element selected", () => {
      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: "red",
        fillStyle: "cross-hatch",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const crossHatchButton = queryByTestId(document.body, `fill-cross-hatch`);
      expect(crossHatchButton).toHaveClass("active");
    });

    it("should not show fill style selected element's background is transparent", () => {
      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: COLOR_PALETTE.transparent,
        fillStyle: "cross-hatch",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const crossHatchButton = queryByTestId(document.body, `fill-cross-hatch`);
      expect(crossHatchButton).toBe(null);
    });

    it("should highlight common stroke width of selected elements", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      const thinStrokeWidthButton = queryByTestId(
        document.body,
        `strokeWidth-thin`,
      );
      expect(thinStrokeWidthButton).toBeChecked();
    });

    it("should highlight common stroke width key across freedraw and non-freedraw elements", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.medium,
      });
      const freedraw = API.createElement({
        type: "freedraw",
        strokeWidth: FREEDRAW_STROKE_WIDTH.medium,
      });
      API.setElements([rect, freedraw]);
      API.setSelectedElements([rect, freedraw]);

      expect(queryByTestId(document.body, `strokeWidth-medium`)).toBeChecked();
    });

    it("should apply stroke width by element type", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const freedraw = API.createElement({
        type: "freedraw",
        strokeWidth: FREEDRAW_STROKE_WIDTH.thin,
      });
      API.setElements([rect, freedraw]);
      API.setSelectedElements([rect, freedraw]);

      const boldStrokeWidthButton = queryByTestId(
        document.body,
        `strokeWidth-bold`,
      );
      expect(boldStrokeWidthButton).not.toBe(null);
      fireEvent.click(boldStrokeWidthButton!);

      const selectedElements = API.getSelectedElements();
      const selectedRect = selectedElements.find(
        (element) => element.type === "rectangle",
      );
      const selectedFreedraw = selectedElements.find(
        (element) => element.type === "freedraw",
      );

      expect(selectedRect?.strokeWidth).toBe(STROKE_WIDTH.bold);
      expect(selectedFreedraw?.strokeWidth).toBe(FREEDRAW_STROKE_WIDTH.bold);
    });

    it("should create new elements with stroke width by element type", () => {
      API.setAppState({ currentItemStrokeWidthKey: "bold" });

      const rect = API.createElement({ type: "rectangle" });
      const freedraw = API.createElement({ type: "freedraw" });

      expect(rect.strokeWidth).toBe(STROKE_WIDTH.bold);
      expect(freedraw.strokeWidth).toBe(FREEDRAW_STROKE_WIDTH.bold);
    });

    it("should not highlight any stroke width button if no common style", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.medium,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(queryByTestId(document.body, `strokeWidth-thin`)).not.toBe(null);
      expect(
        queryByTestId(document.body, `strokeWidth-thin`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-medium`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-bold`),
      ).not.toBeChecked();
    });

    it("should show properties of different element types when selected", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.medium,
      });
      const text = API.createElement({
        type: "text",
        fontFamily: FONT_FAMILY["Comic Shanns"],
      });
      API.setElements([rect, text]);
      API.setSelectedElements([rect, text]);

      expect(queryByTestId(document.body, `strokeWidth-medium`)).toBeChecked();
      expect(queryByTestId(document.body, `font-family-code`)).toHaveClass(
        "active",
      );
    });
  });
});

describe("actionChangeArrowType", () => {
  const mouse = new Pointer("mouse");

  const getArrow = (id: string) =>
    h.elements.find((el) => el.id === id) as ExcalidrawArrowElement;

  const getGlobalEndpoints = (arrow: ExcalidrawArrowElement) => {
    const elementsMap = h.app.scene.getNonDeletedElementsMap();
    return [
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        0,
        elementsMap,
      ),
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        -1,
        elementsMap,
      ),
    ];
  };

  const expectPointsClose = (
    received: readonly [number, number],
    expected: readonly [number, number],
  ) => {
    expect(received[0]).toBeCloseTo(expected[0]);
    expect(received[1]).toBeCloseTo(expected[1]);
  };

  const expectEndpointOutsideEdge = (
    point: readonly [number, number],
    rect: ExcalidrawElement,
    edge: "left" | "right",
  ) => {
    const edgeX = edge === "left" ? rect.x : rect.x + rect.width;
    const gap = edge === "left" ? edgeX - point[0] : point[0] - edgeX;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(10);
    expect(point[1]).toBeGreaterThanOrEqual(rect.y);
    expect(point[1]).toBeLessThanOrEqual(rect.y + rect.height);
  };

  const createBoundElbowArrow = () => {
    const startRect = UI.createElement("rectangle", {
      x: -150,
      y: -150,
      width: 100,
      height: 100,
    });
    const endRect = UI.createElement("rectangle", {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(-53, -99);
    mouse.click();
    mouse.moveTo(53, 99);
    mouse.click();

    const arrow = API.getSelectedElements()[0] as ExcalidrawArrowElement;
    expect(arrow.elbowed).toBe(true);
    expect(arrow.startBinding?.elementId).toBe(startRect.id);
    expect(arrow.endBinding?.elementId).toBe(endRect.id);

    return {
      arrow,
      startRect: startRect.get(),
      endRect: endRect.get(),
    };
  };

  const createRotatedArrow = () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      angle: Math.PI / 4,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 50)],
    });
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);
    return arrow as ExcalidrawArrowElement;
  };

  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("converts a bound elbow arrow to a round arrow and keeps it bound", () => {
    const { arrow, startRect, endRect } = createBoundElbowArrow();

    UI.clickOnTestId("round-arrow");

    const converted = getArrow(arrow.id);
    expect(converted).not.toBe(arrow);
    expect(converted.elbowed).toBe(false);
    expect(converted.roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
    expect(converted.points).toCloselyEqualPoints([
      [0, 0],
      [88, 200],
    ]);
    expect(converted.startBinding).toEqual(
      expect.objectContaining({ elementId: startRect.id, mode: "orbit" }),
    );
    expect(converted.endBinding).toEqual(
      expect.objectContaining({ elementId: endRect.id, mode: "orbit" }),
    );
    expect(
      h.elements.find((el) => el.id === startRect.id)?.boundElements,
    ).toEqual([{ id: arrow.id, type: "arrow" }]);
    expect(
      h.elements.find((el) => el.id === endRect.id)?.boundElements,
    ).toEqual([{ id: arrow.id, type: "arrow" }]);

    const [start, end] = getGlobalEndpoints(converted);
    expectEndpointOutsideEdge(start, startRect, "right");
    expectEndpointOutsideEdge(end, endRect, "left");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.round);
    expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);
    expect(API.getUndoStack().length).toBeGreaterThan(0);
  });

  it("converts a bound elbow arrow to a sharp arrow and keeps it bound", () => {
    const { arrow, startRect, endRect } = createBoundElbowArrow();

    UI.clickOnTestId("sharp-arrow");

    const converted = getArrow(arrow.id);
    expect(converted.elbowed).toBe(false);
    expect(converted.roundness).toBe(null);
    expect(converted.points).toCloselyEqualPoints([
      [0, 0],
      [88, 200],
    ]);
    expect(converted.startBinding?.elementId).toBe(startRect.id);
    expect(converted.endBinding?.elementId).toBe(endRect.id);

    const [start, end] = getGlobalEndpoints(converted);
    expectEndpointOutsideEdge(start, startRect, "right");
    expectEndpointOutsideEdge(end, endRect, "left");

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.sharp);
  });

  it("rebinds with inside mode when bindMode is inside", () => {
    const { arrow, startRect, endRect } = createBoundElbowArrow();

    API.setAppState({ bindMode: "inside" });
    UI.clickOnTestId("round-arrow");

    const converted = getArrow(arrow.id);
    expect(converted.startBinding).toEqual(
      expect.objectContaining({ elementId: startRect.id, mode: "inside" }),
    );
    expect(converted.endBinding).toEqual(
      expect.objectContaining({ elementId: endRect.id, mode: "inside" }),
    );
  });

  it("converts a bound round arrow back to elbow with fixed point bindings", () => {
    const { arrow, startRect, endRect } = createBoundElbowArrow();

    UI.clickOnTestId("round-arrow");
    UI.clickOnTestId("elbow-arrow");

    const converted = getArrow(arrow.id);
    expect(converted.elbowed).toBe(true);
    expect(converted.roundness).toBe(null);
    expect(converted.angle).toBe(0);
    expect(
      (converted as ExcalidrawArrowElement & { fixedSegments: unknown })
        .fixedSegments,
    ).toBe(null);
    expect(converted.startBinding?.elementId).toBe(startRect.id);
    expect(converted.endBinding?.elementId).toBe(endRect.id);
    expectPointsClose(converted.startBinding!.fixedPoint, [1.06, 0.499]);
    expectPointsClose(converted.endBinding!.fixedPoint, [-0.06, 0.499]);
    expect(converted.points).toCloselyEqualPoints([
      [0, 0],
      [44, 0],
      [44, 200],
      [88, 200],
    ]);
    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
  });

  it("keeps position, angle and points of an unbound rotated arrow when switching to round", () => {
    const arrow = createRotatedArrow();

    UI.clickOnTestId("round-arrow");

    const converted = getArrow(arrow.id);
    expect(converted.elbowed).toBe(false);
    expect(converted.roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
    expect(converted.x).toBe(arrow.x);
    expect(converted.y).toBe(arrow.y);
    expect(converted.angle).toBe(arrow.angle);
    expect(converted.points).toEqual(arrow.points);
  });

  it("preserves global endpoints of an unbound rotated arrow when switching to elbow and back", () => {
    const arrow = createRotatedArrow();
    const [startBefore, endBefore] = getGlobalEndpoints(arrow);

    UI.clickOnTestId("elbow-arrow");

    const elbowed = getArrow(arrow.id);
    expect(elbowed.elbowed).toBe(true);
    expect(elbowed.angle).toBe(0);
    expect(elbowed.x).toBeCloseTo(startBefore[0]);
    expect(elbowed.y).toBeCloseTo(startBefore[1]);
    expect(elbowed.startBinding).toBe(null);
    expect(elbowed.endBinding).toBe(null);

    let [startAfter, endAfter] = getGlobalEndpoints(elbowed);
    expectPointsClose(startAfter, startBefore);
    expectPointsClose(endAfter, endBefore);

    UI.clickOnTestId("sharp-arrow");

    const sharp = getArrow(arrow.id);
    expect(sharp.elbowed).toBe(false);
    expect(sharp.roundness).toBe(null);
    expect(sharp.angle).toBe(0);
    expect(sharp.points).toHaveLength(2);

    [startAfter, endAfter] = getGlobalEndpoints(sharp);
    expectPointsClose(startAfter, startBefore);
    expectPointsClose(endAfter, endBefore);
  });

  it("leaves non-arrow elements untouched", () => {
    const rect = API.createElement({
      type: "rectangle",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    const arrow = API.createElement({ type: "arrow" });
    API.setElements([rect, arrow]);
    API.setSelectedElements([rect, arrow]);

    UI.clickOnTestId("round-arrow");

    expect(h.elements.find((el) => el.id === rect.id)).toBe(rect);
    expect(getArrow(arrow.id).roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
  });

  it("only updates currentItemArrowType when nothing is selected", () => {
    const arrow = API.createElement({ type: "arrow", roundness: null });
    API.setElements([arrow]);
    API.setAppState({ currentItemArrowType: ARROW_TYPE.sharp });

    act(() => {
      h.app.actionManager.executeAction(
        actionChangeArrowType,
        "api",
        ARROW_TYPE.round,
      );
    });

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.round);
    expect(h.elements[0]).toBe(arrow);
    expect(getArrow(arrow.id).roundness).toBe(null);
  });
});
