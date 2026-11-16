import { KEYS, reseed } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionGroup } from "./actionGroup";

const { h } = window;

const isGroupEnabled = () =>
  actionGroup.predicate!(h.elements, h.state, {}, h.app);

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const newGroupIdOf = (element: ExcalidrawElement) =>
  element.groupIds[element.groupIds.length - 1];

describe("actionGroup", () => {
  beforeEach(async () => {
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("predicate", () => {
    it("is disabled with fewer than two selected elements", () => {
      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle", x: 200 });
      API.setElements([rect1, rect2]);

      expect(isGroupEnabled()).toBe(false);

      API.setSelectedElements([rect1]);
      expect(isGroupEnabled()).toBe(false);
    });

    it("is enabled for two or more ungrouped elements", () => {
      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle", x: 200 });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(isGroupEnabled()).toBe(true);
    });

    it("is disabled when all selected elements already share a group", () => {
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        groupIds: ["A"],
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(isGroupEnabled()).toBe(false);
    });

    it("is enabled for members of the group being edited", () => {
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        groupIds: ["A"],
      });
      const rect3 = API.createElement({
        type: "rectangle",
        x: 400,
        groupIds: ["A"],
      });
      API.setElements([rect1, rect2, rect3]);
      API.setSelectedElements([rect1, rect2], "A");

      expect(h.state.editingGroupId).toBe("A");
      expect(isGroupEnabled()).toBe(true);
    });

    it("is disabled for a single container with bound text", () => {
      const container = API.createElement({ type: "rectangle" });
      const text = API.createElement({
        type: "text",
        containerId: container.id,
      });
      API.setElements([
        { ...container, boundElements: [{ id: text.id, type: "text" }] },
        text,
      ]);
      API.setSelectedElements([container]);

      expect(isGroupEnabled()).toBe(false);
    });

    it("is disabled when a frame and one of its children are selected together", () => {
      const frame = API.createElement({
        type: "frame",
        width: 300,
        height: 300,
      });
      const child = API.createElement({
        type: "rectangle",
        x: 10,
        y: 10,
        frameId: frame.id,
      });
      API.setElements([frame, child]);
      API.setSelectedElements([frame, child]);

      expect(isGroupEnabled()).toBe(false);
    });
  });

  describe("keyTest", () => {
    it("matches CtrlOrCmd+G only", () => {
      const keyTest = (init: KeyboardEventInit) =>
        actionGroup.keyTest!(new KeyboardEvent("keydown", init));

      expect(keyTest({ key: KEYS.G, ctrlKey: true })).toBe(true);
      expect(keyTest({ key: KEYS.G })).toBe(false);
      expect(
        keyTest({ key: KEYS.G.toUpperCase(), ctrlKey: true, shiftKey: true }),
      ).toBe(false);
      expect(keyTest({ key: KEYS.H, ctrlKey: true })).toBe(false);
    });

    it("groups the selection when pressing Ctrl+G", () => {
      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle", x: 200 });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.G);
      });

      expect(h.elements[0].groupIds).toHaveLength(1);
      expect(h.elements[1].groupIds).toEqual(h.elements[0].groupIds);
    });
  });

  describe("perform", () => {
    it("assigns a shared new group id and selects the new group", () => {
      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle", x: 200 });
      const other = API.createElement({ type: "rectangle", x: 400 });
      API.setElements([rect1, rect2, other]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionGroup);

      const [groupId] = getElement(rect1.id).groupIds;
      expect(groupId).toEqual(expect.any(String));
      expect(getElement(rect2.id).groupIds).toEqual([groupId]);
      expect(getElement(other.id).groupIds).toEqual([]);
      expect(h.state.selectedGroupIds).toEqual({ [groupId]: true });
      expect(h.state.selectedElementIds).toEqual({
        [rect1.id]: true,
        [rect2.id]: true,
      });
    });

    it("nests an existing group inside the new outer group", () => {
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 100,
        groupIds: ["A"],
      });
      const rect3 = API.createElement({ type: "rectangle", x: 300 });
      API.setElements([rect1, rect2, rect3]);
      API.setSelectedElements([rect1, rect2, rect3]);

      API.executeAction(actionGroup);

      const newGroupId = newGroupIdOf(getElement(rect3.id));
      expect(newGroupId).not.toBe("A");
      expect(getElement(rect1.id).groupIds).toEqual(["A", newGroupId]);
      expect(getElement(rect2.id).groupIds).toEqual(["A", newGroupId]);
      expect(getElement(rect3.id).groupIds).toEqual([newGroupId]);
      expect(h.state.selectedGroupIds).toEqual({ [newGroupId]: true });
    });

    it("inserts the new group inside the group being edited", () => {
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        groupIds: ["A"],
      });
      const rect3 = API.createElement({
        type: "rectangle",
        x: 400,
        groupIds: ["A"],
      });
      API.setElements([rect1, rect2, rect3]);
      API.setSelectedElements([rect1, rect2], "A");

      API.executeAction(actionGroup);

      const newGroupId = getElement(rect1.id).groupIds[0];
      expect(newGroupId).not.toBe("A");
      expect(getElement(rect1.id).groupIds).toEqual([newGroupId, "A"]);
      expect(getElement(rect2.id).groupIds).toEqual([newGroupId, "A"]);
      expect(getElement(rect3.id).groupIds).toEqual(["A"]);
    });

    it("adds a container's bound text to the new group", () => {
      const container = API.createElement({ type: "rectangle" });
      const text = API.createElement({
        type: "text",
        containerId: container.id,
      });
      const rect = API.createElement({ type: "rectangle", x: 300 });
      API.setElements([
        { ...container, boundElements: [{ id: text.id, type: "text" }] },
        text,
        rect,
      ]);
      API.setSelectedElements([container, rect]);

      API.executeAction(actionGroup);

      const groupIds = getElement(rect.id).groupIds;
      expect(groupIds).toHaveLength(1);
      expect(getElement(container.id).groupIds).toEqual(groupIds);
      expect(getElement(text.id).groupIds).toEqual(groupIds);
    });

    it("removes elements from their frame when grouping across frames", () => {
      const frame = API.createElement({
        type: "frame",
        width: 300,
        height: 300,
      });
      const inFrame = API.createElement({
        type: "rectangle",
        x: 10,
        y: 10,
        frameId: frame.id,
      });
      const outside = API.createElement({ type: "rectangle", x: 500 });
      API.setElements([frame, inFrame, outside]);
      API.setSelectedElements([inFrame, outside]);

      API.executeAction(actionGroup);

      expect(getElement(inFrame.id).frameId).toBe(null);
      expect(getElement(inFrame.id).groupIds).toHaveLength(1);
      expect(getElement(outside.id).groupIds).toEqual(
        getElement(inFrame.id).groupIds,
      );
    });

    it("keeps frame membership when all grouped elements share a frame", () => {
      const frame = API.createElement({
        type: "frame",
        width: 300,
        height: 300,
      });
      const rect1 = API.createElement({
        type: "rectangle",
        x: 10,
        y: 10,
        frameId: frame.id,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 150,
        y: 150,
        width: 50,
        height: 50,
        frameId: frame.id,
      });
      API.setElements([frame, rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionGroup);

      expect(getElement(rect1.id).frameId).toBe(frame.id);
      expect(getElement(rect2.id).frameId).toBe(frame.id);
      expect(getElement(rect1.id).groupIds).toHaveLength(1);
    });

    it("does nothing when the action is disabled", () => {
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        groupIds: ["A"],
      });
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([rect1, rect2]);
      const elementsBefore = h.elements;

      API.executeAction(actionGroup);

      expect(h.elements).toBe(elementsBefore);
      expect(h.history.isUndoStackEmpty).toBe(true);
    });
  });

  describe("history", () => {
    it("records one undo entry; undo restores and redo reapplies the group", () => {
      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle", x: 200 });
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionGroup);

      expect(h.history.undoStack).toHaveLength(1);
      const groupIds = getElement(rect1.id).groupIds;
      expect(groupIds).toHaveLength(1);

      Keyboard.undo();
      expect(getElement(rect1.id).groupIds).toEqual([]);
      expect(getElement(rect2.id).groupIds).toEqual([]);
      expect(getElement(rect1.id).isDeleted).toBe(false);

      Keyboard.redo();
      expect(getElement(rect1.id).groupIds).toEqual(groupIds);
      expect(getElement(rect2.id).groupIds).toEqual(groupIds);
    });
  });

  describe("PanelComponent", () => {
    const queryGroupButton = () =>
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Group selection"]',
      );

    it("is hidden when grouping is not possible and shown when it is", () => {
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        groupIds: ["A"],
      });
      const rect3 = API.createElement({ type: "rectangle", x: 400 });
      API.setElements([rect1, rect2, rect3]);

      API.setSelectedElements([rect1, rect2]);
      expect(queryGroupButton()).not.toBe(null);
      expect(queryGroupButton()!.hidden).toBe(true);

      API.setSelectedElements([rect1, rect2, rect3]);
      expect(queryGroupButton()!.hidden).toBe(false);
    });
  });
});
