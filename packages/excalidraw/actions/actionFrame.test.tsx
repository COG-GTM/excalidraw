import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionWrapSelectionInFrame,
  actionupdateFrameRendering,
} from "./actionFrame";

const { h } = window;

const loadScene = (elements: ExcalidrawElement[]) => {
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
};

const getById = (id: string) => h.elements.find((el) => el.id === id)!;

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionSelectAllElementsInFrame", () => {
    it("predicate is true only when a single frame is selected", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({ id: "rect", frameId: "frame" });
      API.setElements([frame, rect]);

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

      API.setSelectedElements([frame, rect]);
      expect(
        actionSelectAllElementsInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("selects frame children, excluding bound text and deleted elements", () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
      });
      const [container, boundText] = API.createTextContainer({
        frameId: "frame",
      });
      const child = API.createElement({ id: "child", frameId: "frame" });
      const deletedChild = API.createElement({
        id: "deletedChild",
        frameId: "frame",
        isDeleted: true,
      });
      const outside = API.createElement({ id: "outside", x: 1000 });
      API.setElements([
        frame,
        container,
        boundText,
        child,
        deletedChild,
        outside,
      ]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        [container.id]: true,
        child: true,
      });
    });

    it("leaves selection unchanged when the selected element is not a frame", () => {
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = actionSelectAllElementsInFrame.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });
  });

  describe("actionRemoveAllElementsFromFrame", () => {
    it("detaches all children and selects only the frame", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const child1 = API.createElement({ id: "child1", frameId: "frame" });
      const child2 = API.createElement({ id: "child2", frameId: "frame" });
      const other = API.createElement({ id: "other" });
      loadScene([frame, child1, child2, other]);
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(getById("child1").frameId).toBe(null);
      expect(getById("child2").frameId).toBe(null);
      expect(getById("other").frameId).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ frame: true });
    });

    it("records one undo entry that restores frame membership", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const child = API.createElement({ id: "child", frameId: "frame" });
      loadScene([frame, child]);
      API.setSelectedElements([frame]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionRemoveAllElementsFromFrame);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);
      expect(getById("child").frameId).toBe(null);

      Keyboard.undo();
      expect(getById("child").frameId).toBe("frame");
    });

    it("is a no-op when the selection is not a frame", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const child = API.createElement({ id: "child", frameId: "frame" });
      API.setElements([frame, child]);
      API.setSelectedElements([child]);

      expect(
        actionRemoveAllElementsFromFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      const result = actionRemoveAllElementsFromFrame.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(getById("child").frameId).toBe("frame");
    });
  });

  describe("actionupdateFrameRendering", () => {
    it("toggles frameRendering.enabled and keeps the other flags", () => {
      const initial = h.state.frameRendering;
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(
        initial.enabled,
      );

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering).toEqual({
        ...initial,
        enabled: !initial.enabled,
      });
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(
        !initial.enabled,
      );

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering).toEqual(initial);
    });

    it("is available in view mode", () => {
      expect(actionupdateFrameRendering.viewMode).toBe(true);
    });
  });

  describe("actionWrapSelectionInFrame", () => {
    it("predicate requires a non-empty selection without frames", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({ id: "rect", x: 500 });
      API.setElements([frame, rect]);

      API.setSelectedElements([]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([rect]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);

      API.setSelectedElements([rect, frame]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("wraps the selection in a padded frame and selects the new frame", () => {
      const rect1 = API.createElement({
        id: "rect1",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const rect2 = API.createElement({
        id: "rect2",
        x: 200,
        y: 300,
        width: 100,
        height: 20,
      });
      const untouched = API.createElement({ id: "untouched", x: 1000 });
      loadScene([rect1, rect2, untouched]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionWrapSelectionInFrame);

      const frames = h.elements.filter((el) => el.type === "frame");
      expect(frames).toHaveLength(1);
      const frame = frames[0];
      expect(frame).toMatchObject({
        x: 100 - 16,
        y: 100 - 16,
        width: 300 - 100 + 32,
        height: 320 - 100 + 32,
      });
      expect(getById("rect1").frameId).toBe(frame.id);
      expect(getById("rect2").frameId).toBe(frame.id);
      expect(getById("untouched").frameId).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("also adds bound text of selected containers to the frame", () => {
      const [container, boundText] = API.createTextContainer();
      loadScene([container, boundText]);
      API.setSelectedElements([container]);

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(getById(container.id).frameId).toBe(frame.id);
      expect(getById(boundText.id).frameId).toBe(frame.id);
    });

    it("removes the editing group from partially selected group members", () => {
      const rect1 = API.createElement({
        id: "rect1",
        groupIds: ["outer", "inner"],
      });
      const rect2 = API.createElement({
        id: "rect2",
        x: 200,
        groupIds: ["outer", "inner"],
      });
      const rect3 = API.createElement({
        id: "rect3",
        x: 400,
        groupIds: ["outer"],
      });
      loadScene([rect1, rect2, rect3]);
      API.setSelectedElements([rect1], "inner");
      expect(h.state.editingGroupId).toBe("inner");

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(getById("rect1").groupIds).toEqual(["outer"]);
      expect(getById("rect1").frameId).toBe(frame.id);
      expect(getById("rect2").groupIds).toEqual(["outer", "inner"]);
      expect(getById("rect2").frameId).toBe(null);
      expect(getById("rect3").groupIds).toEqual(["outer"]);
    });

    it("records one undo entry; undo removes the frame and redo restores it", () => {
      const rect = API.createElement({ id: "rect" });
      loadScene([rect]);
      API.setSelectedElements([rect]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionWrapSelectionInFrame);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);
      const frameId = h.elements.find((el) => el.type === "frame")!.id;

      Keyboard.undo();
      expect(getById(frameId).isDeleted).toBe(true);
      expect(getById("rect").frameId).toBe(null);

      Keyboard.redo();
      expect(getById(frameId).isDeleted).toBe(false);
      expect(getById("rect").frameId).toBe(frameId);
    });
  });
});
