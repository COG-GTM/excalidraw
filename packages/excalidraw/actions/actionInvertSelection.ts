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
  GroupId,
  NonDeleted,
} from "@excalidraw/element/types";

import { selectAllIcon } from "../components/icons";

import { register } from "./register";

export const actionInvertSelection = register({
  name: "invertSelection",
  label: "labels.invertSelection",
  icon: selectAllIcon,
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState, _, app) =>
    !appState.selectedLinearElement?.isEditing &&
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    });

    const selectedIds = new Set(selectedElements.map((element) => element.id));
    // a selected group member counts as its whole (outermost) group
    const selectedGroupIds = new Set<GroupId>(
      selectedElements
        .filter((element) => element.groupIds.length > 0)
        .map((element) => element.groupIds[element.groupIds.length - 1]),
    );

    const selectedElementIds = elements
      .filter(
        (element) =>
          !element.isDeleted &&
          !(isTextElement(element) && element.containerId) &&
          !element.locked &&
          !selectedIds.has(element.id) &&
          !element.groupIds.some((groupId) => selectedGroupIds.has(groupId)),
      )
      .reduce((map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      }, {});

    const selectedIdsList = Object.keys(selectedElementIds);
    const singleSelectedElement =
      selectedIdsList.length === 1
        ? app.scene.getNonDeletedElementsMap().get(selectedIdsList[0])
        : undefined;

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
          singleSelectedElement && isLinearElement(singleSelectedElement)
            ? new LinearElementEditor(
                singleSelectedElement as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
