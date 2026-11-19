import {
  CaptureUpdateAction,
  deepCopyElement,
  getNonDeletedElements,
  isTextElement,
  resizeSingleElement,
  updateFrameMembershipOfSelectedElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
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

const getLargestElement = (elements: readonly NonDeletedExcalidrawElement[]) =>
  elements.reduce((largest, element) =>
    element.width * element.height > largest.width * largest.height
      ? element
      : largest,
  );

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

    const { width, height } = getLargestElement(targetElements);
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const originalElementsMap = new Map(
      Array.from(elementsMap.values()).map((element) => [
        element.id,
        deepCopyElement(element),
      ]),
    );

    for (const element of targetElements) {
      if (element.width === width && element.height === height) {
        continue;
      }
      const latestElement = elementsMap.get(element.id);
      const origElement = originalElementsMap.get(element.id);
      if (!latestElement || !origElement) {
        continue;
      }
      // "se" anchors the opposite (top-left) corner, keeping x/y in place
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

    return {
      elements: updateFrameMembershipOfSelectedElements(
        app.scene.getElementsIncludingDeleted(),
        appState,
        app,
      ),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
