import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionInvertSelection } from "./actionInvertSelection";

const { h } = window;
const mouse = new Pointer("mouse");

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds)
    .filter((id) => h.state.selectedElementIds[id])
    .sort();

const isApplicable = () =>
  actionInvertSelection.predicate!(
    h.elements,
    h.state,
    h.app.props,
    h.app as any,
  );

describe("actionInvertSelection", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects unselected elements and deselects selected ones", () => {
    const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
    const rect2 = API.createElement({ type: "rectangle", id: "rect2" });
    const ellipse = API.createElement({ type: "ellipse", id: "ellipse" });
    API.setElements([rect1, rect2, ellipse]);
    API.setSelectedElements([rect1]);

    API.executeAction(actionInvertSelection);

    expect(selectedIds()).toEqual(["ellipse", "rect2"]);
  });

  it("deselects everything when all elements are selected", () => {
    const rect1 = API.createElement({ type: "rectangle", id: "rect1" });
    const rect2 = API.createElement({ type: "rectangle", id: "rect2" });
    API.setElements([rect1, rect2]);
    API.setSelectedElements([rect1, rect2]);

    API.executeAction(actionInvertSelection);

    expect(selectedIds()).toEqual([]);
  });

  it("treats a selected group member as the whole group and fully selects unselected groups", () => {
    const a1 = API.createElement({ id: "a1", groupIds: ["groupA"] });
    const a2 = API.createElement({ id: "a2", groupIds: ["groupA"] });
    const b1 = API.createElement({ id: "b1", groupIds: ["groupB"] });
    const b2 = API.createElement({ id: "b2", groupIds: ["groupB"] });
    const loose = API.createElement({ id: "loose" });
    API.setElements([a1, a2, b1, b2, loose]);
    // select a single member while editing its group
    API.setSelectedElements([a1], "groupA");

    API.executeAction(actionInvertSelection);

    expect(selectedIds()).toEqual(["b1", "b2", "loose"]);
    expect(h.state.selectedGroupIds).toEqual({ groupB: true });
    expect(h.state.editingGroupId).toBe(null);
  });

  it("excludes the whole outermost group of a selected nested group member", () => {
    const inner = API.createElement({ id: "inner", groupIds: ["g1", "g2"] });
    const outer = API.createElement({ id: "outer", groupIds: ["g2"] });
    const loose = API.createElement({ id: "loose" });
    API.setElements([inner, outer, loose]);
    API.setSelectedElements([inner], "g1");

    API.executeAction(actionInvertSelection);

    expect(selectedIds()).toEqual(["loose"]);
  });

  it("never selects locked or deleted elements", () => {
    const selected = API.createElement({ id: "selected" });
    const locked = API.createElement({ id: "locked", locked: true });
    const deleted = API.createElement({ id: "deleted", isDeleted: true });
    const free = API.createElement({ id: "free" });
    API.setElements([selected, locked, deleted, free]);
    API.setSelectedElements([selected]);

    API.executeAction(actionInvertSelection);

    expect(selectedIds()).toEqual(["free"]);
  });

  it("never selects a locked member of an unselected group", () => {
    const selected = API.createElement({ id: "selected" });
    const lockedMember = API.createElement({
      id: "lockedMember",
      groupIds: ["group"],
      locked: true,
    });
    const freeMember = API.createElement({
      id: "freeMember",
      groupIds: ["group"],
    });
    API.setElements([selected, lockedMember, freeMember]);
    API.setSelectedElements([selected]);

    API.executeAction(actionInvertSelection);

    expect(selectedIds()).toEqual(["freeMember"]);
  });

  it("does not select bound text directly; it follows its container", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      boundElements: [{ type: "text", id: "boundText" }],
    });
    const boundText = API.createElement({
      type: "text",
      id: "boundText",
      containerId: "container",
    });
    const other = API.createElement({ id: "other" });
    API.setElements([container, boundText, other]);

    API.setSelectedElements([other]);
    API.executeAction(actionInvertSelection);
    expect(selectedIds()).toEqual(["container"]);

    API.executeAction(actionInvertSelection);
    expect(selectedIds()).toEqual(["other"]);
  });

  it("creates a linear editor for the selected element when it is a single line", () => {
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    const line = API.createElement({ type: "line", id: "line" });
    API.setElements([rect, line]);
    API.setSelectedElements([rect]);

    API.executeAction(actionInvertSelection);

    expect(selectedIds()).toEqual(["line"]);
    expect(h.state.selectedLinearElement?.elementId).toBe("line");
  });

  it("is undoable", () => {
    const rect1 = API.createElement({ id: "rect1", x: 0, y: 0 });
    const rect2 = API.createElement({ id: "rect2", x: 300, y: 300 });
    API.updateScene({
      elements: [rect1, rect2],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    mouse.clickOn(rect1);
    expect(selectedIds()).toEqual(["rect1"]);

    API.executeAction(actionInvertSelection);
    expect(selectedIds()).toEqual(["rect2"]);

    act(() => {
      Keyboard.undo();
    });
    expect(selectedIds()).toEqual(["rect1"]);
  });

  describe("predicate", () => {
    it("is false when nothing is selected", () => {
      API.setElements([API.createElement({ id: "rect" })]);
      expect(isApplicable()).toBe(false);
    });

    it("is true when something is selected", () => {
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);
      expect(isApplicable()).toBe(true);
    });

    it("hides the item from the canvas context menu when nothing is selected", () => {
      API.setElements([API.createElement({ id: "rect", x: 0, y: 0 })]);
      mouse.rightClickAt(500, 500);
      const contextMenu = UI.queryContextMenu();
      expect(contextMenu).not.toBeNull();
      expect(
        contextMenu?.querySelector('li[data-testid="invertSelection"]'),
      ).toBeNull();
    });

    it("shows the item in the canvas context menu when something is selected", () => {
      const rect = API.createElement({
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);
      mouse.rightClickAt(500, 500);
      const contextMenu = UI.queryContextMenu();
      expect(
        contextMenu?.querySelector('li[data-testid="invertSelection"]'),
      ).not.toBeNull();
    });

    it("shows the item in the element context menu", () => {
      const rect = API.createElement({
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);
      mouse.rightClickAt(50, 50);
      const contextMenu = UI.queryContextMenu();
      expect(
        contextMenu?.querySelector('li[data-testid="invertSelection"]'),
      ).not.toBeNull();
    });
  });
});
