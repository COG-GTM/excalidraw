import {
  getNonDeletedElements,
  getSelectedElements,
  isLinearElement,
  isTextElement,
  LinearElementEditor,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { arrayToMap } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { selectAllIcon } from "../components/icons";
import { t } from "../i18n";

import { register } from "./register";

import type { TranslationKeys } from "../i18n";

const getSelectedTypes = (
  elements: readonly ExcalidrawElement[],
  appState: Parameters<typeof getSelectedElements>[1],
) =>
  new Set<ExcalidrawElementType>(
    getSelectedElements(elements, appState).map((element) => element.type),
  );

export const getSelectSameTypeLabelKey = (
  selectedTypes: ReadonlySet<ExcalidrawElementType>,
): TranslationKeys => {
  if (selectedTypes.size === 1) {
    const [type] = selectedTypes;
    const key = `labels.selectAllSameType.${type}` as TranslationKeys;
    if (t(key, null, "")) {
      return key;
    }
  }
  return "labels.selectAllSameTypeMultiple";
};

export const actionSelectSameType = register({
  name: "selectSameType",
  label: (elements, appState) =>
    getSelectSameTypeLabelKey(getSelectedTypes(elements, appState)),
  icon: selectAllIcon,
  keywords: ["select", "same", "type", "similar", "matching"],
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0 &&
    !appState.selectedLinearElement?.isEditing,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedTypes = getSelectedTypes(elements, appState);
    if (!selectedTypes.size) {
      return false;
    }

    const matchingElements = elements.filter(
      (element) =>
        !element.isDeleted &&
        !element.locked &&
        !(isTextElement(element) && element.containerId) &&
        selectedTypes.has(element.type),
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
