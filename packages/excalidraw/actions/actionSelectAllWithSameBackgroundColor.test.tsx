import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render } from "../tests/test-utils";

import { actionSelectAllWithSameBackgroundColor } from "./actionSelectAllWithSameBackgroundColor";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds)
    .filter((id) => h.state.selectedElementIds[id])
    .sort();

describe("actionSelectAllWithSameBackgroundColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every element with a matching background color and skips other colors", () => {
    const red1 = API.createElement({ id: "red1", backgroundColor: "#ffc9c9" });
    const red2 = API.createElement({
      id: "red2",
      type: "ellipse",
      backgroundColor: "#ffc9c9",
    });
    const blue = API.createElement({ id: "blue", backgroundColor: "#a5d8ff" });
    API.setElements([red1, red2, blue]);
    API.setSelectedElements([red1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["red1", "red2"]);
  });

  it("matches any background color in a multi-element selection", () => {
    const red = API.createElement({ id: "red", backgroundColor: "#ffc9c9" });
    const red2 = API.createElement({ id: "red2", backgroundColor: "#ffc9c9" });
    const blue = API.createElement({ id: "blue", backgroundColor: "#a5d8ff" });
    const blue2 = API.createElement({
      id: "blue2",
      backgroundColor: "#a5d8ff",
    });
    const green = API.createElement({
      id: "green",
      backgroundColor: "#b2f2bb",
    });
    API.setElements([red, red2, blue, blue2, green]);
    API.setSelectedElements([red, blue]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["blue", "blue2", "red", "red2"]);
  });

  it("treats transparent as a matchable color", () => {
    const t1 = API.createElement({ id: "t1", backgroundColor: "transparent" });
    const t2 = API.createElement({
      id: "t2",
      type: "diamond",
      backgroundColor: "transparent",
    });
    const filled = API.createElement({
      id: "filled",
      backgroundColor: "#ffc9c9",
    });
    API.setElements([t1, t2, filled]);
    API.setSelectedElements([t1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["t1", "t2"]);
  });

  it("skips locked, deleted and container-bound text elements", () => {
    const source = API.createElement({
      id: "source",
      backgroundColor: "#ffc9c9",
    });
    const locked = API.createElement({
      id: "locked",
      backgroundColor: "#ffc9c9",
      locked: true,
    });
    const deleted = API.createElement({
      id: "deleted",
      backgroundColor: "#ffc9c9",
      isDeleted: true,
    });
    const container = API.createElement({
      id: "container",
      backgroundColor: "#ffc9c9",
      boundElements: [{ type: "text", id: "boundText" }],
    });
    const boundText = API.createElement({
      id: "boundText",
      type: "text",
      backgroundColor: "#ffc9c9",
      containerId: "container",
    });
    API.setElements([source, locked, deleted, container, boundText]);
    API.setSelectedElements([source]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["container", "source"]);
  });

  it("expands groups like Select all", () => {
    const red = API.createElement({ id: "red", backgroundColor: "#ffc9c9" });
    const groupedRed = API.createElement({
      id: "groupedRed",
      backgroundColor: "#ffc9c9",
      groupIds: ["g1"],
    });
    const groupedBlue = API.createElement({
      id: "groupedBlue",
      backgroundColor: "#a5d8ff",
      groupIds: ["g1"],
    });
    API.setElements([red, groupedRed, groupedBlue]);
    API.setSelectedElements([red]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["groupedBlue", "groupedRed", "red"]);
    expect(h.state.selectedGroupIds).toEqual({ g1: true });
  });

  it("does not keep a line editor when group expansion selects more elements", () => {
    const line = API.createElement({
      id: "line",
      type: "line",
      backgroundColor: "transparent",
      groupIds: ["g1"],
    });
    const rect = API.createElement({
      id: "rect",
      backgroundColor: "#ffc9c9",
      groupIds: ["g1"],
    });
    API.setElements([line, rect]);
    API.setSelectedElements([line]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds()).toEqual(["line", "rect"]);
    expect(h.state.selectedLinearElement).toBeNull();
  });

  it("is only available when something is selected", () => {
    const rect = API.createElement({ backgroundColor: "#ffc9c9" });
    API.setElements([rect]);

    const predicate = () =>
      actionSelectAllWithSameBackgroundColor.predicate!(h.elements, h.state);

    expect(predicate()).toBe(false);
    API.setSelectedElements([rect]);
    expect(predicate()).toBe(true);
  });

  it("uses the English label and is undoable", () => {
    expect(actionSelectAllWithSameBackgroundColor.label).toBe(
      "labels.selectAllWithSameBackgroundColor",
    );

    const a = API.createElement({ id: "a", backgroundColor: "#ffc9c9" });
    const b = API.createElement({ id: "b", backgroundColor: "#ffc9c9" });
    API.updateScene({
      elements: [a, b],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { selectedElementIds: { a: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.executeAction(actionSelectAllWithSameBackgroundColor);
    expect(selectedIds()).toEqual(["a", "b"]);

    act(() => {
      h.app.actionManager.executeAction(h.app.actionManager.actions.undo);
    });
    expect(selectedIds()).toEqual(["a"]);
  });
});
