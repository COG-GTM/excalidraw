import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  isTextElement,
  newElementWith,
} from "@excalidraw/element";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { paintIcon } from "../components/icons";
import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppState } from "../types";

const getResettableElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  elementsMap: ElementsMap,
) =>
  getSelectedElements(elements, appState, {
    includeBoundTextElement: true,
  }).filter(
    (element) =>
      !element.locked &&
      !(
        isTextElement(element) &&
        element.containerId &&
        elementsMap.get(element.containerId)?.locked
      ),
  );

export const actionResetStyles = register({
  name: "resetStyles",
  label: "labels.resetStyles",
  icon: paintIcon,
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState, _, app) =>
    getResettableElements(
      elements,
      appState,
      app.scene.getNonDeletedElementsMap(),
    ).length > 0,
  perform: (elements, appState, _, app) => {
    const idsToReset = new Set(
      getResettableElements(
        elements,
        appState,
        app.scene.getNonDeletedElementsMap(),
      ).map((element) => element.id),
    );

    if (!idsToReset.size) {
      return false;
    }

    return {
      elements: elements.map((element) =>
        idsToReset.has(element.id)
          ? newElementWith(element, {
              strokeColor: DEFAULT_ELEMENT_PROPS.strokeColor,
              backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
              fillStyle: DEFAULT_ELEMENT_PROPS.fillStyle,
              strokeWidth: DEFAULT_ELEMENT_PROPS.strokeWidth,
              strokeStyle: DEFAULT_ELEMENT_PROPS.strokeStyle,
              roughness: DEFAULT_ELEMENT_PROPS.roughness,
              opacity: DEFAULT_ELEMENT_PROPS.opacity,
            })
          : element,
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
