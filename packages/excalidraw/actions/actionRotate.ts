import {
  CaptureUpdateAction,
  getCommonBoundingBox,
  getElementAbsoluteCoords,
  getNonDeletedElements,
  isBoundToContainer,
  isFrameLikeElement,
  rotateElementsAroundPoint,
  updateFrameMembershipOfSelectedElements,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint, Radians } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";
import { rotateClockwiseIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

const getElementsToRotate = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
): NonDeletedExcalidrawElement[] =>
  getSelectedElements(getNonDeletedElements(elements), appState).filter(
    (element) =>
      !element.locked &&
      !isFrameLikeElement(element) &&
      !isBoundToContainer(element),
  );

export const actionRotate90Clockwise = register({
  name: "rotate90Clockwise",
  label: "labels.rotate90Clockwise",
  icon: rotateClockwiseIcon,
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (elements, appState) =>
    getElementsToRotate(elements, appState).length > 0,
  perform: (elements, appState, _, app) => {
    const elementsToRotate = getElementsToRotate(elements, appState);

    if (!elementsToRotate.length) {
      return false;
    }

    let center: GlobalPoint;
    if (elementsToRotate.length === 1) {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(
        elementsToRotate[0],
        app.scene.getNonDeletedElementsMap(),
      );
      center = pointFrom((x1 + x2) / 2, (y1 + y2) / 2);
    } else {
      const { midX, midY } = getCommonBoundingBox(elementsToRotate);
      center = pointFrom(midX, midY);
    }

    rotateElementsAroundPoint(
      elementsToRotate,
      app.scene,
      (Math.PI / 2) as Radians,
      center,
    );

    return {
      elements: updateFrameMembershipOfSelectedElements(
        app.scene.getElementsIncludingDeleted(),
        appState,
        app,
      ),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
