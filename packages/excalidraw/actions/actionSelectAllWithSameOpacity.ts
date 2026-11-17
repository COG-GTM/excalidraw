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

import type { AppState } from "../types";

const getSelectedOpacities = (
  elements: readonly ExcalidrawElement[],
  appState: Pick<AppState, "selectedElementIds">,
) =>
  new Set(
    elements
      .filter(
        (element) =>
          !element.isDeleted && appState.selectedElementIds[element.id],
      )
      .map((element) => element.opacity),
  );

export const actionSelectAllWithSameOpacity = register({
  name: "selectAllWithSameOpacity",
  label: "labels.selectAllWithSameOpacity",
  icon: selectAllIcon,
  keywords: ["opacity", "transparency", "similar", "match"],
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedOpacities(elements, appState).size > 0,
  perform: (elements, appState, value, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const opacities = getSelectedOpacities(elements, appState);
    if (!opacities.size) {
      return false;
    }

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

    const singleSelected =
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
