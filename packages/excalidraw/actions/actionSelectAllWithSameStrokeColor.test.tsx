import { queryByTestId } from "@testing-library/react";
import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

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

  it("selects every element with the same stroke color", () => {
    const red1 = API.createElement({ id: "red1", strokeColor: RED });
    const red2 = API.createElement({
      id: "red2",
      type: "ellipse",
      strokeColor: RED,
    });
    const red3 = API.createElement({
      id: "red3",
      type: "arrow",
      strokeColor: RED,
    });
    const blue = API.createElement({ id: "blue", strokeColor: BLUE });
    API.setElements([red1, red2, red3, blue]);
    API.setSelectedElements([red1]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(selectedIds()).toEqual(["red1", "red2", "red3"]);
  });

  it("uses the stroke colors of all selected elements", () => {
    const red1 = API.createElement({ id: "red1", strokeColor: RED });
    const red2 = API.createElement({ id: "red2", strokeColor: RED });
    const blue1 = API.createElement({ id: "blue1", strokeColor: BLUE });
    const blue2 = API.createElement({ id: "blue2", strokeColor: BLUE });
    const black = API.createElement({ id: "black", strokeColor: "#1e1e1e" });
    API.setElements([red1, red2, blue1, blue2, black]);
    API.setSelectedElements([red1, blue1]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(selectedIds()).toEqual(["blue1", "blue2", "red1", "red2"]);
  });

  it("skips deleted, locked and container-bound text elements", () => {
    const red = API.createElement({ id: "red", strokeColor: RED });
    const deleted = API.createElement({
      id: "deleted",
      strokeColor: RED,
      isDeleted: true,
    });
    const locked = API.createElement({
      id: "locked",
      strokeColor: RED,
      locked: true,
    });
    const container = API.createElement({
      id: "container",
      strokeColor: RED,
      boundElements: [{ id: "boundText", type: "text" }],
    });
    const boundText = API.createElement({
      id: "boundText",
      type: "text",
      strokeColor: RED,
      containerId: "container",
    });
    API.setElements([red, deleted, locked, container, boundText]);
    API.setSelectedElements([red]);

    API.executeAction(actionSelectAllWithSameStrokeColor);

    expect(selectedIds()).toEqual(["container", "red"]);
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
    const red = API.createElement({ id: "red", strokeColor: RED });
    API.setElements([red]);

    expect(
      h.app.actionManager.isActionEnabled(actionSelectAllWithSameStrokeColor),
    ).toBe(false);

    API.setSelectedElements([red]);

    expect(
      h.app.actionManager.isActionEnabled(actionSelectAllWithSameStrokeColor),
    ).toBe(true);
  });

  it("shows in the element context menu with its label", () => {
    const red1 = API.createElement({
      id: "red1",
      strokeColor: RED,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const red2 = API.createElement({
      id: "red2",
      strokeColor: RED,
      x: 300,
      y: 300,
    });
    API.setElements([red1, red2]);
    API.setSelectedElements([red1]);

    mouse.rightClickAt(50, 50);

    const item = queryByTestId(
      UI.queryContextMenu()!,
      "selectAllWithSameStrokeColor",
    );
    expect(item).not.toBe(null);
    expect(item!.textContent).toContain("Select all with same stroke color");

    act(() => {
      item!.click();
    });

    expect(selectedIds()).toEqual(["red1", "red2"]);
  });

  it("is undoable", () => {
    const red1 = API.createElement({ id: "red1", strokeColor: RED });
    const red2 = API.createElement({ id: "red2", strokeColor: RED });
    API.updateScene({
      elements: [red1, red2],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { selectedElementIds: { [red1.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.executeAction(actionSelectAllWithSameStrokeColor);
    expect(selectedIds()).toEqual(["red1", "red2"]);

    Keyboard.undo();
    expect(selectedIds()).toEqual(["red1"]);

    Keyboard.redo();
    expect(selectedIds()).toEqual(["red1", "red2"]);
  });
});
