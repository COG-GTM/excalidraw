import {
  CaptureUpdateAction,
  isBoundToContainer,
  newElementWith,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { palette } from "../components/icons";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

const getSwappableElements = (
  appState: Pick<AppState, "selectedElementIds">,
  app: AppClassProperties,
): ExcalidrawElement[] =>
  app.scene
    .getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    })
    .filter(
      (element) =>
        !element.isDeleted && !element.locked && !isBoundToContainer(element),
    );

export const actionSwapStrokeAndBackgroundColors = register({
  name: "swapStrokeAndBackgroundColors",
  label: "labels.swapStrokeAndBackgroundColors",
  icon: palette,
  keywords: ["swap", "invert", "colors", "stroke", "background", "fill"],
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState, _, app) =>
    getSwappableElements(appState, app).length > 0,
  perform: (elements, appState, _, app) => {
    const targetIds = new Set(
      getSwappableElements(appState, app).map((element) => element.id),
    );

    if (!targetIds.size) {
      return false;
    }

    return {
      elements: elements.map((element) =>
        targetIds.has(element.id)
          ? newElementWith(element, {
              strokeColor: element.backgroundColor,
              backgroundColor: element.strokeColor,
            })
          : element,
      ),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
