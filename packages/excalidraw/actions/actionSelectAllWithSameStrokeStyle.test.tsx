import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionSelectAllWithSameStrokeStyle } from "./actionSelectAllWithSameStrokeStyle";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds).filter(
    (id) => h.state.selectedElementIds[id],
  );

describe("actionSelectAllWithSameStrokeStyle", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects elements with matching stroke style only", () => {
    const dashed1 = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    const dashed2 = API.createElement({
      type: "ellipse",
      strokeStyle: "dashed",
    });
    const dashedArrow = API.createElement({
      type: "arrow",
      strokeStyle: "dashed",
    });
    const solid = API.createElement({
      type: "rectangle",
      strokeStyle: "solid",
    });
    const dotted = API.createElement({
      type: "diamond",
      strokeStyle: "dotted",
    });
    API.setElements([dashed1, dashed2, dashedArrow, solid, dotted]);
    API.setSelectedElements([dashed1]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds().sort()).toEqual(
      [dashed1.id, dashed2.id, dashedArrow.id].sort(),
    );
  });

  it("matches any stroke style present in a mixed selection", () => {
    const dashed1 = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    const dashed2 = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    const dotted1 = API.createElement({
      type: "rectangle",
      strokeStyle: "dotted",
    });
    const dotted2 = API.createElement({
      type: "rectangle",
      strokeStyle: "dotted",
    });
    const solid = API.createElement({
      type: "rectangle",
      strokeStyle: "solid",
    });
    API.setElements([dashed1, dashed2, dotted1, dotted2, solid]);
    API.setSelectedElements([dashed1, dotted1]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds().sort()).toEqual(
      [dashed1.id, dashed2.id, dotted1.id, dotted2.id].sort(),
    );
  });

  it("skips locked and deleted elements", () => {
    const dashed = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    const locked = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
      locked: true,
    });
    const deleted = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
      isDeleted: true,
    });
    API.setElements([dashed, locked, deleted]);
    API.setSelectedElements([dashed]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds()).toEqual([dashed.id]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    const other = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    const boundText = API.createElement({
      type: "text",
      strokeStyle: "dashed",
      containerId: container.id,
    });
    API.setElements([container, other, boundText]);
    API.setSelectedElements([other]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds().sort()).toEqual([container.id, other.id].sort());
  });

  it("expands groups like Select All", () => {
    const dashed = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
      groupIds: ["g1"],
    });
    const groupMate = API.createElement({
      type: "rectangle",
      strokeStyle: "solid",
      groupIds: ["g1"],
    });
    const seed = API.createElement({ type: "ellipse", strokeStyle: "dashed" });
    API.setElements([dashed, groupMate, seed]);
    API.setSelectedElements([seed]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(h.state.selectedGroupIds).toEqual({ g1: true });
    expect(selectedIds().sort()).toEqual(
      [dashed.id, groupMate.id, seed.id].sort(),
    );
  });

  it("is only available when something is selected", () => {
    const dashed = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    API.setElements([dashed]);
    API.setSelectedElements([]);
    expect(
      actionSelectAllWithSameStrokeStyle.predicate!(
        h.elements,
        h.state,
        {},
        h.app,
      ),
    ).toBe(false);

    API.setSelectedElements([dashed]);
    expect(
      actionSelectAllWithSameStrokeStyle.predicate!(
        h.elements,
        h.state,
        {},
        h.app,
      ),
    ).toBe(true);
  });

  it("uses the English label", () => {
    expect(actionSelectAllWithSameStrokeStyle.label).toBe(
      "labels.selectAllWithSameStrokeStyle",
    );
  });

  it("is undoable", () => {
    const dashed1 = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    const dashed2 = API.createElement({
      type: "rectangle",
      strokeStyle: "dashed",
    });
    API.updateScene({
      elements: [dashed1, dashed2],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { ...h.state, selectedElementIds: { [dashed1.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    act(() => {
      API.executeAction(actionSelectAllWithSameStrokeStyle);
    });
    expect(selectedIds().sort()).toEqual([dashed1.id, dashed2.id].sort());

    Keyboard.undo();
    expect(selectedIds()).toEqual([dashed1.id]);

    Keyboard.redo();
    expect(selectedIds().sort()).toEqual([dashed1.id, dashed2.id].sort());
  });
});
