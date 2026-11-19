import {
  CaptureUpdateAction,
  LinearElementEditor,
  getNonDeletedElements,
  getSelectedElements,
  isLinearElement,
  isTextElement,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { arrayToMap } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { selectAllIcon } from "../components/icons";

import { register } from "./register";

import type { TranslationKeys } from "../i18n";

const SINGLE_TYPE_LABELS: Record<ExcalidrawElement["type"], TranslationKeys> = {
  selection: "labels.selectAllSameTypeMultiple",
  rectangle: "labels.selectAllSameType.rectangle",
  diamond: "labels.selectAllSameType.diamond",
  ellipse: "labels.selectAllSameType.ellipse",
  arrow: "labels.selectAllSameType.arrow",
  line: "labels.selectAllSameType.line",
  freedraw: "labels.selectAllSameType.freedraw",
  text: "labels.selectAllSameType.text",
  image: "labels.selectAllSameType.image",
  frame: "labels.selectAllSameType.frame",
  magicframe: "labels.selectAllSameType.magicframe",
  embeddable: "labels.selectAllSameType.embeddable",
  iframe: "labels.selectAllSameType.iframe",
};

export const actionSelectSameType = register({
  name: "selectSameType",
  // the context menu and command palette pass the returned key through `t()`
  label: (elements, appState) => {
    const selectedTypes = new Set(
      getSelectedElements(elements, appState).map((element) => element.type),
    );
    if (selectedTypes.size !== 1) {
      return "labels.selectAllSameTypeMultiple";
    }
    const [type] = selectedTypes;
    return SINGLE_TYPE_LABELS[type] ?? "labels.selectAllSameTypeMultiple";
  },
  icon: selectAllIcon,
  trackEvent: { category: "canvas" },
  viewMode: false,
  predicate: (elements, appState) =>
    getSelectedElements(elements, appState).length > 0 &&
    !appState.selectedLinearElement?.isEditing,
  perform: (elements, appState, _, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      return false;
    }

    const selectedTypes = new Set(
      getSelectedElements(elements, appState).map((element) => element.type),
    );

    if (!selectedTypes.size) {
      return false;
    }

    const matchingElements = getNonDeletedElements(elements).filter(
      (element) =>
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

    const [onlyElement] = matchingElements;

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
          matchingElements.length === 1 && isLinearElement(onlyElement)
            ? new LinearElementEditor(onlyElement, arrayToMap(elements))
            : null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
