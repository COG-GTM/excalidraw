import { KEYS, reseed } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render, unmountComponent } from "../tests/test-utils";

import { actionGroup, actionUngroup } from "./actionGroup";

const { h } = window;

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const isGroupEnabled = () =>
  actionGroup.predicate!(h.elements, h.state, {}, h.app);

const isUngroupEnabled = () => actionUngroup.predicate!(h.elements, h.state);

const setup = (elements: NonDeletedExcalidrawElement[]) => {
  API.setElements(elements);
  API.setSelectedElements(elements);
};

describe("actionGroup / actionUngroup", () => {
  beforeEach(async () => {
    unmountComponent();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionGroup", () => {
    it("assigns a shared groupId to 2+ elements and selects the group", () => {
      const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        x: 50,
      });
      const ellipse = API.createElement({ type: "ellipse", id: "ell", x: 100 });
      setup([rect1, rect2, ellipse]);

      expect(isGroupEnabled()).toBe(true);
      API.executeAction(actionGroup);

      const groupId = getElement("rect1").groupIds[0];
      expect(groupId).toBeTruthy();
      expect(h.elements.map((el) => el.groupIds)).toEqual([
        [groupId],
        [groupId],
        [groupId],
      ]);
      expect(h.state.selectedGroupIds).toEqual({ [groupId]: true });
      expect(h.state.selectedElementIds).toEqual({
        rect1: true,
        rect2: true,
        ell: true,
      });
    });

    it("is disabled for a single selected element", () => {
      const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
      const rect2 = API.createElement({ type: "rectangle", id: "rect2" });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1]);

      expect(isGroupEnabled()).toBe(false);
      API.executeAction(actionGroup);

      expect(h.elements.every((el) => el.groupIds.length === 0)).toBe(true);
    });

    it("is disabled when the selection is already a single group", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        groupIds: ["g1"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        groupIds: ["g1"],
      });
      setup([rect1, rect2]);

      expect(h.state.selectedGroupIds).toEqual({ g1: true });
      expect(isGroupEnabled()).toBe(false);
      API.executeAction(actionGroup);

      expect(h.elements.map((el) => el.groupIds)).toEqual([["g1"], ["g1"]]);
    });

    it("nests an existing group inside a new outer group", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        groupIds: ["inner"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        groupIds: ["inner"],
      });
      const rect3 = API.createElement({ type: "rectangle", id: "rect3" });
      setup([rect1, rect2, rect3]);

      expect(isGroupEnabled()).toBe(true);
      API.executeAction(actionGroup);

      const outer = getElement("rect3").groupIds[0];
      expect(outer).not.toBe("inner");
      expect(getElement("rect1").groupIds).toEqual(["inner", outer]);
      expect(getElement("rect2").groupIds).toEqual(["inner", outer]);
      expect(getElement("rect3").groupIds).toEqual([outer]);
      expect(h.state.selectedGroupIds).toEqual({ [outer]: true });
    });

    it("moves grouped elements to the z-index of the topmost one", () => {
      const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
      const other = API.createElement({ type: "rectangle", id: "other" });
      const rect2 = API.createElement({ type: "rectangle", id: "rect2" });
      API.setElements([rect1, other, rect2]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionGroup);

      expect(h.elements.map((el) => el.id)).toEqual([
        "other",
        "rect1",
        "rect2",
      ]);
    });

    it("keeps bound text with its container", () => {
      const [container, text] = API.createTextContainer();
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([container, text, rect]);
      API.setSelectedElements([container, rect]);

      API.executeAction(actionGroup);

      const groupId = getElement("rect").groupIds[0];
      expect(getElement(container.id).groupIds).toEqual([groupId]);
      expect(getElement(text.id).groupIds).toEqual([groupId]);
    });

    it("groups children of the same frame and keeps them in the frame", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        frameId: "frame",
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        frameId: "frame",
      });
      API.setElements([rect1, rect2, frame]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionGroup);

      const groupId = getElement("rect1").groupIds[0];
      expect(groupId).toBeTruthy();
      expect(getElement("rect2").groupIds).toEqual([groupId]);
      expect(getElement("rect1").frameId).toBe("frame");
      expect(getElement("rect2").frameId).toBe("frame");
    });

    it("removes frame children from their frame when grouped with outside elements", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const inside = API.createElement({
        type: "rectangle",
        id: "inside",
        frameId: "frame",
      });
      const outside = API.createElement({
        type: "rectangle",
        id: "outside",
        x: 500,
      });
      API.setElements([inside, frame, outside]);
      API.setSelectedElements([inside, outside]);

      API.executeAction(actionGroup);

      const groupId = getElement("outside").groupIds[0];
      expect(getElement("inside").groupIds).toEqual([groupId]);
      expect(getElement("inside").frameId).toBe(null);
    });

    it("is disabled when a frame and its children are selected together", () => {
      const frame = API.createElement({ type: "frame", id: "frame" });
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        frameId: "frame",
      });
      API.setElements([rect, frame]);
      API.setSelectedElements([rect, frame]);

      expect(isGroupEnabled()).toBe(false);
    });
  });

  describe("actionUngroup", () => {
    it("is disabled when no group is selected", () => {
      const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
      const rect2 = API.createElement({ type: "rectangle", id: "rect2" });
      setup([rect1, rect2]);

      expect(isUngroupEnabled()).toBe(false);
    });

    it("removes the group and selects the individual elements", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        groupIds: ["g1"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        groupIds: ["g1"],
      });
      setup([rect1, rect2]);

      expect(isUngroupEnabled()).toBe(true);
      API.executeAction(actionUngroup);

      expect(h.elements.map((el) => el.groupIds)).toEqual([[], []]);
      expect(h.state.selectedGroupIds).toEqual({});
      expect(h.state.selectedElementIds).toEqual({ rect1: true, rect2: true });
    });

    it("removes only the outermost groupId of nested groups", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        id: "rect1",
        groupIds: ["inner", "outer"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        id: "rect2",
        groupIds: ["inner", "outer"],
      });
      const rect3 = API.createElement({
        type: "rectangle",
        id: "rect3",
        groupIds: ["outer"],
      });
      setup([rect1, rect2, rect3]);

      expect(h.state.selectedGroupIds).toEqual({ outer: true });
      API.executeAction(actionUngroup);

      expect(getElement("rect1").groupIds).toEqual(["inner"]);
      expect(getElement("rect2").groupIds).toEqual(["inner"]);
      expect(getElement("rect3").groupIds).toEqual([]);
      expect(h.state.selectedGroupIds).toEqual({ inner: true });
      expect(h.state.selectedElementIds).toEqual({
        rect1: true,
        rect2: true,
        rect3: true,
      });
    });

    it("ungroups bound text with its container but keeps the text unselected", () => {
      const [container, text] = API.createTextContainer({ groupIds: ["g1"] });
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        groupIds: ["g1"],
      });
      API.setElements([container, text, rect]);
      API.setSelectedElements([container, rect]);

      API.executeAction(actionUngroup);

      expect(getElement(container.id).groupIds).toEqual([]);
      expect(getElement(text.id).groupIds).toEqual([]);
      expect(h.state.selectedElementIds).toEqual({
        [container.id]: true,
        rect: true,
      });
    });
  });

  describe("keyboard shortcuts and history", () => {
    it("groups with Ctrl+G and ungroups with Ctrl+Shift+G", () => {
      const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
      const rect2 = API.createElement({ type: "rectangle", id: "rect2" });
      setup([rect1, rect2]);

      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress(KEYS.G);
      });
      expect(h.elements.every((el) => el.groupIds.length === 0)).toBe(true);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.G);
      });
      const groupId = getElement("rect1").groupIds[0];
      expect(groupId).toBeTruthy();
      expect(getElement("rect2").groupIds).toEqual([groupId]);

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyPress(KEYS.G.toUpperCase());
      });
      expect(h.elements.map((el) => el.groupIds)).toEqual([[], []]);
    });

    it("supports undo/redo of group and ungroup", () => {
      const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
      const rect2 = API.createElement({ type: "rectangle", id: "rect2" });
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionGroup);
      const groupId = getElement("rect1").groupIds[0];
      expect(h.elements.map((el) => el.groupIds)).toEqual([
        [groupId],
        [groupId],
      ]);

      API.executeAction(actionUngroup);
      expect(h.elements.map((el) => el.groupIds)).toEqual([[], []]);

      Keyboard.undo();
      expect(h.elements.map((el) => el.groupIds)).toEqual([
        [groupId],
        [groupId],
      ]);
      expect(h.state.selectedGroupIds).toEqual({ [groupId]: true });

      Keyboard.undo();
      expect(h.elements.map((el) => el.groupIds)).toEqual([[], []]);

      Keyboard.redo();
      expect(h.elements.map((el) => el.groupIds)).toEqual([
        [groupId],
        [groupId],
      ]);

      Keyboard.redo();
      expect(h.elements.map((el) => el.groupIds)).toEqual([[], []]);
    });
  });
});
