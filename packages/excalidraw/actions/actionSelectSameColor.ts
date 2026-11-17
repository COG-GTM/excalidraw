import {
  CaptureUpdateAction,
  getNonDeletedElements,
  isLinearElement,
  isTextElement,
  LinearElementEditor,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { selectAllIcon } from "../components/icons";
import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionSelectSameColor = register({
  name: "selectSameColor",
  label: "labels.selectSameColor",
  icon: selectAllIcon,
  keywords: ["color", "stroke", "select", "same"],
  trackEvent: { category: "canvas" },
  viewMode: false,
  perform: (elements, appState, value, app) => {
    const selectedElements = getSelectedElements(elements, appState);
    if (!selectedElements.length) {
      return false;
    }

    const targetColor = selectedElements[0].strokeColor;

    const matchingElements = elements.filter(
      (element) =>
        !element.isDeleted &&
        !element.locked &&
        !(isTextElement(element) && element.containerId) &&
        element.strokeColor === targetColor,
    );

    const selectedElementIds = matchingElements.reduce(
      (map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      },
      {},
    );

    return {
      appState: {
        ...appState,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: null,
            selectedElementIds,
          },
          getNonDeletedElements(elements),
          appState,
          app,
        ),
        selectedLinearElement:
          matchingElements.length === 1 && isLinearElement(matchingElements[0])
            ? new LinearElementEditor(
                matchingElements[0] as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0,
});
