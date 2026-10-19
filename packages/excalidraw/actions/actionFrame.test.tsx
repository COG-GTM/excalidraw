import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionupdateFrameRendering,
  actionWrapSelectionInFrame,
} from "./actionFrame";

const { h } = window;

const createFrameScene = () => {
  const frame = API.createElement({
    type: "frame",
    id: "frame",
    x: 0,
    y: 0,
    width: 300,
    height: 300,
  });
  const rect = API.createElement({
    type: "rectangle",
    id: "rect",
    x: 10,
    y: 10,
    width: 50,
    height: 50,
    frameId: frame.id,
    boundElements: [{ id: "label", type: "text" }],
  });
  const label = API.createElement({
    type: "text",
    id: "label",
    text: "hello",
    containerId: rect.id,
    frameId: frame.id,
  });
  const ellipse = API.createElement({
    type: "ellipse",
    id: "ellipse",
    x: 100,
    y: 100,
    width: 50,
    height: 50,
    frameId: frame.id,
  });
  const deleted = API.createElement({
    type: "diamond",
    id: "deleted",
    x: 150,
    y: 150,
    width: 20,
    height: 20,
    frameId: frame.id,
    isDeleted: true,
  });
  const outside = API.createElement({
    type: "rectangle",
    id: "outside",
    x: 500,
    y: 500,
    width: 50,
    height: 50,
  });
  return { frame, rect, label, ellipse, deleted, outside };
};

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("selectAllElementsInFrame", () => {
    it("is enabled only when a single frame is selected", () => {
      const { frame, rect, outside } = createFrameScene();
      API.setElements([frame, rect, outside]);

      API.setSelectedElements([frame]);
      expect(
        actionSelectAllElementsInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);

      API.setSelectedElements([rect]);
      expect(
        actionSelectAllElementsInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([frame, outside]);
      expect(
        actionSelectAllElementsInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("selects non-deleted frame children, excluding bound text", () => {
      const scene = createFrameScene();
      API.setElements(Object.values(scene));
      API.setSelectedElements([scene.frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        [scene.rect.id]: true,
        [scene.ellipse.id]: true,
      });
    });

    it("leaves selection untouched when the selection is not a frame", () => {
      const scene = createFrameScene();
      API.setElements(Object.values(scene));
      API.setSelectedElements([scene.outside]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({ [scene.outside.id]: true });
    });
  });

  describe("removeAllElementsFromFrame", () => {
    it("is enabled only when a single frame is selected", () => {
      const scene = createFrameScene();
      API.setElements(Object.values(scene));

      API.setSelectedElements([scene.frame]);
      expect(
        actionRemoveAllElementsFromFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);

      API.setSelectedElements([scene.ellipse]);
      expect(
        actionRemoveAllElementsFromFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("detaches all children from the frame and keeps the frame selected", () => {
      const scene = createFrameScene();
      API.setElements(Object.values(scene));
      API.setSelectedElements([scene.frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(API.getElement(scene.rect).frameId).toBe(null);
      expect(API.getElement(scene.label).frameId).toBe(null);
      expect(API.getElement(scene.ellipse).frameId).toBe(null);
      expect(API.getElement(scene.frame).isDeleted).toBe(false);
      expect(h.state.selectedElementIds).toEqual({ [scene.frame.id]: true });
    });

    it("is a no-op when the selection is not a frame", () => {
      const scene = createFrameScene();
      API.setElements(Object.values(scene));
      API.setSelectedElements([scene.ellipse]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(API.getElement(scene.ellipse).frameId).toBe(scene.frame.id);
      expect(API.getElement(scene.rect).frameId).toBe(scene.frame.id);
      expect(h.state.selectedElementIds).toEqual({ [scene.ellipse.id]: true });
    });

    it("records a single undoable history entry", () => {
      const scene = createFrameScene();
      API.updateScene({
        elements: Object.values(scene),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([scene.frame]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionRemoveAllElementsFromFrame);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);
      expect(API.getElement(scene.ellipse).frameId).toBe(null);

      Keyboard.undo();
      expect(API.getElement(scene.ellipse).frameId).toBe(scene.frame.id);
      expect(API.getElement(scene.rect).frameId).toBe(scene.frame.id);
    });
  });

  describe("updateFrameRendering", () => {
    it("toggles frameRendering.enabled while preserving other flags", () => {
      expect(h.state.frameRendering.enabled).toBe(true);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(true);
      const { clip, name, outline } = h.state.frameRendering;

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering).toEqual({
        enabled: false,
        clip,
        name,
        outline,
      });
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(false);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(true);
    });

    it("is available in view mode", () => {
      expect(actionupdateFrameRendering.viewMode).toBe(true);
    });
  });

  describe("wrapSelectionInFrame", () => {
    it("is disabled for empty selections and selections containing frames", () => {
      const scene = createFrameScene();
      API.setElements(Object.values(scene));

      API.clearSelection();
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([scene.frame, scene.outside]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([scene.outside]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);
    });

    it("wraps the selection in a padded frame and selects it", () => {
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
        height: 30,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionWrapSelectionInFrame);

      const frames = h.elements.filter((el) => el.type === "frame");
      expect(frames).toHaveLength(1);
      const frame = frames[0];
      expect(frame).toMatchObject({
        x: 100 - 16,
        y: 100 - 16,
        width: 200 + 32,
        height: 180 + 32,
      });
      expect(API.getElement(rect1).frameId).toBe(frame.id);
      expect(API.getElement(rect2).frameId).toBe(frame.id);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("removes partially selected group members from the editing group", () => {
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
        groupIds: ["inner", "outer"],
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1], "outer");
      expect(h.state.editingGroupId).toBe("outer");

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(API.getElement(rect1).groupIds).toEqual(["inner"]);
      expect(API.getElement(rect1).frameId).toBe(frame.id);
      expect(API.getElement(rect2).groupIds).toEqual(["inner", "outer"]);
      expect(API.getElement(rect2).frameId).toBe(null);
    });

    it("can be undone and redone", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      });
      API.updateScene({
        elements: [rect],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([rect]);

      API.executeAction(actionWrapSelectionInFrame);
      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(API.getElement(rect).frameId).toBe(frame.id);

      Keyboard.undo();
      expect(API.getElement(frame).isDeleted).toBe(true);
      expect(API.getElement(rect).frameId).toBe(null);

      Keyboard.redo();
      expect(API.getElement(frame).isDeleted).toBe(false);
      expect(API.getElement(rect).frameId).toBe(frame.id);
    });
  });
});
