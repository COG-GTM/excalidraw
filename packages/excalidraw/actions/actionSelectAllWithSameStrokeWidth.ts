import {
  getNonDeletedElements,
  getSelectedElements,
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

export const actionSelectAllWithSameStrokeWidth = register({
  name: "selectAllWithSameStrokeWidth",
  label: "labels.selectAllWithSameStrokeWidth",
  icon: selectAllIcon,
  keywords: ["stroke", "width", "thickness", "select", "same"],
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(getNonDeletedElements(elements), appState).length > 0,
  perform: (elements, appState, value, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const strokeWidths = new Set(
      getSelectedElements(getNonDeletedElements(elements), appState).map(
        (element) => element.strokeWidth,
      ),
    );

    if (!strokeWidths.size) {
      return false;
    }

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

    const nextSelection = selectGroupsForSelectedElements(
      {
        editingGroupId: null,
        selectedElementIds,
      },
      getNonDeletedElements(elements),
      appState,
      app,
    );

    const elementsMap = arrayToMap(elements);
    const finalSelectedIds = Object.keys(
      nextSelection.selectedElementIds,
    ).filter((id) => nextSelection.selectedElementIds[id]);
    const singleSelected =
      finalSelectedIds.length === 1
        ? elementsMap.get(finalSelectedIds[0])
        : undefined;

    return {
      appState: {
        ...appState,
        ...nextSelection,
        selectedLinearElement:
          singleSelected && isLinearElement(singleSelected)
            ? new LinearElementEditor(
                singleSelected as NonDeleted<ExcalidrawLinearElement>,
                elementsMap,
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
