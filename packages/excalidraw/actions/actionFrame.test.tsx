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

import type { Action } from "./types";

const { h } = window;

const isEnabled = (action: Action) =>
  action.predicate!(h.elements, h.state, h.app.props, h.app);

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
    frameId: frame.id,
    boundElements: [{ id: "text", type: "text" }],
  });
  const text = API.createElement({
    type: "text",
    id: "text",
    containerId: rect.id,
    frameId: frame.id,
  });
  const ellipse = API.createElement({
    type: "ellipse",
    id: "ellipse",
    x: 150,
    y: 150,
    frameId: frame.id,
  });
  const outside = API.createElement({
    type: "rectangle",
    id: "outside",
    x: 500,
    y: 500,
  });
  API.updateScene({
    elements: [frame, rect, text, ellipse, outside],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  return { frame, rect, text, ellipse, outside };
};

describe("frame actions", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionSelectAllElementsInFrame", () => {
    it("is only enabled for a single selected frame", () => {
      const { frame, rect } = setupFrameScene();

      API.setSelectedElements([frame]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(true);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);

      API.setSelectedElements([frame, rect]);
      expect(isEnabled(actionSelectAllElementsInFrame)).toBe(false);
    });

    it("selects frame children except bound text", () => {
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({
        rect: true,
        ellipse: true,
      });
    });

    it("does nothing when the selection is not a frame", () => {
      const { outside } = setupFrameScene();
      API.setSelectedElements([outside]);

      API.executeAction(actionSelectAllElementsInFrame);

      expect(h.state.selectedElementIds).toEqual({ outside: true });
    });
  });

  describe("actionRemoveAllElementsFromFrame", () => {
    it("is only enabled for a single selected frame", () => {
      const { frame, outside } = setupFrameScene();
      API.setSelectedElements([frame]);
      expect(isEnabled(actionRemoveAllElementsFromFrame)).toBe(true);
      API.setSelectedElements([outside]);
      expect(isEnabled(actionRemoveAllElementsFromFrame)).toBe(false);
    });

    it("detaches all children and keeps the frame selected, with undo/redo", () => {
      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(h.elements.filter((el) => el.frameId)).toEqual([]);
      expect(h.state.selectedElementIds).toEqual({ frame: true });

      Keyboard.undo();
      expect(
        h.elements
          .filter((el) => el.frameId === frame.id)
          .map((el) => el.id)
          .sort(),
      ).toEqual(["ellipse", "rect", "text"]);

      Keyboard.redo();
      expect(h.elements.filter((el) => el.frameId)).toEqual([]);
    });

    it("does nothing when the selection is not a frame", () => {
      const { outside } = setupFrameScene();
      API.setSelectedElements([outside]);

      API.executeAction(actionRemoveAllElementsFromFrame);

      expect(h.elements.filter((el) => el.frameId)).toHaveLength(3);
    });
  });

  describe("actionupdateFrameRendering", () => {
    it("toggles frame rendering and reports checked state", () => {
      const initial = h.state.frameRendering.enabled;
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(initial);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(!initial);
      expect(actionupdateFrameRendering.checked!(h.state)).toBe(!initial);

      API.executeAction(actionupdateFrameRendering);
      expect(h.state.frameRendering.enabled).toBe(initial);
    });
  });

  describe("actionWrapSelectionInFrame", () => {
    const setupLooseElements = () => {
      const a = API.createElement({
        type: "rectangle",
        id: "a",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        groupIds: ["group"],
      });
      const b = API.createElement({
        type: "rectangle",
        id: "b",
        x: 200,
        y: 150,
        width: 50,
        height: 100,
        groupIds: ["group"],
      });
      API.updateScene({
        elements: [a, b],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      return { a, b };
    };

    it("is enabled for non-frame selections only", () => {
      const { a } = setupLooseElements();
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(false);

      API.setSelectedElements([a]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(true);

      const { frame } = setupFrameScene();
      API.setSelectedElements([frame]);
      expect(isEnabled(actionWrapSelectionInFrame)).toBe(false);
    });

    it("wraps the selection in a padded frame, with undo/redo", () => {
      const { a, b } = setupLooseElements();
      API.setSelectedElements([a, b]);

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      expect(frame).toBeDefined();
      expect(frame.x).toBe(84);
      expect(frame.y).toBe(84);
      expect(frame.width).toBe(182);
      expect(frame.height).toBe(182);
      expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
      expect(
        h.elements.filter((el) => el.frameId === frame.id).map((el) => el.id),
      ).toEqual(["a", "b"]);

      Keyboard.undo();
      expect(h.elements.find((el) => el.type === "frame")?.isDeleted).toBe(
        true,
      );
      expect(h.elements.filter((el) => el.frameId)).toEqual([]);

      Keyboard.redo();
      expect(h.elements.find((el) => el.type === "frame")?.isDeleted).toBe(
        false,
      );
      expect(h.elements.filter((el) => el.frameId)).toHaveLength(2);
    });

    it("removes partially selected group members from the edited group", () => {
      const { a } = setupLooseElements();
      API.setSelectedElements([a], "group");

      API.executeAction(actionWrapSelectionInFrame);

      const frame = h.elements.find((el) => el.type === "frame")!;
      const nextA = h.elements.find((el) => el.id === "a")!;
      const nextB = h.elements.find((el) => el.id === "b")!;
      expect(nextA.groupIds).toEqual([]);
      expect(nextA.frameId).toBe(frame.id);
      expect(nextB.groupIds).toEqual(["group"]);
      expect(nextB.frameId).toBeNull();
    });
  });
});
