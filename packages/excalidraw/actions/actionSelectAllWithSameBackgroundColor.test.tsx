import { fireEvent, queryByTestId } from "@testing-library/react";
import React from "react";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionSelectAllWithSameBackgroundColor } from "./actionSelectAllWithSameBackgroundColor";

const { h } = window;
const mouse = new Pointer("mouse");

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds)
    .filter((id) => h.state.selectedElementIds[id])
    .sort();

describe("actionSelectAllWithSameBackgroundColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects elements with matching background color only", () => {
    const red1 = API.createElement({ id: "red1", backgroundColor: "#ff0000" });
    const red2 = API.createElement({
      id: "red2",
      type: "ellipse",
      backgroundColor: "#ff0000",
    });
    const blue = API.createElement({ id: "blue", backgroundColor: "#0000ff" });
    API.setElements([red1, red2, blue]);
    API.setSelectedElements([red1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["red1", "red2"]);
  });

  it("matches any background color in a multi-element selection", () => {
    const red = API.createElement({ id: "red", backgroundColor: "#ff0000" });
    const red2 = API.createElement({ id: "red2", backgroundColor: "#ff0000" });
    const blue = API.createElement({ id: "blue", backgroundColor: "#0000ff" });
    const blue2 = API.createElement({
      id: "blue2",
      backgroundColor: "#0000ff",
    });
    const green = API.createElement({
      id: "green",
      backgroundColor: "#00ff00",
    });
    API.setElements([red, red2, blue, blue2, green]);
    API.setSelectedElements([red, blue]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["blue", "blue2", "red", "red2"]);
  });

  it("matches transparent backgrounds", () => {
    const t1 = API.createElement({ id: "t1", backgroundColor: "transparent" });
    const t2 = API.createElement({ id: "t2", backgroundColor: "transparent" });
    const red = API.createElement({ id: "red", backgroundColor: "#ff0000" });
    API.setElements([t1, t2, red]);
    API.setSelectedElements([t1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["t1", "t2"]);
  });

  it("skips locked, deleted and container-bound text elements", () => {
    const red = API.createElement({ id: "red", backgroundColor: "#ff0000" });
    const locked = API.createElement({
      id: "locked",
      backgroundColor: "#ff0000",
      locked: true,
    });
    const deleted = API.createElement({
      id: "deleted",
      backgroundColor: "#ff0000",
      isDeleted: true,
    });
    const container = API.createElement({
      id: "container",
      backgroundColor: "#ff0000",
    });
    const boundText = API.createElement({
      id: "boundText",
      type: "text",
      backgroundColor: "#ff0000",
      containerId: container.id,
    });
    API.setElements([red, locked, deleted, container, boundText]);
    API.setSelectedElements([red]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["container", "red"]);
  });

  it("expands groups like Select All", () => {
    const a = API.createElement({
      id: "a",
      backgroundColor: "#ff0000",
      groupIds: ["g1"],
    });
    const b = API.createElement({
      id: "b",
      backgroundColor: "#ff0000",
      groupIds: ["g1"],
    });
    API.setElements([a, b]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["a", "b"]);
    expect(h.state.selectedGroupIds).toEqual({ g1: true });
  });

  it("is hidden from the context menu when nothing is selected", () => {
    API.setElements([API.createElement({ backgroundColor: "#ff0000" })]);
    API.setSelectedElements([]);

    mouse.rightClickAt(500, 500);

    expect(
      queryByTestId(UI.queryContextMenu()!, "selectAllWithSameBackgroundColor"),
    ).toBe(null);
  });

  it("is shown in the context menu and selects matches when clicked", () => {
    const red1 = API.createElement({
      id: "red1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ff0000",
      fillStyle: "solid",
    });
    const red2 = API.createElement({
      id: "red2",
      x: 300,
      y: 300,
      backgroundColor: "#ff0000",
    });
    API.setElements([red1, red2]);
    API.setSelectedElements([red1]);

    mouse.rightClickAt(50, 50);
    const item = queryByTestId(
      UI.queryContextMenu()!,
      "selectAllWithSameBackgroundColor",
    );
    expect(item).not.toBe(null);
    expect(item?.textContent).toContain(
      "Select all with same background color",
    );
    fireEvent.click(item!.querySelector("button")!);

    expect(selectedIds()).toEqual(["red1", "red2"]);
  });

  it("is undoable", () => {
    const red1 = API.createElement({ id: "red1", backgroundColor: "#ff0000" });
    const red2 = API.createElement({ id: "red2", backgroundColor: "#ff0000" });
    API.setElements([red1, red2]);
    API.setSelectedElements([red1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);
    expect(selectedIds()).toEqual(["red1", "red2"]);

    Keyboard.undo();
    expect(selectedIds()).not.toEqual(["red1", "red2"]);
    Keyboard.redo();
    expect(selectedIds()).toEqual(["red1", "red2"]);
  });
});
