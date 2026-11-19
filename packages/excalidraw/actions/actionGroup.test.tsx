import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionGroup, actionUngroup } from "./actionGroup";

const { h } = window;

const keyEvent = (opts: Partial<KeyboardEvent>) =>
  new KeyboardEvent("keydown", opts);

const groupIdsOf = (id: string) =>
  h.elements.find((element) => element.id === id)!.groupIds;

const groupPredicate = () =>
  actionGroup.predicate!(h.elements, h.state, h.app.props, h.app);

const ungroupPredicate = () => actionUngroup.predicate!(h.elements, h.state);

const createRects = (...ids: string[]) =>
  ids.map((id, index) =>
    API.createElement({ type: "rectangle", id, x: index * 150, y: 0 }),
  );

const selectedIds = () => Object.keys(h.state.selectedElementIds).sort();

describe("actionGroup / actionUngroup", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("keyTest", () => {
    it("group matches only Ctrl+G without shift", () => {
      expect(
        actionGroup.keyTest!(keyEvent({ ctrlKey: true, key: KEYS.G })),
      ).toBe(true);
      expect(
        actionGroup.keyTest!(
          keyEvent({ ctrlKey: true, shiftKey: true, key: KEYS.G }),
        ),
      ).toBe(false);
      expect(actionGroup.keyTest!(keyEvent({ key: KEYS.G }))).toBeFalsy();
      expect(
        actionGroup.keyTest!(keyEvent({ ctrlKey: true, key: KEYS.A })),
      ).toBe(false);
    });

    it("ungroup matches only Ctrl+Shift+G (uppercase key)", () => {
      expect(
        actionUngroup.keyTest!(
          keyEvent({
            ctrlKey: true,
            shiftKey: true,
            key: KEYS.G.toUpperCase(),
          }),
        ),
      ).toBe(true);
      expect(
        actionUngroup.keyTest!(
          keyEvent({ ctrlKey: true, key: KEYS.G.toUpperCase() }),
        ),
      ).toBe(false);
      expect(
        actionUngroup.keyTest!(
          keyEvent({ shiftKey: true, key: KEYS.G.toUpperCase() }),
        ),
      ).toBeFalsy();
    });
  });

  describe("predicate", () => {
    it("group is enabled only for 2+ selected elements not already in one group", () => {
      const [a, b, c] = createRects("a", "b", "c");
      API.setElements([a, b, c]);

      expect(groupPredicate()).toBe(false);

      API.setSelectedElements([a]);
      expect(groupPredicate()).toBe(false);

      API.setSelectedElements([a, b]);
      expect(groupPredicate()).toBe(true);

      API.executeAction(actionGroup);
      expect(groupPredicate()).toBe(false);

      // adding an ungrouped element re-enables grouping
      API.setSelectedElements([API.getElement(a), API.getElement(b), c]);
      expect(groupPredicate()).toBe(true);
    });

    it("group is disabled when a frame and its children are selected together", () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
        height: 500,
      });
      const child = API.createElement({
        type: "rectangle",
        id: "child",
        x: 10,
        frameId: frame.id,
      });
      API.setElements([child, frame]);
      API.setSelectedElements([child, frame]);

      expect(groupPredicate()).toBe(false);

      API.executeAction(actionGroup);
      expect(groupIdsOf("child")).toEqual([]);
      expect(groupIdsOf("frame")).toEqual([]);
    });

    it("ungroup is enabled only when a group is selected", () => {
      const [a, b] = createRects("a", "b");
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);
      expect(ungroupPredicate()).toBe(false);

      API.executeAction(actionGroup);
      expect(ungroupPredicate()).toBe(true);

      API.executeAction(actionUngroup);
      expect(ungroupPredicate()).toBe(false);
    });
  });

  describe("group perform", () => {
    it("adds one shared group id and selects the new group", () => {
      const [a, b, c] = createRects("a", "b", "c");
      API.setElements([a, b, c]);
      API.setSelectedElements([a, b]);

      API.executeAction(actionGroup);

      const groupIds = groupIdsOf("a");
      expect(groupIds).toHaveLength(1);
      expect(groupIdsOf("b")).toEqual(groupIds);
      expect(groupIdsOf("c")).toEqual([]);
      expect(h.state.selectedGroupIds).toEqual({ [groupIds[0]]: true });
      expect(selectedIds()).toEqual(["a", "b"]);
    });

    it("does nothing with a single selected element", () => {
      const [a, b] = createRects("a", "b");
      API.setElements([a, b]);
      API.setSelectedElements([a]);
      const before = h.elements;

      API.executeAction(actionGroup);

      expect(h.elements).toEqual(before);
      expect(groupIdsOf("a")).toEqual([]);
      expect(h.state.selectedGroupIds).toEqual({});
    });

    it("nests an existing group inside the new outer group", () => {
      const [a, b, c] = createRects("a", "b", "c");
      API.setElements([a, b, c]);
      API.setSelectedElements([a, b]);
      API.executeAction(actionGroup);
      const innerId = groupIdsOf("a")[0];

      API.setSelectedElements([API.getElement(a), API.getElement(b), c]);
      API.executeAction(actionGroup);

      const outerId = groupIdsOf("c")[0];
      expect(outerId).not.toBe(innerId);
      expect(groupIdsOf("a")).toEqual([innerId, outerId]);
      expect(groupIdsOf("b")).toEqual([innerId, outerId]);
      expect(groupIdsOf("c")).toEqual([outerId]);
      expect(h.state.selectedGroupIds).toEqual({ [outerId]: true });
    });

    it("moves grouped elements next to the topmost member, keeping relative order", () => {
      const [a, x, b, y] = createRects("a", "x", "b", "y");
      API.setElements([a, x, b, y]);
      API.setSelectedElements([a, b]);

      API.executeAction(actionGroup);

      expect(h.elements.map((element) => element.id)).toEqual([
        "x",
        "a",
        "b",
        "y",
      ]);
      const indices = h.elements.map((element) => element.index!);
      expect([...indices].sort()).toEqual(indices);
    });

    it("adds bound text to the group together with its container", () => {
      const [container, text] = API.createTextContainer();
      const other = API.createElement({
        type: "rectangle",
        id: "other",
        x: 300,
      });
      API.setElements([container, text, other]);
      API.setSelectedElements([container, other]);

      API.executeAction(actionGroup);

      const groupIds = groupIdsOf(container.id);
      expect(groupIds).toHaveLength(1);
      expect(groupIdsOf(text.id)).toEqual(groupIds);
      expect(groupIdsOf("other")).toEqual(groupIds);
    });

    it("removes elements from their frame when grouping across frames", () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 200,
        height: 200,
      });
      const inside = API.createElement({
        type: "rectangle",
        id: "inside",
        x: 10,
        frameId: frame.id,
      });
      const outside = API.createElement({
        type: "rectangle",
        id: "outside",
        x: 500,
      });
      API.setElements([inside, frame, outside]);
      API.setSelectedElements([inside, outside]);

      API.executeAction(actionGroup);

      const byId = (id: string) =>
        h.elements.find((element) => element.id === id)!;
      expect(byId("inside").frameId).toBe(null);
      expect(byId("outside").frameId).toBe(null);
      expect(byId("inside").groupIds).toHaveLength(1);
      expect(byId("inside").groupIds).toEqual(byId("outside").groupIds);
      expect(byId("frame").groupIds).toEqual([]);
    });

    it("keeps frameId when grouping elements of the same frame", () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
        height: 500,
      });
      const one = API.createElement({
        type: "rectangle",
        id: "one",
        x: 10,
        frameId: frame.id,
      });
      const two = API.createElement({
        type: "rectangle",
        id: "two",
        x: 200,
        frameId: frame.id,
      });
      API.setElements([one, two, frame]);
      API.setSelectedElements([one, two]);

      API.executeAction(actionGroup);

      const frameIds = h.elements
        .filter((element) => element.type !== "frame")
        .map((element) => element.frameId);
      expect(frameIds).toEqual([frame.id, frame.id]);
      expect(groupIdsOf("one")).toHaveLength(1);
      expect(groupIdsOf("two")).toEqual(groupIdsOf("one"));
    });
  });

  describe("ungroup perform", () => {
    it("removes the selected group and keeps the members selected", () => {
      const [a, b, c] = createRects("a", "b", "c");
      API.setElements([a, b, c]);
      API.setSelectedElements([a, b]);
      API.executeAction(actionGroup);

      API.executeAction(actionUngroup);

      expect(groupIdsOf("a")).toEqual([]);
      expect(groupIdsOf("b")).toEqual([]);
      expect(h.state.selectedGroupIds).toEqual({});
      expect(selectedIds()).toEqual(["a", "b"]);
    });

    it("removes only the outermost selected group of a nested group", () => {
      const elements = [
        API.createElement({ id: "a", groupIds: ["inner", "outer"] }),
        API.createElement({ id: "b", x: 150, groupIds: ["inner", "outer"] }),
        API.createElement({ id: "c", x: 300, groupIds: ["outer"] }),
        API.createElement({ id: "d", x: 450, groupIds: ["other"] }),
      ];
      API.setElements(elements);
      API.setSelectedElements(elements.slice(0, 3));
      expect(h.state.selectedGroupIds).toEqual({ outer: true });

      API.executeAction(actionUngroup);

      expect(groupIdsOf("a")).toEqual(["inner"]);
      expect(groupIdsOf("b")).toEqual(["inner"]);
      expect(groupIdsOf("c")).toEqual([]);
      expect(groupIdsOf("d")).toEqual(["other"]);
      expect(h.state.selectedGroupIds).toEqual({ inner: true });
      expect(selectedIds()).toEqual(["a", "b", "c"]);
    });

    it("does nothing when no group is selected", () => {
      const [a, b] = createRects("a", "b");
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);
      const before = h.elements;

      API.executeAction(actionUngroup);

      expect(h.elements).toEqual(before);
      expect(selectedIds()).toEqual(["a", "b"]);
    });

    it("ungroups bound text with its container and drops it from the selection", () => {
      const [container, text] = API.createTextContainer({ groupIds: ["g"] });
      const other = API.createElement({
        type: "rectangle",
        id: "other",
        x: 300,
        groupIds: ["g"],
      });
      API.setElements([container, text, other]);
      API.setSelectedElements([container, text, other]);
      expect(h.state.selectedGroupIds).toEqual({ g: true });

      API.executeAction(actionUngroup);

      expect(groupIdsOf(container.id)).toEqual([]);
      expect(groupIdsOf(text.id)).toEqual([]);
      expect(groupIdsOf("other")).toEqual([]);
      expect(selectedIds()).toEqual([container.id, "other"].sort());
    });
  });

  describe("keyboard shortcuts", () => {
    it("Ctrl+G groups and Ctrl+Shift+G ungroups the selection", () => {
      const [a, b] = createRects("a", "b");
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.G);
      });
      expect(groupIdsOf("a")).toHaveLength(1);
      expect(groupIdsOf("b")).toEqual(groupIdsOf("a"));

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyPress(KEYS.G.toUpperCase());
      });
      expect(groupIdsOf("a")).toEqual([]);
      expect(groupIdsOf("b")).toEqual([]);
    });
  });

  describe("history", () => {
    it("records one undo entry per group/ungroup; undo restores and redo reapplies", () => {
      const [a, b] = createRects("a", "b");
      API.updateScene({
        elements: [a, b],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([a, b]);
      const undoBefore = API.getUndoStack().length;

      API.executeAction(actionGroup);
      const groupIds = groupIdsOf("a");
      expect(groupIds).toHaveLength(1);
      expect(API.getUndoStack().length).toBe(undoBefore + 1);

      API.executeAction(actionUngroup);
      expect(API.getUndoStack().length).toBe(undoBefore + 2);
      expect(groupIdsOf("a")).toEqual([]);

      act(() => {
        Keyboard.undo();
      });
      expect(groupIdsOf("a")).toEqual(groupIds);
      expect(groupIdsOf("b")).toEqual(groupIds);
      expect(h.elements.every((element) => !element.isDeleted)).toBe(true);

      act(() => {
        Keyboard.undo();
      });
      expect(groupIdsOf("a")).toEqual([]);
      expect(groupIdsOf("b")).toEqual([]);
      expect(h.elements.every((element) => !element.isDeleted)).toBe(true);

      act(() => {
        Keyboard.redo();
      });
      expect(groupIdsOf("a")).toEqual(groupIds);
      expect(groupIdsOf("b")).toEqual(groupIds);
      expect(API.getRedoStack().length).toBe(1);
    });
  });
});
