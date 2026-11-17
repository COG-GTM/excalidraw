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

import { register } from "./register";

export const actionSelectAllWithSameBackgroundColor = register({
  name: "selectAllWithSameBackgroundColor",
  label: "labels.selectAllWithSameBackgroundColor",
  icon: selectAllIcon,
  keywords: ["select", "background", "fill", "color", "same", "similar"],
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState, _, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedElements = app.scene.getSelectedElements(appState);
    if (!selectedElements.length) {
      return false;
    }

    const backgroundColors = new Set(
      selectedElements.map((element) => element.backgroundColor),
    );

    const matchingElements = elements.filter(
      (element) =>
        !element.isDeleted &&
        !(isTextElement(element) && element.containerId) &&
        !element.locked &&
        backgroundColors.has(element.backgroundColor),
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
