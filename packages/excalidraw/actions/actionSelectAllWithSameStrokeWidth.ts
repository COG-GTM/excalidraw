import {
  CaptureUpdateAction,
  LinearElementEditor,
  getNonDeletedElements,
  isLinearElement,
  isTextElement,
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

export const actionSelectAllWithSameStrokeWidth = register({
  name: "selectAllWithSameStrokeWidth",
  label: "labels.selectAllWithSameStrokeWidth",
  icon: selectAllIcon,
  keywords: ["select", "similar", "stroke", "width", "thickness"],
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedElements = getSelectedElements(elements, appState, {
      includeBoundTextElement: false,
    });
    if (!selectedElements.length) {
      return false;
    }

    const strokeWidths = new Set(
      selectedElements.map((element) => element.strokeWidth),
    );

    const matchingElements = elements.filter(
      (element) =>
        !element.isDeleted &&
        !(isTextElement(element) && element.containerId) &&
        !element.locked &&
        strokeWidths.has(element.strokeWidth),
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
});
