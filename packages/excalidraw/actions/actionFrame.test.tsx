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

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("selectAllElementsInFrame", () => {
    it("is enabled only when exactly one frame is selected", () => {
      const frame = API.createElement({ type: "frame", id: "f1" });
      const rect = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([frame, rect]);

      const isEnabled = () =>
        actionSelectAllElementsInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        );

      API.setSelectedElements([frame]);
      expect(isEnabled()).toBe(true);

      API.setSelectedElements([rect]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([frame, rect]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([]);
      expect(isEnabled()).toBe(false);
    });

    it("selects the frame's children but not bound text or deleted children", () => {
      const frame = API.createElement({ type: "frame", id: "f1" });
      const container = API.createElement({
        type: "rectangle",
        id: "container",
        frameId: "f1",
        boundElements: [{ type: "text", id: "boundText" }],
      });
      const boundText = API.createElement({
        type: "text",
        id: "boundText",
        containerId: "container",
        frameId: "f1",
      });
      const child = API.createElement({
        type: "ellipse",
        id: "child",
        frameId: "f1",
      });
      const deletedChild = API.createElement({
        type: "ellipse",
        id: "deletedChild",
        frameId: "f1",
        isDeleted: true,
      });
      const outside = API.createElement({ type: "diamond", id: "outside" });

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
        container: true,
        child: true,
      });
    });

    it("clears the selection when the frame has no children", () => {
      const frame = API.createElement({ type: "frame", id: "f1" });
      API.setElements([frame]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({});
    });

    it("is a no-op when the selection is not a frame", () => {
      const rect = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({ r1: true });
    });
  });

  describe("removeAllElementsFromFrame", () => {
    it("is enabled only when exactly one frame is selected", () => {
      const frame = API.createElement({ type: "magicframe", id: "f1" });
      const rect = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([frame, rect]);

      API.setSelectedElements([frame]);
      expect(
        actionRemoveAllElementsFromFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);

      API.setSelectedElements([rect]);
      expect(
        actionRemoveAllElementsFromFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("detaches every child from the frame and keeps the frame selected", () => {
      const frame = API.createElement({ type: "frame", id: "f1" });
      const r1 = API.createElement({
        type: "rectangle",
        id: "r1",
        frameId: "f1",
      });
      const r2 = API.createElement({
        type: "ellipse",
        id: "r2",
        frameId: "f1",
      });
      const other = API.createElement({
        type: "frame",
        id: "f2",
      });
      const otherChild = API.createElement({
        type: "rectangle",
        id: "r3",
        frameId: "f2",
      });

      API.setElements([frame, r1, r2, other, otherChild]);
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(getElement("r1").frameId).toBe(null);
      expect(getElement("r2").frameId).toBe(null);
      expect(getElement("r3").frameId).toBe("f2");
      expect(getElement("f1").isDeleted).toBe(false);
      expect(h.state.selectedElementIds).toEqual({ f1: true });
    });

    it("is a no-op when the selection is not a frame", () => {
      const frame = API.createElement({ type: "frame", id: "f1" });
      const r1 = API.createElement({
        type: "rectangle",
        id: "r1",
        frameId: "f1",
      });
      API.setElements([frame, r1]);
      API.setSelectedElements([r1]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(getElement("r1").frameId).toBe("f1");
      expect(h.state.selectedElementIds).toEqual({ r1: true });
    });

    it("records a single undo entry that restores frame membership", () => {
      const frame = API.createElement({ type: "frame", id: "f1" });
      const r1 = API.createElement({
        type: "rectangle",
        id: "r1",
        frameId: "f1",
      });
      API.updateScene({
        elements: [frame, r1],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([frame]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(getElement("r1").frameId).toBe(null);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);

      Keyboard.undo();
      expect(getElement("r1").frameId).toBe("f1");

      Keyboard.redo();
      expect(getElement("r1").frameId).toBe(null);
    });
  });

  describe("updateFrameRendering", () => {
    it("toggles frameRendering.enabled and reflects it in checked()", () => {
      expect(h.state.frameRendering.enabled).toBe(true);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(true);

      API.executeAction(actionupdateFrameRendering);

      expect(h.state.frameRendering.enabled).toBe(false);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(false);
      // other frameRendering flags are preserved
      expect(h.state.frameRendering).toEqual(
        expect.objectContaining({ clip: true, name: true, outline: true }),
      );

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(true);
    });

    it("is available in view mode", () => {
      expect(actionupdateFrameRendering.viewMode).toBe(true);
    });
  });

  describe("wrapSelectionInFrame", () => {
    it("is enabled for a non-empty selection without frames", () => {
      const frame = API.createElement({ type: "frame", id: "f1" });
      const rect = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([frame, rect]);

      const isEnabled = () =>
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        );

      API.setSelectedElements([]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([rect]);
      expect(isEnabled()).toBe(true);

      API.setSelectedElements([rect, frame]);
      expect(isEnabled()).toBe(false);
    });

    it("creates a padded frame around the selection, adds the elements to it and selects it", () => {
      const r1 = API.createElement({
        type: "rectangle",
        id: "r1",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const r2 = API.createElement({
        type: "rectangle",
        id: "r2",
        x: 200,
        y: 250,
        width: 100,
        height: 50,
      });
      const untouched = API.createElement({
        type: "rectangle",
        id: "r3",
        x: 1000,
        y: 1000,
      });
      API.setElements([r1, r2, untouched]);
      API.setSelectedElements([r1, r2]);

      API.executeAction(actionWrapSelectionInFrame);

      const frames = h.elements.filter((el) => el.type === "frame");
      expect(frames).toHaveLength(1);
      const frame = frames[0];

      expect(frame.x).toBe(100 - 16);
      expect(frame.y).toBe(100 - 16);
      expect(frame.width).toBe(200 + 32);
      expect(frame.height).toBe(200 + 32);

      expect(getElement("r1").frameId).toBe(frame.id);
      expect(getElement("r2").frameId).toBe(frame.id);
      expect(getElement("r3").frameId).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("removes a partially selected group member from the editing group", () => {
      const r1 = API.createElement({
        type: "rectangle",
        id: "r1",
        groupIds: ["inner", "outer"],
      });
      const r2 = API.createElement({
        type: "rectangle",
        id: "r2",
        x: 200,
        groupIds: ["inner", "outer"],
      });
      API.setElements([r1, r2]);
      API.setSelectedElements([r1], "outer");
      expect(h.state.editingGroupId).toBe("outer");

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(getElement("r1").groupIds).toEqual(["inner"]);
      expect(getElement("r1").frameId).toBe(frame.id);
      expect(getElement("r2").groupIds).toEqual(["inner", "outer"]);
      expect(getElement("r2").frameId).toBe(null);
    });

    it("can be undone in a single step", () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      API.updateScene({
        elements: [r1],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([r1]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionWrapSelectionInFrame);
      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);

      Keyboard.undo();
      expect(getElement(frame.id).isDeleted).toBe(true);
      expect(getElement("r1").frameId).toBe(null);

      Keyboard.redo();
      expect(getElement(frame.id).isDeleted).toBe(false);
      expect(getElement("r1").frameId).toBe(frame.id);
    });
  });
});
