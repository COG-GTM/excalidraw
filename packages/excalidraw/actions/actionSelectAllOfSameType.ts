import {
  CaptureUpdateAction,
  getNonDeletedElements,
  getSelectedElements,
  isLinearElement,
  isTextElement,
  LinearElementEditor,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { selectAllIcon } from "../components/icons";

import { register } from "./register";

import type { AppClassProperties, UIAppState } from "../types";

const TYPES_WITH_LABEL: readonly ExcalidrawElementType[] = [
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
  "image",
  "frame",
  "magicframe",
  "embeddable",
  "iframe",
];

const getSelectedTypes = (
  appState: Readonly<Pick<UIAppState, "selectedElementIds">>,
  app: AppClassProperties,
) =>
  new Set(
    app.scene
      .getSelectedElements({ selectedElementIds: appState.selectedElementIds })
      .map((element) => element.type),
  );

export const actionSelectAllElementsOfSameType = register({
  name: "selectAllElementsOfSameType",
  label: (elements, appState, app) => {
    const types = getSelectedTypes(appState, app);
    if (types.size === 1) {
      const [type] = types;
      if (TYPES_WITH_LABEL.includes(type)) {
        return `labels.selectAllOfType.${type}`;
      }
    }
    return "labels.selectAllElementsOfSameType";
  },
  keywords: ["select", "same", "type", "similar", "matching"],
  icon: selectAllIcon,
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedTypes = getSelectedTypes(appState, app);
    if (!selectedTypes.size) {
      return false;
    }

    const elementsToSelect = elements.filter(
      (element) =>
        !element.isDeleted &&
        selectedTypes.has(element.type) &&
        !(isTextElement(element) && element.containerId) &&
        !element.locked,
    );

    const selectedElementIds = elementsToSelect.reduce(
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
          // single linear element selected
          elementsToSelect.length === 1 && isLinearElement(elementsToSelect[0])
            ? new LinearElementEditor(
                elementsToSelect[0] as NonDeleted<ExcalidrawLinearElement>,
                arrayToMap(elements),
              )
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
