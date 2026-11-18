import { fireEvent, queryByTestId } from "@testing-library/react";
import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionSelectAllWithSameBackgroundColor } from "./actionSelectAllWithSameBackgroundColor";

const { h } = window;
const mouse = new Pointer("mouse");

const RED = "#ffc9c9";
const BLUE = "#a5d8ff";

const selectedIds = () => Object.keys(h.state.selectedElementIds).sort();

describe("actionSelectAllWithSameBackgroundColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects elements with the same background color and skips other colors", () => {
    const r1 = API.createElement({ id: "r1", backgroundColor: RED });
    const r2 = API.createElement({
      id: "r2",
      type: "ellipse",
      x: 200,
      backgroundColor: RED,
    });
    const b1 = API.createElement({ id: "b1", x: 400, backgroundColor: BLUE });
    const t1 = API.createElement({
      id: "t1",
      x: 600,
      backgroundColor: "transparent",
    });
    API.setElements([r1, r2, b1, t1]);
    API.setSelectedElements([r1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["r1", "r2"]);
  });

  it("matches any background color in a mixed selection, including transparent", () => {
    const r1 = API.createElement({ id: "r1", backgroundColor: RED });
    const r2 = API.createElement({ id: "r2", x: 200, backgroundColor: RED });
    const b1 = API.createElement({ id: "b1", x: 400, backgroundColor: BLUE });
    const t1 = API.createElement({
      id: "t1",
      x: 600,
      backgroundColor: "transparent",
    });
    const t2 = API.createElement({
      id: "t2",
      x: 800,
      backgroundColor: "transparent",
    });
    API.setElements([r1, r2, b1, t1, t2]);
    API.setSelectedElements([r1, t1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["r1", "r2", "t1", "t2"]);
  });

  it("skips locked and deleted elements", () => {
    const r1 = API.createElement({ id: "r1", backgroundColor: RED });
    const locked = API.createElement({
      id: "locked",
      x: 200,
      backgroundColor: RED,
      locked: true,
    });
    const deleted = API.createElement({
      id: "deleted",
      x: 400,
      backgroundColor: RED,
      isDeleted: true,
    });
    API.setElements([r1, locked, deleted]);
    API.setSelectedElements([r1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["r1"]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      id: "container",
      backgroundColor: "transparent",
      boundElements: [{ id: "text", type: "text" }],
    });
    const text = API.createElement({
      id: "text",
      type: "text",
      text: "hi",
      containerId: "container",
      backgroundColor: "transparent",
    });
    const other = API.createElement({
      id: "other",
      x: 300,
      backgroundColor: "transparent",
    });
    API.setElements([container, text, other]);
    API.setSelectedElements([other]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["container", "other"]);
  });

  it("expands groups like Select All", () => {
    const r1 = API.createElement({ id: "r1", backgroundColor: RED });
    const g1 = API.createElement({
      id: "g1",
      x: 200,
      backgroundColor: RED,
      groupIds: ["g"],
    });
    const g2 = API.createElement({
      id: "g2",
      x: 400,
      backgroundColor: RED,
      groupIds: ["g"],
    });
    API.setElements([r1, g1, g2]);
    API.setSelectedElements([r1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["g1", "g2", "r1"]);
    expect(h.state.selectedGroupIds).toEqual({ g: true });
  });

  it("is only available when something is selected", () => {
    const r1 = API.createElement({ id: "r1", backgroundColor: RED });
    API.setElements([r1]);

    expect(
      actionSelectAllWithSameBackgroundColor.predicate!(
        h.elements,
        h.state,
        h.app.props,
        h.app,
      ),
    ).toBe(false);

    API.setSelectedElements([r1]);

    expect(
      actionSelectAllWithSameBackgroundColor.predicate!(
        h.elements,
        h.state,
        h.app.props,
        h.app,
      ),
    ).toBe(true);
  });

  it("shows the context menu item only with a selection and runs it", () => {
    const r1 = API.createElement({
      id: "r1",
      width: 100,
      height: 100,
      backgroundColor: RED,
    });
    const r2 = API.createElement({
      id: "r2",
      x: 300,
      backgroundColor: RED,
    });
    API.setElements([r1, r2]);

    mouse.rightClickAt(500, 500);
    expect(
      queryByTestId(UI.queryContextMenu()!, "selectAllWithSameBackgroundColor"),
    ).toBe(null);

    API.setSelectedElements([r1]);
    mouse.rightClickAt(50, 50);
    const item = queryByTestId(
      UI.queryContextMenu()!,
      "selectAllWithSameBackgroundColor",
    );
    expect(item).not.toBe(null);
    expect(item!.textContent).toContain(
      "Select all with same background color",
    );

    fireEvent.click(item!.querySelector("button")!);
    expect(selectedIds()).toEqual(["r1", "r2"]);
  });

  it("is undoable", () => {
    const r1 = API.createElement({ id: "r1", backgroundColor: RED });
    const r2 = API.createElement({ id: "r2", x: 200, backgroundColor: RED });
    API.updateScene({
      elements: [r1, r2],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { ...h.state, selectedElementIds: { r1: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.executeAction(actionSelectAllWithSameBackgroundColor);
    expect(selectedIds()).toEqual(["r1", "r2"]);

    Keyboard.undo();
    expect(selectedIds()).toEqual(["r1"]);

    Keyboard.redo();
    expect(selectedIds()).toEqual(["r1", "r2"]);
  });
});
