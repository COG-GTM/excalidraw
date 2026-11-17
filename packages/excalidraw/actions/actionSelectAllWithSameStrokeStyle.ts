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

export const actionSelectAllWithSameStrokeStyle = register({
  name: "selectAllWithSameStrokeStyle",
  label: "labels.selectAllWithSameStrokeStyle",
  icon: selectAllIcon,
  keywords: ["dashed", "dotted", "solid", "stroke", "style"],
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const strokeStyles = new Set(
      getSelectedElements(elements, appState).map(
        (element) => element.strokeStyle,
      ),
    );

    if (!strokeStyles.size) {
      return false;
    }

    const matchingElements = elements.filter(
      (element) =>
        !element.isDeleted &&
        !(isTextElement(element) && element.containerId) &&
        !element.locked &&
        strokeStyles.has(element.strokeStyle),
    );

    const selectedElementIds = matchingElements.reduce(
      (map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      },
      {},
    );

    const groupSelection = selectGroupsForSelectedElements(
      {
        editingGroupId: null,
        selectedElementIds,
      },
      getNonDeletedElements(elements),
      appState,
      app,
    );

    const finalSelectedIds = Object.keys(
      groupSelection.selectedElementIds,
    ).filter((id) => groupSelection.selectedElementIds[id]);
    const elementsMap = arrayToMap(elements);
    const singleSelected =
      finalSelectedIds.length === 1
        ? elementsMap.get(finalSelectedIds[0])
        : undefined;

    return {
      appState: {
        ...appState,
        ...groupSelection,
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
