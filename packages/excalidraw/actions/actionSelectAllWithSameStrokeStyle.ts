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

const isSelectable = (element: ExcalidrawElement) =>
  !element.isDeleted &&
  !(isTextElement(element) && element.containerId) &&
  !element.locked;

export const actionSelectAllWithSameStrokeStyle = register({
  name: "selectAllWithSameStrokeStyle",
  label: "labels.selectAllWithSameStrokeStyle",
  icon: selectAllIcon,
  keywords: ["select", "same", "stroke", "style", "dashed", "dotted", "solid"],
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState, _, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const strokeStyles = new Set(
      app.scene.getSelectedElements(appState).map((el) => el.strokeStyle),
    );
    if (!strokeStyles.size) {
      return false;
    }

    const matching = elements.filter(
      (element) =>
        isSelectable(element) && strokeStyles.has(element.strokeStyle),
    );

    const selectedElementIds = matching.reduce(
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
          matching.length === 1 && isLinearElement(matching[0])
            ? new LinearElementEditor(
                matching[0] as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
