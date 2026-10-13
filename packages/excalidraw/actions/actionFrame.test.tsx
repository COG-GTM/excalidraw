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
    boundElements: [{ id: "boundText", type: "text" }],
  });
  const boundText = API.createElement({
    type: "text",
    id: "boundText",
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
  const deletedInFrame = API.createElement({
    type: "rectangle",
    id: "deleted",
    x: 150,
    y: 150,
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
  return { frame, rect, boundText, ellipse, deletedInFrame, outside };
};

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionSelectAllElementsInFrame", () => {
    it("is enabled only when a single frame is selected", () => {
      const { frame, rect, outside, ...rest } = createFrameScene();
      API.setElements([frame, rect, outside, ...Object.values(rest)]);

      API.setSelectedElements([frame]);
      expect(
        h.app.actionManager.isActionEnabled(actionSelectAllElementsInFrame),
      ).toBe(true);

      API.setSelectedElements([rect]);
      expect(
        h.app.actionManager.isActionEnabled(actionSelectAllElementsInFrame),
      ).toBe(false);

      API.setSelectedElements([frame, outside]);
      expect(
        h.app.actionManager.isActionEnabled(actionSelectAllElementsInFrame),
      ).toBe(false);
    });

    it("selects non-deleted frame children, excluding bound text", () => {
      const { frame, rect, boundText, ellipse, deletedInFrame, outside } =
        createFrameScene();
      API.setElements([
        frame,
        rect,
        boundText,
        ellipse,
        deletedInFrame,
        outside,
      ]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        [rect.id]: true,
        [ellipse.id]: true,
      });
    });

    it("selects nothing for an empty frame", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      API.setElements([frame]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({});
    });

    it("is a no-op when the selected element is not a frame", () => {
      const { rect } = createFrameScene();
      API.setElements([rect]);
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
    it("detaches all children from the selected frame and keeps the frame selected", () => {
      const { frame, rect, boundText, ellipse, outside } = createFrameScene();
      API.setElements([frame, rect, boundText, ellipse, outside]);
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(h.elements.find((el) => el.id === frame.id)).toBeDefined();
      for (const id of [rect.id, boundText.id, ellipse.id]) {
        expect(h.elements.find((el) => el.id === id)?.frameId).toBe(null);
      }
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("is disabled and a no-op without a selected frame", () => {
      const { frame, rect } = createFrameScene();
      API.setElements([frame, rect]);
      API.setSelectedElements([rect]);

      expect(
        h.app.actionManager.isActionEnabled(actionRemoveAllElementsFromFrame),
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
      expect(h.elements.find((el) => el.id === rect.id)?.frameId).toBe(
        frame.id,
      );
    });

    it("records a single undo entry that restores frame membership", () => {
      const { frame, rect, ellipse } = createFrameScene();
      API.updateScene({
        elements: [frame, rect, ellipse],
        appState: { selectedElementIds: { [frame.id]: true } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionRemoveAllElementsFromFrame);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);
      expect(h.elements.find((el) => el.id === rect.id)?.frameId).toBe(null);

      Keyboard.undo();
      expect(h.elements.find((el) => el.id === rect.id)?.frameId).toBe(
        frame.id,
      );
      expect(h.elements.find((el) => el.id === ellipse.id)?.frameId).toBe(
        frame.id,
      );

      Keyboard.redo();
      expect(h.elements.find((el) => el.id === rect.id)?.frameId).toBe(null);
    });
  });

  describe("actionupdateFrameRendering", () => {
    it("toggles frameRendering.enabled and reports it via checked", () => {
      expect(h.state.frameRendering.enabled).toBe(true);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(true);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(false);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(false);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(true);
    });

    it("preserves the other frameRendering flags", () => {
      API.setAppState({
        frameRendering: {
          enabled: true,
          name: false,
          outline: true,
          clip: false,
        },
      });

      API.executeAction(actionupdateFrameRendering);

      expect(h.state.frameRendering).toEqual({
        enabled: false,
        name: false,
        outline: true,
        clip: false,
      });
    });

    it("is available in view mode", () => {
      expect(actionupdateFrameRendering.viewMode).toBe(true);
    });
  });

  describe("actionWrapSelectionInFrame", () => {
    it("is enabled for a non-empty selection without frames", () => {
      const { frame, outside } = createFrameScene();
      API.setElements([frame, outside]);

      API.setSelectedElements([]);
      expect(
        h.app.actionManager.isActionEnabled(actionWrapSelectionInFrame),
      ).toBe(false);

      API.setSelectedElements([outside]);
      expect(
        h.app.actionManager.isActionEnabled(actionWrapSelectionInFrame),
      ).toBe(true);

      API.setSelectedElements([outside, frame]);
      expect(
        h.app.actionManager.isActionEnabled(actionWrapSelectionInFrame),
      ).toBe(false);
    });

    it("wraps the selection in a padded frame and selects the new frame", () => {
      const a = API.createElement({
        id: "a",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const b = API.createElement({
        id: "b",
        x: 200,
        y: 250,
        width: 100,
        height: 50,
      });
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);

      API.executeAction(actionWrapSelectionInFrame);

      const frames = h.elements.filter((el) => el.type === "frame");
      expect(frames).toHaveLength(1);
      const frame = frames[0];
      expect(frame).toMatchObject({
        x: 100 - 16,
        y: 100 - 16,
        width: 200 + 32,
        height: 200 + 32,
      });
      expect(h.elements.find((el) => el.id === a.id)?.frameId).toBe(frame.id);
      expect(h.elements.find((el) => el.id === b.id)?.frameId).toBe(frame.id);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("removes the editing group from a partially selected group", () => {
      const a = API.createElement({
        id: "a",
        x: 0,
        y: 0,
        groupIds: ["outer", "g1"],
      });
      const b = API.createElement({
        id: "b",
        x: 200,
        y: 0,
        groupIds: ["outer", "g1"],
      });
      const c = API.createElement({ id: "c", x: 400, y: 0, groupIds: ["g1"] });
      API.setElements([a, b, c]);
      API.setSelectedElements([a, b], "g1");

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      const nextA = h.elements.find((el) => el.id === a.id)!;
      const nextB = h.elements.find((el) => el.id === b.id)!;
      const nextC = h.elements.find((el) => el.id === c.id)!;
      expect(nextA.groupIds).toEqual(["outer"]);
      expect(nextB.groupIds).toEqual(["outer"]);
      expect(nextC.groupIds).toEqual(["g1"]);
      expect(nextA.frameId).toBe(frame.id);
      expect(nextB.frameId).toBe(frame.id);
      expect(nextC.frameId).toBe(null);
    });

    it("records a single undo entry that removes the frame on undo", () => {
      const a = API.createElement({ id: "a", x: 0, y: 0 });
      API.updateScene({
        elements: [a],
        appState: { selectedElementIds: { [a.id]: true } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionWrapSelectionInFrame);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);
      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(frame.isDeleted).toBe(false);

      Keyboard.undo();
      expect(h.elements.find((el) => el.id === frame.id)?.isDeleted).toBe(true);
      expect(h.elements.find((el) => el.id === a.id)?.frameId).toBe(null);

      Keyboard.redo();
      expect(h.elements.find((el) => el.id === frame.id)?.isDeleted).toBe(
        false,
      );
      expect(h.elements.find((el) => el.id === a.id)?.frameId).toBe(frame.id);
    });
  });
});
