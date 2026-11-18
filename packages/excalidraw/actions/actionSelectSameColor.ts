import {
  CaptureUpdateAction,
  getNonDeletedElements,
  isTextElement,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { register } from "./register";

const TRANSPARENT = "transparent";

const getSelectedElements = (
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, true>>,
) =>
  elements.filter(
    (element) => !element.isDeleted && selectedElementIds[element.id],
  );

export const actionSelectSameColor = register({
  name: "selectSameColor",
  label: "labels.selectSameColor",
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState.selectedElementIds).length > 0,
  perform: (elements, appState, value, app) => {
    const selectedElements = getSelectedElements(
      elements,
      appState.selectedElementIds,
    );

    if (!selectedElements.length) {
      return false;
    }

    const colors = new Set<string>();
    for (const element of selectedElements) {
      colors.add(element.strokeColor);
      colors.add(element.backgroundColor);
    }
    // "no fill" is shared by most elements, so it isn't a color to match on
    colors.delete(TRANSPARENT);

    const selectedElementIds = elements
      .filter(
        (element) =>
          !element.isDeleted &&
          !element.locked &&
          !(isTextElement(element) && element.containerId) &&
          (colors.has(element.strokeColor) ||
            colors.has(element.backgroundColor)),
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
});
