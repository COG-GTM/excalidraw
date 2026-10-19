import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render } from "../tests/test-utils";

import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionupdateFrameRendering,
  actionWrapSelectionInFrame,
} from "./actionFrame";

import type { Action } from "./types";

const { h } = window;

const executeAction = (action: Action) => {
  act(() => {
    h.app.actionManager.executeAction(action);
  });
};

const isEnabled = (action: Action) =>
  h.app.actionManager.isActionEnabled(action);

const getElement = (id: ExcalidrawElement["id"]) =>
  h.elements.find((element) => element.id === id)!;

const getFrames = () =>
  h.elements.filter((element) => element.type === "frame");

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("actionWrapSelectionInFrame", () => {
    it("wraps selected elements in a padded frame and selects it", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        y: 250,
        width: 100,
        height: 40,
      });
      const unselected = API.createElement({
        type: "rectangle",
        x: 500,
        y: 500,
        width: 10,
        height: 10,
      });

      API.setElements([rect1, rect2, unselected]);
      API.setSelectedElements([rect1, rect2]);

      executeAction(actionWrapSelectionInFrame);

      const frames = getFrames();
      expect(frames).toHaveLength(1);
      const frame = frames[0];

      // common bounds [100, 100, 300, 290] expanded by 16px padding
      expect(frame).toMatchObject({
        x: 84,
        y: 84,
        width: 232,
        height: 222,
      });

      expect(getElement(rect1.id).frameId).toBe(frame.id);
      expect(getElement(rect2.id).frameId).toBe(frame.id);
      expect(getElement(unselected.id).frameId).toBe(null);

      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("moves bound text of a wrapped container into the frame", () => {
      const [container, text] = API.createTextContainer();

      API.setElements([container, text]);
      API.setSelectedElements([container]);

      executeAction(actionWrapSelectionInFrame);

      const frame = getFrames()[0];
      expect(frame).toBeDefined();
      expect(getElement(container.id).frameId).toBe(frame.id);
      expect(getElement(text.id).frameId).toBe(frame.id);
    });

    it("removes the editing group id from wrapped elements of a partial group selection", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        groupIds: ["inner", "outer"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 100,
        y: 0,
        width: 50,
        height: 50,
        groupIds: ["outer"],
      });
      const rect3 = API.createElement({
        type: "rectangle",
        x: 200,
        y: 0,
        width: 50,
        height: 50,
        groupIds: ["outer"],
      });

      API.setElements([rect1, rect2, rect3]);
      API.setSelectedElements([rect1, rect2], "outer");
      expect(h.state.editingGroupId).toBe("outer");

      executeAction(actionWrapSelectionInFrame);

      const frame = getFrames()[0];
      expect(frame).toBeDefined();

      // groups nested inside the editing group are kept
      expect(getElement(rect1.id).groupIds).toEqual(["inner"]);
      expect(getElement(rect2.id).groupIds).toEqual([]);
      expect(getElement(rect1.id).frameId).toBe(frame.id);
      expect(getElement(rect2.id).frameId).toBe(frame.id);

      // unselected group member is left untouched
      expect(getElement(rect3.id).groupIds).toEqual(["outer"]);
      expect(getElement(rect3.id).frameId).toBe(null);
    });

    it("captures the update immediately", () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = actionWrapSelectionInFrame.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).not.toBe(false);
      expect(result && result.captureUpdate).toBe(
        CaptureUpdateAction.IMMEDIATELY,
      );
    });

    it("is enabled only for non-empty selections without frames", () => {
      const frame = API.createElement({ type: "frame" });
      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle" });

      API.setElements([frame, rect1, rect2]);

      API.setSelectedElements([]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(false);

      API.setSelectedElements([rect1, rect2]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(true);

      API.setSelectedElements([frame, rect1]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(false);

      API.setSelectedElements([frame]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(false);
    });
  });

  describe("actionSelectAllElementsInFrame", () => {
    it("selects the frame's children excluding bound text", () => {
      const frame = API.createElement({ type: "frame" });
      const rect = API.createElement({ type: "rectangle", frameId: frame.id });
      const [container, text] = API.createTextContainer({ frameId: frame.id });
      const outside = API.createElement({ type: "rectangle" });
      const deleted = API.createElement({
        type: "rectangle",
        frameId: frame.id,
        isDeleted: true,
      });

      API.setElements([rect, container, text, outside, deleted, frame]);
      API.setSelectedElements([frame]);

      executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        [rect.id]: true,
        [container.id]: true,
      });
    });

    it("is a no-op when the selection is not a frame", () => {
      const frame = API.createElement({ type: "frame" });
      const rect = API.createElement({ type: "rectangle", frameId: frame.id });

      API.setElements([rect, frame]);
      API.setSelectedElements([rect]);

      const result = actionSelectAllElementsInFrame.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        elements: h.elements,
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("is enabled only when a single frame is selected", () => {
      const frame1 = API.createElement({ type: "frame" });
      const frame2 = API.createElement({ type: "frame" });
      const rect = API.createElement({ type: "rectangle" });

      API.setElements([frame1, frame2, rect]);

      API.setSelectedElements([frame1]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(true);

      API.setSelectedElements([frame1, frame2]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);

      API.setSelectedElements([]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);
    });
  });

  describe("actionRemoveAllElementsFromFrame", () => {
    it("clears frameId on all children (incl. bound text) and keeps the frame selected", () => {
      const frame = API.createElement({ type: "frame" });
      const otherFrame = API.createElement({ type: "frame" });
      const rect = API.createElement({ type: "rectangle", frameId: frame.id });
      const [container, text] = API.createTextContainer({ frameId: frame.id });
      const inOtherFrame = API.createElement({
        type: "rectangle",
        frameId: otherFrame.id,
      });

      API.setElements([rect, container, text, frame, inOtherFrame, otherFrame]);
      API.setSelectedElements([frame]);

      executeAction(actionRemoveAllElementsFromFrame);

      expect(getElement(rect.id).frameId).toBe(null);
      expect(getElement(container.id).frameId).toBe(null);
      expect(getElement(text.id).frameId).toBe(null);
      expect(getElement(inOtherFrame.id).frameId).toBe(otherFrame.id);
      expect(getElement(frame.id).isDeleted).toBe(false);

      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("is a no-op when the selection is not a frame", () => {
      const frame = API.createElement({ type: "frame" });
      const rect = API.createElement({ type: "rectangle", frameId: frame.id });

      API.setElements([rect, frame]);
      API.setSelectedElements([rect]);

      const result = actionRemoveAllElementsFromFrame.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        elements: h.elements,
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(getElement(rect.id).frameId).toBe(frame.id);
    });

    it("is enabled only when a single frame is selected", () => {
      const frame = API.createElement({ type: "frame" });
      const rect = API.createElement({ type: "rectangle" });

      API.setElements([frame, rect]);

      API.setSelectedElements([frame]);
      expect(isEnabled(actionRemoveAllElementsFromFrame)).toBe(true);

      API.setSelectedElements([frame, rect]);
      expect(isEnabled(actionRemoveAllElementsFromFrame)).toBe(false);
    });
  });

  describe("actionupdateFrameRendering", () => {
    it("toggles frameRendering.enabled and preserves other options", () => {
      const initial = h.state.frameRendering;
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(
        initial.enabled,
      );

      executeAction(actionupdateFrameRendering);

      expect(h.state.frameRendering).toEqual({
        ...initial,
        enabled: !initial.enabled,
      });
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(
        !initial.enabled,
      );

      executeAction(actionupdateFrameRendering);

      expect(h.state.frameRendering).toEqual(initial);
    });
  });
});
