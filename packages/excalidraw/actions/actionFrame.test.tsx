import { CaptureUpdateAction } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionWrapSelectionInFrame,
  actionupdateFrameRendering,
} from "./actionFrame";

const { h } = window;

const getElements = () => h.app.scene.getElementsIncludingDeleted();

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const setupFrameScene = () => {
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
    boundElements: [{ type: "text", id: "boundText" }],
  });
  const boundText = API.createElement({
    type: "text",
    id: "boundText",
    x: 20,
    y: 20,
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
  const outside = API.createElement({
    type: "rectangle",
    id: "outside",
    x: 500,
    y: 500,
    width: 50,
    height: 50,
  });
  const elements = [rect, boundText, ellipse, outside, frame];
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
  return { frame, rect, boundText, ellipse, outside };
};

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("selectAllElementsInFrame", () => {
    it("is enabled only when exactly one frame is selected", () => {
      const { frame, rect, outside } = setupFrameScene();

      API.setSelectedElements([frame]);
      expect(
        actionSelectAllElementsInFrame.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);

      API.setSelectedElements([rect]);
      expect(
        actionSelectAllElementsInFrame.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([frame, outside]);
      expect(
        actionSelectAllElementsInFrame.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("selects the frame children but not bound text or outside elements", () => {
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        rect: true,
        ellipse: true,
      });
    });

    it("ignores deleted frame children", () => {
      const { frame, ellipse } = setupFrameScene();
      API.updateScene({
        elements: h.elements.map((el) =>
          el.id === ellipse.id ? { ...el, isDeleted: true } : el,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({ rect: true });
    });

    it("is a no-op that does not capture history when a non-frame is selected", () => {
      const { rect } = setupFrameScene();
      API.setSelectedElements([rect]);

      const result = actionSelectAllElementsInFrame.perform(
        getElements(),
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

  describe("removeAllElementsFromFrame", () => {
    it("detaches all frame children and keeps only the frame selected", () => {
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(getElement("rect").frameId).toBe(null);
      expect(getElement("boundText").frameId).toBe(null);
      expect(getElement("ellipse").frameId).toBe(null);
      expect(getElement("frame").isDeleted).toBe(false);
      expect(h.state.selectedElementIds).toEqual({ frame: true });
    });

    it("records a single undoable history entry", () => {
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionRemoveAllElementsFromFrame);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);

      Keyboard.undo();
      expect(getElement("rect").frameId).toBe("frame");
      expect(getElement("ellipse").frameId).toBe("frame");

      Keyboard.redo();
      expect(getElement("rect").frameId).toBe(null);
      expect(getElement("ellipse").frameId).toBe(null);
    });

    it("is a no-op when a non-frame is selected", () => {
      const { ellipse } = setupFrameScene();
      API.setSelectedElements([ellipse]);

      const result = actionRemoveAllElementsFromFrame.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        elements: h.elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(getElement("ellipse").frameId).toBe("frame");
    });
  });

  describe("updateFrameRendering", () => {
    it("toggles frame rendering and reports it via `checked`", () => {
      expect(h.state.frameRendering.enabled).toBe(true);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(true);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(false);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(false);
      // other frameRendering flags are preserved
      expect(h.state.frameRendering.name).toBe(true);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(true);
    });

    it("is allowed in view mode", () => {
      expect(actionupdateFrameRendering.viewMode).toBe(true);
    });
  });

  describe("wrapSelectionInFrame", () => {
    const createShapes = () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        x: 200,
        y: 250,
        width: 100,
        height: 50,
      });
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      return { rect1, rect2 };
    };

    it("is disabled for empty selections or selections containing a frame", () => {
      const { frame, rect } = setupFrameScene();

      API.setSelectedElements([]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([frame, rect]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([rect]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);
    });

    it("wraps the selection in a padded frame and selects it", () => {
      const { rect1, rect2 } = createShapes();
      API.setSelectedElements([rect1, rect2]);

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
      expect(getElement("rect1").frameId).toBe(frame.id);
      expect(getElement("rect2").frameId).toBe(frame.id);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("removes partially selected group members from the edited group", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        groupIds: ["inner", "outer"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        x: 50,
        y: 0,
        width: 10,
        height: 10,
        groupIds: ["inner", "outer"],
      });
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      act(() => {
        h.setState({ editingGroupId: "outer" });
      });
      API.setSelectedElements(
        [rect1] as NonDeletedExcalidrawElement[],
        "outer",
      );

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(getElement("rect1").groupIds).toEqual(["inner"]);
      expect(getElement("rect1").frameId).toBe(frame.id);
      expect(getElement("rect2").groupIds).toEqual(["inner", "outer"]);
      expect(getElement("rect2").frameId).toBe(null);
    });

    it("can be undone and redone as a single step", () => {
      const { rect1 } = createShapes();
      API.setSelectedElements([rect1]);

      API.executeAction(actionWrapSelectionInFrame);
      const frameId = h.elements.find((el) => el.type === "frame")!.id;

      Keyboard.undo();
      expect(getElement(frameId).isDeleted).toBe(true);
      expect(getElement("rect1").frameId).toBe(null);

      Keyboard.redo();
      expect(getElement(frameId).isDeleted).toBe(false);
      expect(getElement("rect1").frameId).toBe(frameId);
    });
  });
});
