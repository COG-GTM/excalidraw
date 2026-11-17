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

import { StrokeStyleDashedIcon } from "../components/icons";

import { register } from "./register";

const isSelectable = (element: ExcalidrawElement) =>
  !element.isDeleted &&
  !(isTextElement(element) && element.containerId) &&
  !element.locked;

export const actionSelectAllWithSameStrokeStyle = register({
  name: "selectAllWithSameStrokeStyle",
  label: "labels.selectAllWithSameStrokeStyle",
  icon: StrokeStyleDashedIcon,
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState, _, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedStrokeStyles = new Set(
      app.scene
        .getSelectedElements(appState)
        .map((element) => element.strokeStyle),
    );

    if (!selectedStrokeStyles.size) {
      return false;
    }

    const matchingElements = elements.filter(
      (element) =>
        isSelectable(element) && selectedStrokeStyles.has(element.strokeStyle),
    );

    const selectedElementIds = matchingElements.reduce(
      (map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      },
      {},
    );

    const singleElement =
      matchingElements.length === 1 ? matchingElements[0] : null;

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
          singleElement && isLinearElement(singleElement)
            ? new LinearElementEditor(
                singleElement as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
