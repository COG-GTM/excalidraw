import {
  getNonDeletedElements,
  isLinearElement,
  isTextElement,
  LinearElementEditor,
  selectGroupsForSelectedElements,
  CaptureUpdateAction,
} from "@excalidraw/element";

import { arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { selectAllIcon } from "../components/icons";

import { register } from "./register";

export const actionSelectAllWithSameOpacity = register({
  name: "selectAllWithSameOpacity",
  label: "labels.selectAllWithSameOpacity",
  icon: selectAllIcon,
  keywords: ["opacity", "transparency", "select", "same"],
  trackEvent: { category: "element" },
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

    const opacities = new Set(selectedElements.map((el) => el.opacity));

    const matchingElements = elements.filter(
      (element) =>
        !element.isDeleted &&
        !(isTextElement(element) && element.containerId) &&
        !element.locked &&
        opacities.has(element.opacity),
    );

    const selectedElementIds = matchingElements.reduce(
      (map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      },
      {},
    );

    const nextSelection = selectGroupsForSelectedElements(
      {
        editingGroupId: null,
        selectedElementIds,
      },
      getNonDeletedElements(elements),
      appState,
      app,
    );

    return {
      appState: {
        ...appState,
        ...nextSelection,
        selectedLinearElement:
          Object.keys(nextSelection.selectedElementIds).length === 1 &&
          matchingElements.length === 1 &&
          isLinearElement(matchingElements[0])
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
