import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawFrameElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

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

const elements = () => h.app.scene.getElementsIncludingDeleted();

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
  });
  const [container, boundText] = API.createTextContainer({
    frameId: frame.id,
  });
  const outside = API.createElement({
    type: "ellipse",
    id: "outside",
    x: 500,
    y: 500,
    width: 50,
    height: 50,
  });
  return { frame, rect, container, boundText, outside };
};

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

describe("actionFrame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("selectAllElementsInFrame", () => {
    it("is enabled only when exactly one frame is selected", () => {
      const { frame, rect, container, boundText, outside } = createFrameScene();
      API.setElements([frame, rect, container, boundText, outside]);

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

    it("selects frame children but not bound text or outside elements", () => {
      const { frame, rect, container, boundText, outside } = createFrameScene();
      API.setElements([frame, rect, container, boundText, outside]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        [rect.id]: true,
        [container.id]: true,
      });
    });

    it("ignores deleted frame children", () => {
      const { frame, rect, container, boundText } = createFrameScene();
      API.setElements([
        frame,
        { ...rect, isDeleted: true },
        container,
        boundText,
      ]);
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({ [container.id]: true });
    });

    it("leaves state untouched when the selection is not a frame", () => {
      const { frame, rect, outside } = createFrameScene();
      API.setElements([frame, rect, outside]);

      const result = actionSelectAllElementsInFrame.perform(
        elements(),
        { ...h.state, selectedElementIds: { [outside.id]: true } },
        null,
        h.app,
      );

      expect(result).toMatchObject({
        elements: h.elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(
        result && result.appState && result.appState.selectedElementIds,
      ).toEqual({ [outside.id]: true });
    });
  });

  describe("removeAllElementsFromFrame", () => {
    it("detaches all children and selects only the frame", () => {
      const { frame, rect, container, boundText, outside } = createFrameScene();
      API.setElements([frame, rect, container, boundText, outside]);
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(getElement(rect.id).frameId).toBe(null);
      expect(getElement(container.id).frameId).toBe(null);
      expect(getElement(boundText.id).frameId).toBe(null);
      expect(getElement(frame.id).isDeleted).toBe(false);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("is a no-op when the selection is not a frame", () => {
      const { frame, rect } = createFrameScene();
      API.setElements([frame, rect]);

      const result = actionRemoveAllElementsFromFrame.perform(
        elements(),
        { ...h.state, selectedElementIds: { [rect.id]: true } },
        null,
        h.app,
      );

      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(getElement(rect.id).frameId).toBe(frame.id);
    });

    it("is disabled when more than the frame is selected", () => {
      const { frame, rect } = createFrameScene();
      API.setElements([frame, rect]);
      API.setSelectedElements([frame, rect]);

      expect(
        actionRemoveAllElementsFromFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });
  });

  describe("updateFrameRendering", () => {
    it("toggles frameRendering.enabled while preserving other flags", () => {
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

  describe("wrapSelectionInFrame", () => {
    it("is enabled only for a non-empty selection without frames", () => {
      const { frame, rect, outside } = createFrameScene();
      API.setElements([frame, rect, outside]);

      API.setSelectedElements([]);
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

      API.setSelectedElements([outside, frame]);
      expect(
        actionWrapSelectionInFrame.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("creates a padded frame around the selection and adds the elements to it", () => {
      const a = API.createElement({
        type: "rectangle",
        id: "a",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const b = API.createElement({
        type: "rectangle",
        id: "b",
        x: 200,
        y: 250,
        width: 100,
        height: 50,
      });
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);

      API.executeAction(actionWrapSelectionInFrame);

      const frames = h.elements.filter(
        (el): el is ExcalidrawFrameElement => el.type === "frame",
      );
      expect(frames).toHaveLength(1);
      const frame = frames[0];
      expect(frame).toMatchObject({
        x: 100 - 16,
        y: 100 - 16,
        width: 200 + 32,
        height: 200 + 32,
      });
      expect(getElement("a").frameId).toBe(frame.id);
      expect(getElement("b").frameId).toBe(frame.id);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    });

    it("removes partially selected group members from the editing group", () => {
      const a = API.createElement({
        type: "rectangle",
        id: "a",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        groupIds: ["inner", "outer"],
      });
      const b = API.createElement({
        type: "rectangle",
        id: "b",
        x: 100,
        y: 0,
        width: 50,
        height: 50,
        groupIds: ["inner", "outer"],
      });
      API.setElements([a, b]);
      API.setSelectedElements([a], "outer");

      API.executeAction(actionWrapSelectionInFrame);

      expect(getElement("a").groupIds).toEqual(["inner"]);
      expect(getElement("b").groupIds).toEqual(["inner", "outer"]);
      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(getElement("a").frameId).toBe(frame.id);
      expect(getElement("b").frameId).toBe(null);
    });

    it("records a single undo entry that removes the frame", async () => {
      const a = API.createElement({
        type: "rectangle",
        id: "a",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      });
      API.updateScene({
        elements: [a],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([a as NonDeletedExcalidrawElement]);

      API.executeAction(actionWrapSelectionInFrame);
      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(getElement("a").frameId).toBe(frame.id);

      await act(async () => {
        Keyboard.undo();
      });
      expect(getElement(frame.id).isDeleted).toBe(true);
      expect(getElement("a").frameId).toBe(null);

      await act(async () => {
        Keyboard.redo();
      });
      expect(getElement(frame.id).isDeleted).toBe(false);
      expect(getElement("a").frameId).toBe(frame.id);
    });
  });
});
