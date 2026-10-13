import { act, queryByTestId } from "@testing-library/react";
import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionSelectAllWithSameStrokeColor } from "./actionSelectAllWithSameStrokeColor";

const { h } = window;
const mouse = new Pointer("mouse");

const RED = "#e03131";
const BLUE = "#1971c2";

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds)
    .filter((id) => h.state.selectedElementIds[id])
    .sort();

describe("actionSelectAllWithSameStrokeColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every non-deleted element with the selected stroke color", () => {
    const rect = API.createElement({ id: "rect", strokeColor: RED });
    const ellipse = API.createElement({
      id: "ellipse",
      type: "ellipse",
      strokeColor: RED,
    });
    const arrow = API.createElement({
      id: "arrow",
      type: "arrow",
      strokeColor: RED,
    });
    const blue = API.createElement({ id: "blue", strokeColor: BLUE });
    const deleted = API.createElement({
      id: "deleted",
      strokeColor: RED,
      isDeleted: true,
    });
    API.setElements([rect, ellipse, arrow, blue, deleted]);
    API.setSelectedElements([rect]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(selectedIds()).toEqual(["arrow", "ellipse", "rect"]);
  });

  it("skips locked elements and text bound to a container", () => {
    const container = API.createElement({ id: "container", strokeColor: RED });
    const boundText = API.createElement({
      id: "boundText",
      type: "text",
      strokeColor: RED,
      containerId: container.id,
    });
    const locked = API.createElement({
      id: "locked",
      strokeColor: RED,
      locked: true,
    });
    const freeText = API.createElement({
      id: "freeText",
      type: "text",
      strokeColor: RED,
    });
    API.setElements([container, boundText, locked, freeText]);
    API.setSelectedElements([freeText]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(selectedIds()).toEqual(["container", "freeText"]);
  });

  it("matches every stroke color in a mixed selection", () => {
    const red = API.createElement({ id: "red", strokeColor: RED });
    const red2 = API.createElement({ id: "red2", strokeColor: RED });
    const blue = API.createElement({ id: "blue", strokeColor: BLUE });
    const blue2 = API.createElement({ id: "blue2", strokeColor: BLUE });
    const black = API.createElement({ id: "black", strokeColor: "#1e1e1e" });
    API.setElements([red, red2, blue, blue2, black]);
    API.setSelectedElements([red, blue]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(selectedIds()).toEqual(["blue", "blue2", "red", "red2"]);
  });

  it("keeps a matching frame but not its matching children", () => {
    const frame = API.createElement({
      id: "frame",
      type: "frame",
      strokeColor: RED,
    });
    const child = API.createElement({
      id: "child",
      strokeColor: RED,
      frameId: frame.id,
    });
    const outside = API.createElement({ id: "outside", strokeColor: RED });
    API.setElements([frame, child, outside]);
    API.setSelectedElements([outside]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(selectedIds()).toEqual(["frame", "outside"]);
  });

  it("selects whole groups containing a matching element", () => {
    const red = API.createElement({ id: "red", strokeColor: RED });
    const groupedRed = API.createElement({
      id: "groupedRed",
      strokeColor: RED,
      groupIds: ["g1"],
    });
    const groupedBlue = API.createElement({
      id: "groupedBlue",
      strokeColor: BLUE,
      groupIds: ["g1"],
    });
    API.setElements([red, groupedRed, groupedBlue]);
    API.setSelectedElements([red]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(h.state.selectedGroupIds).toEqual({ g1: true });
    expect(selectedIds()).toEqual(["groupedBlue", "groupedRed", "red"]);
  });

  it("is only available when something is selected", () => {
    const rect = API.createElement({ strokeColor: RED });
    API.setElements([rect]);

    expect(
      actionSelectAllWithSameStrokeColor.predicate!(h.elements, h.state),
    ).toBe(false);

    API.setSelectedElements([rect]);

    expect(
      actionSelectAllWithSameStrokeColor.predicate!(h.elements, h.state),
    ).toBe(true);
  });

  it("is listed in the element context menu and runs from it", () => {
    const rect = API.createElement({
      id: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      strokeColor: RED,
    });
    const other = API.createElement({
      id: "other",
      x: 300,
      y: 300,
      strokeColor: RED,
    });
    API.setElements([rect, other]);
    API.setSelectedElements([rect]);

    mouse.rightClickAt(50, 50);
    const item = queryByTestId(
      UI.queryContextMenu()!,
      "selectAllWithSameStrokeColor",
    );
    expect(item?.textContent).toContain("Select all with same stroke color");

    act(() => item!.click());

    expect(selectedIds()).toEqual(["other", "rect"]);
  });

  it("can be undone", () => {
    const rect = API.createElement({ id: "rect", strokeColor: RED });
    const other = API.createElement({ id: "other", strokeColor: RED });
    API.updateScene({
      elements: [rect, other],
      appState: { selectedElementIds: { [rect.id]: true } },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.executeAction(actionSelectAllWithSameStrokeColor);
    expect(selectedIds()).toEqual(["other", "rect"]);

    Keyboard.undo();
    expect(selectedIds()).toEqual(["rect"]);
  });
});
