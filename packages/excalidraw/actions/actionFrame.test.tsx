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

const setupFrameScene = () => {
  const frame = API.createElement({
    type: "frame",
    id: "frame",
    x: 0,
    y: 0,
    width: 400,
    height: 400,
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
    text: "label",
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
    type: "rectangle",
    id: "deleted",
    x: 200,
    y: 200,
    frameId: frame.id,
    isDeleted: true,
  });
  const outside = API.createElement({
    type: "rectangle",
    id: "outside",
    x: 600,
    y: 600,
  });

  API.updateScene({
    elements: [frame, rect, label, ellipse, deleted, outside],
    captureUpdate: CaptureUpdateAction.NEVER,
  });

  return { frame, rect, label, ellipse, deleted, outside };
};

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionSelectAllElementsInFrame", () => {
    it("is only enabled when a single frame is selected", () => {
      const { frame, rect } = setupFrameScene();

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

    it("selects non-deleted frame children, excluding bound text", () => {
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        rect: true,
        ellipse: true,
      });
    });

    it("does nothing when the selected element is not a frame", () => {
      const { rect } = setupFrameScene();
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
  });

  describe("actionRemoveAllElementsFromFrame", () => {
    it("is only enabled when a single frame is selected", () => {
      const { frame, ellipse } = setupFrameScene();

      API.setSelectedElements([frame]);
      expect(
        actionRemoveAllElementsFromFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);

      API.setSelectedElements([ellipse]);
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
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(
        h.elements.filter((el) => el.frameId === frame.id).map((el) => el.id),
      ).toEqual([]);
      expect(API.getElement(frame).isDeleted).toBe(false);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("records a single undoable history entry", () => {
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionRemoveAllElementsFromFrame);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);

      Keyboard.undo();
      expect(
        h.elements
          .filter((el) => !el.isDeleted && el.frameId === frame.id)
          .map((el) => el.id)
          .sort(),
      ).toEqual(["ellipse", "label", "rect"]);
    });

    it("does nothing when the selected element is not a frame", () => {
      const { ellipse } = setupFrameScene();
      API.setSelectedElements([ellipse]);

      const result = actionRemoveAllElementsFromFrame.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        elements: h.elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(h.elements.find((el) => el.id === "ellipse")?.frameId).toBe(
        "frame",
      );
    });
  });

  describe("actionupdateFrameRendering", () => {
    it("toggles frameRendering.enabled and reports it via checked", () => {
      const initial = h.state.frameRendering.enabled;
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(initial);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(!initial);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(!initial);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(initial);
    });

    it("preserves the other frameRendering flags", () => {
      const { name, outline, clip } = h.state.frameRendering;

      API.executeAction(actionupdateFrameRendering);

      expect(h.state.frameRendering).toMatchObject({ name, outline, clip });
    });
  });

  describe("actionWrapSelectionInFrame", () => {
    it("is disabled with an empty selection or when a frame is selected", () => {
      const { frame, outside } = setupFrameScene();

      API.clearSelection();
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([frame, outside]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([outside]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);
    });

    it("wraps the selection in a padded frame and selects the new frame", () => {
      const rect1 = API.createElement({
        id: "r1",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const rect2 = API.createElement({
        id: "r2",
        x: 200,
        y: 300,
        width: 100,
        height: 20,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(frame).toBeDefined();
      expect(frame).toMatchObject({
        x: 100 - 16,
        y: 100 - 16,
        width: 200 + 32,
        height: 220 + 32,
      });
      expect(API.getElement(rect1).frameId).toBe(frame.id);
      expect(API.getElement(rect2).frameId).toBe(frame.id);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("removes partially selected group members from the editing group", () => {
      const rect1 = API.createElement({
        id: "r1",
        x: 0,
        y: 0,
        groupIds: ["outer", "g1"],
      });
      const rect2 = API.createElement({
        id: "r2",
        x: 200,
        y: 0,
        groupIds: ["outer", "g1"],
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1], "g1");
      expect(h.state.editingGroupId).toBe("g1");

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(API.getElement(rect1).groupIds).toEqual(["outer"]);
      expect(API.getElement(rect1).frameId).toBe(frame.id);
      expect(API.getElement(rect2).groupIds).toEqual(["outer", "g1"]);
      expect(API.getElement(rect2).frameId).toBe(null);
    });

    it("is undoable in a single step", () => {
      const rect = API.createElement({ id: "r1", x: 0, y: 0 });
      API.updateScene({
        elements: [rect],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([rect]);

      API.executeAction(actionWrapSelectionInFrame);
      expect(h.elements.filter((el) => el.type === "frame")).toHaveLength(1);

      Keyboard.undo();
      expect(
        h.elements.filter((el) => el.type === "frame" && !el.isDeleted),
      ).toHaveLength(0);
      expect(API.getElement(rect).frameId).toBe(null);
    });
  });
});
