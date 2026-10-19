import React from "react";

import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionZoomToFit,
  actionZoomToFitSelection,
  actionZoomToFitSelectionInViewport,
} from "../actions/actionCanvas";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

import type { KeyboardModifiers } from "./helpers/ui";

const { h } = window;

const VIEWPORT = { width: 1000, height: 500 };
// `getOffsets()` adds 24px of padding on every side
const PADDING = 24;
const CANVAS = {
  width: VIEWPORT.width - PADDING * 2,
  height: VIEWPORT.height - PADDING * 2,
};

// Sizes the editor container to `VIEWPORT`, while viewport UI surfaces
// (`[data-viewport-ui]`, e.g. the styles panel shown on selection) measure as
// empty so they don't eat into the fit area.
const mockViewport = () => {
  window.HTMLDivElement.prototype.getBoundingClientRect = function (
    this: HTMLDivElement,
  ) {
    const isViewportUI = this.hasAttribute("data-viewport-ui");
    const width = isViewportUI ? 0 : VIEWPORT.width;
    const height = isViewportUI ? 0 : VIEWPORT.height;
    return {
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  };
};

const press = (code: string, modifiers: KeyboardModifiers = { shift: true }) =>
  act(() => {
    Keyboard.withModifierKeys(modifiers, () => {
      Keyboard.codePress(code);
    });
  });

const getViewport = () => ({
  zoom: h.state.zoom.value,
  scrollX: h.state.scrollX,
  scrollY: h.state.scrollY,
});

/** asserts that scene point is rendered at the center of the viewport */
const expectCenteredOn = (sceneX: number, sceneY: number) => {
  const { zoom, scrollX, scrollY } = getViewport();
  expect((sceneX + scrollX) * zoom).toBeCloseTo(VIEWPORT.width / 2);
  expect((sceneY + scrollY) * zoom).toBeCloseTo(VIEWPORT.height / 2);
};

describe("zoom to fit actions", () => {
  // scene bounds: [0, 0] -> [2000, 1000], center [1000, 500]
  const createScene = () => {
    const topLeft = API.createElement({
      id: "topLeft",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const bottomRight = API.createElement({
      id: "bottomRight",
      x: 1900,
      y: 900,
      width: 100,
      height: 100,
    });
    // should be ignored by every fit
    const deleted = API.createElement({
      id: "deleted",
      x: -10000,
      y: -10000,
      width: 100,
      height: 100,
      isDeleted: true,
    });
    API.setElements([topLeft, bottomRight, deleted]);
    return { topLeft, bottomRight };
  };

  // scale-down fit of the whole scene into the canvas area
  const SCENE_FIT_ZOOM = Math.min(CANVAS.width / 2000, CANVAS.height / 1000, 1);

  beforeEach(async () => {
    mockViewport();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    // `mockViewport` patches the global window's prototype, so the editor
    // must be mounted in the global document
    expect(h.app.ownerWindow).toBe(window);
    expect(h.state.width).toBe(VIEWPORT.width);
    expect(h.state.height).toBe(VIEWPORT.height);
    expect(h.state.zoom.value).toBe(1);
    expect(h.state.scrollConstraints).toBe(null);
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  describe("zoomToFit (Shift+1)", () => {
    it("zooms out to fit all elements and centers them", () => {
      createScene();

      press(CODES.ONE);

      expect(SCENE_FIT_ZOOM).toBeLessThan(1);
      expect(h.state.zoom.value).toBeCloseTo(SCENE_FIT_ZOOM);
      expectCenteredOn(1000, 500);
    });

    it("ignores the selection", () => {
      const { topLeft } = createScene();
      API.setSelectedElements([topLeft]);

      press(CODES.ONE);

      expect(h.state.zoom.value).toBeCloseTo(SCENE_FIT_ZOOM);
      expectCenteredOn(1000, 500);
    });

    it("doesn't zoom in beyond 100% when content is smaller than the viewport", () => {
      API.setElements([
        API.createElement({ x: 300, y: 200, width: 50, height: 20 }),
      ]);

      press(CODES.ONE);

      expect(h.state.zoom.value).toBe(1);
      expectCenteredOn(325, 210);
    });

    it("isn't triggered with alt or ctrl modifiers", () => {
      createScene();
      const before = getViewport();

      press(CODES.ONE, { shift: true, alt: true });
      expect(getViewport()).toEqual(before);

      press(CODES.ONE, { shift: true, ctrl: true });
      expect(getViewport()).toEqual(before);
    });
  });

  describe("zoomToFitSelectionInViewport (Shift+2)", () => {
    it("centers on a small selection without zooming in (scale-down)", () => {
      const { bottomRight } = createScene();
      API.setSelectedElements([bottomRight]);

      press(CODES.TWO);

      expect(h.state.zoom.value).toBe(1);
      expectCenteredOn(1950, 950);
    });

    it("zooms out to fit a selection larger than the viewport", () => {
      const wide = API.createElement({
        x: -500,
        y: 0,
        width: 3000,
        height: 100,
      });
      createScene();
      API.setElements([...h.elements, wide]);
      API.setSelectedElements([wide]);

      press(CODES.TWO);

      expect(h.state.zoom.value).toBeCloseTo(CANVAS.width / 3000);
      expectCenteredOn(1000, 50);
    });

    it("fits the common bounds of a multi-element selection", () => {
      const { topLeft, bottomRight } = createScene();
      API.setSelectedElements([topLeft, bottomRight]);

      press(CODES.TWO);

      expect(h.state.zoom.value).toBeCloseTo(SCENE_FIT_ZOOM);
      expectCenteredOn(1000, 500);
    });

    it("fits all elements when nothing is selected (same as Shift+1)", () => {
      createScene();
      expect(h.state.selectedElementIds).toEqual({});

      press(CODES.TWO);
      const viaShift2 = getViewport();

      expect(viaShift2.zoom).toBeCloseTo(SCENE_FIT_ZOOM);
      expectCenteredOn(1000, 500);

      act(() => {
        h.setState({
          scrollX: 0,
          scrollY: 0,
          zoom: { value: getNormalizedZoom(1) },
        });
      });
      press(CODES.ONE);

      expect(viaShift2.zoom).toBeCloseTo(h.state.zoom.value);
      expect(viaShift2.scrollX).toBeCloseTo(h.state.scrollX);
      expect(viaShift2.scrollY).toBeCloseTo(h.state.scrollY);
    });

    it("can be executed through the action manager (command palette)", () => {
      const { bottomRight } = createScene();
      API.setSelectedElements([bottomRight]);

      act(() => {
        h.app.actionManager.executeAction(
          actionZoomToFitSelectionInViewport,
          "commandPalette",
        );
      });

      expect(h.state.zoom.value).toBe(1);
      expectCenteredOn(1950, 950);
    });

    it("isn't triggered with alt or ctrl modifiers", () => {
      const { bottomRight } = createScene();
      API.setSelectedElements([bottomRight]);
      const before = getViewport();

      press(CODES.TWO, { shift: true, alt: true });
      expect(getViewport()).toEqual(before);

      press(CODES.TWO, { shift: true, ctrl: true });
      expect(getViewport()).toEqual(before);
    });
  });

  describe("zoomToFitSelection (Shift+3)", () => {
    it("zooms in to fill the viewport with a small selection (contain)", () => {
      const { bottomRight } = createScene();
      API.setSelectedElements([bottomRight]);

      press(CODES.THREE);

      const containZoom = Math.min(CANVAS.width / 100, CANVAS.height / 100);
      expect(containZoom).toBeGreaterThan(1);
      expect(h.state.zoom.value).toBeCloseTo(containZoom);
      expectCenteredOn(1950, 950);
    });

    it("zooms in to fit all elements when nothing is selected", () => {
      API.setElements([
        API.createElement({ x: 300, y: 200, width: 50, height: 20 }),
      ]);

      press(CODES.THREE);

      expect(h.state.zoom.value).toBeCloseTo(
        Math.min(CANVAS.width / 50, CANVAS.height / 20),
      );
      expectCenteredOn(325, 210);
    });

    it("isn't triggered with alt or ctrl modifiers", () => {
      const { bottomRight } = createScene();
      API.setSelectedElements([bottomRight]);
      const before = getViewport();

      press(CODES.THREE, { shift: true, alt: true });
      expect(getViewport()).toEqual(before);

      press(CODES.THREE, { shift: true, ctrl: true });
      expect(getViewport()).toEqual(before);
    });
  });

  it("Shift+2 (scale-down) and Shift+3 (contain) differ for a small selection", () => {
    const { topLeft } = createScene();
    API.setSelectedElements([topLeft]);

    act(() => {
      h.app.actionManager.executeAction(actionZoomToFitSelectionInViewport);
    });
    const scaleDownZoom = h.state.zoom.value;

    act(() => {
      h.app.actionManager.executeAction(actionZoomToFitSelection);
    });
    const containZoom = h.state.zoom.value;

    expect(scaleDownZoom).toBe(1);
    expect(containZoom).toBeGreaterThan(1);
    expectCenteredOn(50, 50);
  });

  it("all zoom-to-fit actions are enabled without scroll constraints", () => {
    createScene();
    for (const action of [
      actionZoomToFit,
      actionZoomToFitSelection,
      actionZoomToFitSelectionInViewport,
    ]) {
      expect(h.app.actionManager.isActionEnabled(action)).toBe(true);
    }
  });
});
