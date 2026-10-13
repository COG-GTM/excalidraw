import {
  CaptureUpdateAction,
  excludeElementsInFramesFromSelection,
  getNonDeletedElements,
  getSelectedElements,
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

import { register } from "./register";

export const actionSelectAllWithSameStrokeColor = register({
  name: "selectAllWithSameStrokeColor",
  label: "labels.selectAllWithSameStrokeColor",
  keywords: ["select", "same", "stroke", "color", "colour", "matching"],
  icon: selectAllIcon,
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const strokeColors = new Set(
      app.scene
        .getSelectedElements({
          selectedElementIds: appState.selectedElementIds,
        })
        .map((element) => element.strokeColor),
    );
    if (!strokeColors.size) {
      return false;
    }

    const elementsToSelect = excludeElementsInFramesFromSelection(
      elements.filter(
        (element) =>
          !element.isDeleted &&
          strokeColors.has(element.strokeColor) &&
          !(isTextElement(element) && element.containerId) &&
          !element.locked,
      ),
    );

    const selectedElementIds = elementsToSelect.reduce(
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
          elementsToSelect.length === 1 && isLinearElement(elementsToSelect[0])
            ? new LinearElementEditor(
                elementsToSelect[0] as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
