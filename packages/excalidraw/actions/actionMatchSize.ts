import { pointFrom } from "@excalidraw/math";

import {
  CaptureUpdateAction,
  deepCopyElement,
  getElementsInResizingFrame,
  getNonDeletedElements,
  isArrowElement,
  isElbowArrow,
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
  replaceAllElementsInFrame,
  resizeSingleElement,
  unbindBindingElement,
  updateFrameMembershipOfSelectedElements,
} from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import type { Scene } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppState } from "../types";

export const getElementsToMatchSize = (
  elements: readonly ExcalidrawElement[],
  appState: Pick<AppState, "selectedElementIds">,
): NonDeletedExcalidrawElement[] =>
  getSelectedElements(getNonDeletedElements(elements), appState).filter(
    (element) =>
      !element.locked && !(isTextElement(element) && element.containerId),
  );

// by area; ties (e.g. zero-area horizontal/vertical lines) go to the longer one
const getLargestElement = (elements: readonly NonDeletedExcalidrawElement[]) =>
  elements.reduce((largest, element) => {
    const area = element.width * element.height;
    const largestArea = largest.width * largest.height;
    if (area !== largestArea) {
      return area > largestArea ? element : largest;
    }
    return element.width + element.height > largest.width + largest.height
      ? element
      : largest;
  });

// an axis that is zero-length on either side (axis-aligned lines) can't be
// scaled, so it keeps the element's own size
const getMatchedSize = (
  element: NonDeletedExcalidrawElement,
  target: { width: number; height: number },
) => ({
  width:
    element.width === 0 || target.width === 0 ? element.width : target.width,
  height:
    element.height === 0 || target.height === 0
      ? element.height
      : target.height,
});

// resizeSingleElement refuses zero dimensions, so axis-aligned lines are
// scaled here, around their bounding box's top-left corner
const resizeZeroDimensionLinearElement = (
  element: ExcalidrawLinearElement,
  width: number,
  height: number,
  scene: Scene,
) => {
  const minX = Math.min(...element.points.map(([x]) => x));
  const minY = Math.min(...element.points.map(([, y]) => y));
  const scaleX = element.width === 0 ? 1 : width / element.width;
  const scaleY = element.height === 0 ? 1 : height / element.height;

  if (isArrowElement(element)) {
    if (element.startBinding) {
      unbindBindingElement(element, "start", scene);
    }
    if (element.endBinding) {
      unbindBindingElement(element, "end", scene);
    }
  }

  scene.mutateElement(element, {
    width,
    height,
    points: element.points.map(([x, y]) =>
      pointFrom<LocalPoint>(
        minX + (x - minX) * scaleX,
        minY + (y - minY) * scaleY,
      ),
    ),
  });
};

/**
 * Resizes the selected elements to the largest one's width and height.
 * Each element keeps its on-canvas top-left corner (the X/Y shown in the
 * stats panel); for rotated elements that is the rotated corner, so the
 * stored x/y may change.
 */
export const actionMatchSize = register({
  name: "matchSize",
  label: "labels.matchSize",
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getElementsToMatchSize(elements, appState).length > 1,
  perform: (elements, appState, _, app) => {
    const targetElements = getElementsToMatchSize(elements, appState);

    if (targetElements.length < 2) {
      return false;
    }

    const largest = getLargestElement(targetElements);
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const originalElementsMap = new Map(
      Array.from(elementsMap.values()).map((element) => [
        element.id,
        deepCopyElement(element),
      ]),
    );

    for (const element of targetElements) {
      const { width, height } = getMatchedSize(element, largest);
      if (element.width === width && element.height === height) {
        continue;
      }
      const latestElement = elementsMap.get(element.id);
      const origElement = originalElementsMap.get(element.id);
      if (!latestElement || !origElement) {
        continue;
      }
      if (width === 0 || height === 0) {
        if (isLinearElement(latestElement) && !isElbowArrow(latestElement)) {
          resizeZeroDimensionLinearElement(
            latestElement,
            width,
            height,
            app.scene,
          );
        }
        continue;
      }
      // "se" anchors the opposite (top-left) corner
      resizeSingleElement(
        width,
        height,
        latestElement,
        origElement,
        originalElementsMap,
        app.scene,
        "se",
      );
    }

    let nextElements = updateFrameMembershipOfSelectedElements(
      app.scene.getElementsIncludingDeleted(),
      appState,
      app,
    );

    // same as resizing a frame by its handles: children it no longer
    // contains leave it, elements it now fully contains join it
    for (const frame of targetElements.filter(isFrameLikeElement)) {
      nextElements = replaceAllElementsInFrame(
        nextElements,
        getElementsInResizingFrame(
          app.scene.getElementsIncludingDeleted(),
          frame,
          appState,
          app.scene.getNonDeletedElementsMap(),
        ),
        frame,
      );
    }

    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
