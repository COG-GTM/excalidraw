import {
  getNonDeletedElements,
  getSelectedElements,
  hasStrokeColor,
  isTextElement,
  selectGroupsForSelectedElements,
  CaptureUpdateAction,
} from "@excalidraw/element";

import { KEYS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { selectAllIcon } from "../components/icons";

import { register } from "./register";

export const actionSelectSameColor = register({
  name: "selectSameColor",
  label: "labels.selectSameColor",
  icon: selectAllIcon,
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0,
  perform: (elements, appState, value, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedElements = getSelectedElements(elements, appState);
    if (!selectedElements.length) {
      return false;
    }

    const referenceColor = selectedElements[0].strokeColor;

    const selectedElementIds = getNonDeletedElements(elements)
      .filter(
        (element) =>
          !element.isDeleted &&
          !element.locked &&
          !(isTextElement(element) && element.containerId) &&
          hasStrokeColor(element.type) &&
          element.strokeColor === referenceColor,
      )
      .reduce((map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      }, {});

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
        selectedLinearElement: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    event.key.toLowerCase() === KEYS.A,
});
