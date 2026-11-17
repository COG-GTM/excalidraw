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

export const actionSelectAllWithSameBackgroundColor = register({
  name: "selectAllWithSameBackgroundColor",
  label: "labels.selectAllWithSameBackgroundColor",
  icon: selectAllIcon,
  keywords: ["fill", "color", "colour", "similar"],
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const backgroundColors = new Set(
      getSelectedElements(elements, appState).map(
        (element) => element.backgroundColor,
      ),
    );

    if (!backgroundColors.size) {
      return false;
    }

    const selectedElementIds = elements
      .filter(
        (element) =>
          !element.isDeleted &&
          !(isTextElement(element) && element.containerId) &&
          !element.locked &&
          backgroundColors.has(element.backgroundColor),
      )
      .reduce((map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      }, {});

    const nextSelection = selectGroupsForSelectedElements(
      { editingGroupId: null, selectedElementIds },
      getNonDeletedElements(elements),
      appState,
      app,
    );

    const finalSelectedIds = Object.keys(nextSelection.selectedElementIds);
    const singleSelected =
      finalSelectedIds.length === 1
        ? elements.find((element) => element.id === finalSelectedIds[0])
        : undefined;

    return {
      appState: {
        ...appState,
        ...nextSelection,
        selectedLinearElement:
          singleSelected && isLinearElement(singleSelected)
            ? new LinearElementEditor(
                singleSelected as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
