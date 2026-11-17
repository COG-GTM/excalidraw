import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionSelectAllWithSameStrokeStyle } from "./actionSelectAllWithSameStrokeStyle";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds)
    .filter((id) => h.state.selectedElementIds[id])
    .sort();

describe("actionSelectAllWithSameStrokeStyle", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every element with a matching stroke style", () => {
    const dashed1 = API.createElement({
      type: "rectangle",
      id: "dashed1",
      strokeStyle: "dashed",
    });
    const dashed2 = API.createElement({
      type: "ellipse",
      id: "dashed2",
      strokeStyle: "dashed",
    });
    const dashedArrow = API.createElement({
      type: "arrow",
      id: "dashedArrow",
      strokeStyle: "dashed",
    });
    const solid = API.createElement({
      type: "rectangle",
      id: "solid",
      strokeStyle: "solid",
    });
    const dotted = API.createElement({
      type: "diamond",
      id: "dotted",
      strokeStyle: "dotted",
    });
    API.setElements([dashed1, dashed2, dashedArrow, solid, dotted]);
    API.setSelectedElements([dashed1]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds()).toEqual(["dashed1", "dashed2", "dashedArrow"]);
  });

  it("matches any stroke style present in a mixed selection", () => {
    const dashed = API.createElement({ id: "dashed", strokeStyle: "dashed" });
    const dotted = API.createElement({ id: "dotted", strokeStyle: "dotted" });
    const dotted2 = API.createElement({ id: "dotted2", strokeStyle: "dotted" });
    const solid = API.createElement({ id: "solid", strokeStyle: "solid" });
    API.setElements([dashed, dotted, dotted2, solid]);
    API.setSelectedElements([dashed, dotted]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds()).toEqual(["dashed", "dotted", "dotted2"]);
  });

  it("skips deleted and locked elements", () => {
    const dashed = API.createElement({ id: "dashed", strokeStyle: "dashed" });
    const locked = API.createElement({
      id: "locked",
      strokeStyle: "dashed",
      locked: true,
    });
    const deleted = API.createElement({
      id: "deleted",
      strokeStyle: "dashed",
      isDeleted: true,
    });
    API.setElements([dashed, locked, deleted]);
    API.setSelectedElements([dashed]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds()).toEqual(["dashed"]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      strokeStyle: "dashed",
    });
    const boundText = API.createElement({
      type: "text",
      id: "boundText",
      strokeStyle: "dashed",
      containerId: container.id,
    });
    const freeText = API.createElement({
      type: "text",
      id: "freeText",
      strokeStyle: "dashed",
    });
    API.setElements([container, boundText, freeText]);
    API.setSelectedElements([container]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds()).toEqual(["container", "freeText"]);
  });

  it("expands groups like Select All does", () => {
    const grouped1 = API.createElement({
      id: "grouped1",
      strokeStyle: "dashed",
      groupIds: ["g1"],
    });
    const grouped2 = API.createElement({
      id: "grouped2",
      strokeStyle: "dashed",
      groupIds: ["g1"],
    });
    const selected = API.createElement({
      id: "selected",
      strokeStyle: "dashed",
    });
    API.setElements([grouped1, grouped2, selected]);
    API.setSelectedElements([selected]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds()).toEqual(["grouped1", "grouped2", "selected"]);
    expect(h.state.selectedGroupIds).toEqual({ g1: true });
  });

  it("is only available when something is selected", () => {
    const dashed = API.createElement({ id: "dashed", strokeStyle: "dashed" });
    API.setElements([dashed]);

    const isAvailable = () =>
      actionSelectAllWithSameStrokeStyle.predicate!(
        h.elements,
        h.state,
        {},
        h.app,
      );

    expect(isAvailable()).toBe(false);
    API.setSelectedElements([dashed]);
    expect(isAvailable()).toBe(true);
  });

  it("uses the English label", () => {
    expect(actionSelectAllWithSameStrokeStyle.label).toBe(
      "labels.selectAllWithSameStrokeStyle",
    );
  });

  it("can be undone and redone", () => {
    const dashed1 = API.createElement({ id: "dashed1", strokeStyle: "dashed" });
    const dashed2 = API.createElement({ id: "dashed2", strokeStyle: "dashed" });
    const solid = API.createElement({ id: "solid", strokeStyle: "solid" });
    API.updateScene({
      elements: [dashed1, dashed2, solid],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    act(() => {
      API.updateScene({
        appState: { ...h.state, selectedElementIds: { [dashed1.id]: true } },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    API.executeAction(actionSelectAllWithSameStrokeStyle);
    expect(selectedIds()).toEqual(["dashed1", "dashed2"]);

    Keyboard.undo();
    expect(selectedIds()).toEqual(["dashed1"]);

    Keyboard.redo();
    expect(selectedIds()).toEqual(["dashed1", "dashed2"]);
  });
});
