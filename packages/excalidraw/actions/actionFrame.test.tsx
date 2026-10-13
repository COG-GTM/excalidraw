import { CaptureUpdateAction } from "@excalidraw/element";

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

const isEnabled = (action: Parameters<typeof API.executeAction>[0]) =>
  h.app.actionManager.isActionEnabled(action);

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("selectAllElementsInFrame", () => {
    it("is enabled only when a single frame is selected", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([frame, rect]);

      API.setSelectedElements([]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);

      API.setSelectedElements([frame, rect]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);

      API.setSelectedElements([frame]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(true);
    });

    it("is enabled for a selected magicframe", () => {
      const frame = API.createElement({ type: "magicframe", id: "magic" });
      API.setElements([frame]);
      API.setSelectedElements([frame]);

      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(true);
    });

    it("selects frame children, excluding bound text and deleted elements", () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
        height: 500,
      });
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        frameId: frame.id,
      });
      const deleted = API.createElement({
        type: "ellipse",
        id: "deleted",
        frameId: frame.id,
        isDeleted: true,
      });
      const outside = API.createElement({ type: "diamond", id: "outside" });
      const [container, boundText] = API.createTextContainer({
        frameId: frame.id,
        label: { frameId: frame.id },
      });

      API.setElements([frame, rect, deleted, outside, container, boundText]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        [rect.id]: true,
        [container.id]: true,
      });
    });

    it("results in an empty selection for an empty frame", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      API.setElements([frame]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({});
    });

    it("is a no-op when the selected element is not a frame", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const other = API.createElement({ type: "ellipse", id: "other" });
      API.setElements([rect, other]);
      API.setSelectedElements([rect]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({ [rect.id]: true });
    });
  });

  describe("removeAllElementsFromFrame", () => {
    it("is enabled only when a single frame is selected", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([frame, rect]);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionRemoveAllElementsFromFrame)).toBe(false);

      API.setSelectedElements([frame]);
      expect(isEnabled(actionRemoveAllElementsFromFrame)).toBe(true);
    });

    it("detaches every child from the frame and keeps the frame selected", () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
        height: 500,
      });
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        frameId: frame.id,
      });
      const ellipse = API.createElement({
        type: "ellipse",
        id: "ellipse",
        frameId: frame.id,
      });
      const otherFrame = API.createElement({ type: "frame", id: "frame2" });
      const inOtherFrame = API.createElement({
        type: "rectangle",
        id: "inOther",
        frameId: otherFrame.id,
      });

      API.setElements([frame, rect, ellipse, otherFrame, inOtherFrame]);
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(API.getElement(rect).frameId).toBe(null);
      expect(API.getElement(ellipse).frameId).toBe(null);
      expect(API.getElement(inOtherFrame).frameId).toBe(otherFrame.id);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("does nothing when the selected element is not a frame", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        frameId: frame.id,
      });
      API.setElements([frame, rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(API.getElement(rect).frameId).toBe(frame.id);
      expect(h.state.selectedElementIds).toEqual({ [rect.id]: true });
    });

    it("records a single undoable history entry", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        frameId: frame.id,
      });
      API.updateScene({
        elements: [frame, rect],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([frame]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(API.getUndoStack().length).toBe(undoStackSize + 1);
      expect(API.getElement(rect).frameId).toBe(null);

      Keyboard.undo();
      expect(API.getElement(rect).frameId).toBe(frame.id);

      Keyboard.redo();
      expect(API.getElement(rect).frameId).toBe(null);
    });
  });

  describe("updateFrameRendering", () => {
    it("toggles frameRendering.enabled while keeping the other flags", () => {
      const initial = h.state.frameRendering;

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering).toEqual({
        ...initial,
        enabled: !initial.enabled,
      });

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering).toEqual(initial);
    });

    it("reports checked state from appState", () => {
      expect(
        actionupdateFrameRendering.checked!({
          ...h.state,
          frameRendering: { ...h.state.frameRendering, enabled: true },
        }),
      ).toBe(true);
      expect(
        actionupdateFrameRendering.checked!({
          ...h.state,
          frameRendering: { ...h.state.frameRendering, enabled: false },
        }),
      ).toBe(false);
    });

    it("is available in view mode", () => {
      expect(actionupdateFrameRendering.viewMode).toBe(true);
    });
  });

  describe("wrapSelectionInFrame", () => {
    it("is enabled for a non-empty selection without frames", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([frame, rect]);

      API.setSelectedElements([]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(false);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(true);

      API.setSelectedElements([rect, frame]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(false);
    });

    it("wraps the selection in a padded frame and selects it", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        x: 200,
        y: 100,
        width: 50,
        height: 50,
      });
      const untouched = API.createElement({
        type: "rectangle",
        id: "untouched",
        x: 1000,
        y: 1000,
      });
      API.setElements([rect1, rect2, untouched]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionWrapSelectionInFrame);

      const frames = h.elements.filter((el) => el.type === "frame");
      expect(frames).toHaveLength(1);
      const frame = frames[0];
      expect(frame).toMatchObject({
        x: -16,
        y: -16,
        width: 250 + 32,
        height: 150 + 32,
      });
      expect(API.getElement(rect1).frameId).toBe(frame.id);
      expect(API.getElement(rect2).frameId).toBe(frame.id);
      expect(API.getElement(untouched).frameId).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("pulls the wrapped elements out of the group being edited", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        groupIds: ["inner", "outer"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        x: 200,
        groupIds: ["inner", "outer"],
      });
      const sibling = API.createElement({
        type: "rectangle",
        id: "sibling",
        x: 400,
        groupIds: ["outer"],
      });
      API.setElements([rect1, rect2, sibling]);
      API.setSelectedElements([rect1, rect2], "outer");
      expect(h.state.editingGroupId).toBe("outer");

      API.executeAction(actionWrapSelectionInFrame);

      expect(API.getElement(rect1).groupIds).toEqual(["inner"]);
      expect(API.getElement(rect2).groupIds).toEqual(["inner"]);
      expect(API.getElement(sibling).groupIds).toEqual(["outer"]);
    });

    it("can be undone", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.updateScene({
        elements: [rect],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([rect]);

      API.executeAction(actionWrapSelectionInFrame);
      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(API.getElement(rect).frameId).toBe(frame.id);

      Keyboard.undo();

      expect(API.getElement(rect).frameId).toBe(null);
      expect(h.elements.find((el) => el.id === frame.id)?.isDeleted).toBe(true);
    });
  });
});
