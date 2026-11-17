import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionSelectAllWithSameStrokeWidth } from "./actionSelectAllWithSameStrokeWidth";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds).filter(
    (id) => h.state.selectedElementIds[id],
  );

describe("actionSelectAllWithSameStrokeWidth", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every element whose stroke width matches the selection", () => {
    const thin1 = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const thin2 = API.createElement({ type: "ellipse", strokeWidth: 1 });
    const bold = API.createElement({ type: "rectangle", strokeWidth: 2 });
    const extraBold = API.createElement({ type: "diamond", strokeWidth: 4 });
    API.setElements([thin1, thin2, bold, extraBold]);
    API.setSelectedElements([thin1]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds().sort()).toEqual([thin1.id, thin2.id].sort());
  });

  it("matches any stroke width present in a mixed selection", () => {
    const thin = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const thin2 = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const bold = API.createElement({ type: "ellipse", strokeWidth: 2 });
    const bold2 = API.createElement({ type: "ellipse", strokeWidth: 2 });
    const extraBold = API.createElement({ type: "diamond", strokeWidth: 4 });
    API.setElements([thin, thin2, bold, bold2, extraBold]);
    API.setSelectedElements([thin, bold]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds().sort()).toEqual(
      [thin.id, thin2.id, bold.id, bold2.id].sort(),
    );
  });

  it("skips locked and deleted elements", () => {
    const selected = API.createElement({ type: "rectangle", strokeWidth: 2 });
    const locked = API.createElement({
      type: "rectangle",
      strokeWidth: 2,
      locked: true,
    });
    const deleted = API.createElement({
      type: "rectangle",
      strokeWidth: 2,
      isDeleted: true,
    });
    const match = API.createElement({ type: "ellipse", strokeWidth: 2 });
    API.setElements([selected, locked, deleted, match]);
    API.setSelectedElements([selected]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds().sort()).toEqual([selected.id, match.id].sort());
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      type: "rectangle",
      strokeWidth: 1,
    });
    const boundText = API.createElement({
      type: "text",
      strokeWidth: 1,
      containerId: container.id,
    });
    const freeText = API.createElement({ type: "text", strokeWidth: 1 });
    API.setElements([container, boundText, freeText]);
    API.setSelectedElements([container]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds().sort()).toEqual([container.id, freeText.id].sort());
  });

  it("expands groups like Select All", () => {
    const a = API.createElement({
      type: "rectangle",
      strokeWidth: 1,
      groupIds: ["g1"],
    });
    const b = API.createElement({
      type: "rectangle",
      strokeWidth: 1,
      groupIds: ["g1"],
    });
    const seed = API.createElement({ type: "ellipse", strokeWidth: 1 });
    API.setElements([a, b, seed]);
    API.setSelectedElements([seed]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(h.state.selectedGroupIds).toEqual({ g1: true });
    expect(selectedIds().sort()).toEqual([a.id, b.id, seed.id].sort());
  });

  it("sets selectedLinearElement for a single matching linear element", () => {
    const arrow = API.createElement({ type: "arrow", strokeWidth: 4 });
    const rect = API.createElement({ type: "rectangle", strokeWidth: 1 });
    API.setElements([arrow, rect]);
    API.setSelectedElements([arrow]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds()).toEqual([arrow.id]);
    expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);
  });

  it("does not set selectedLinearElement when the matching arrow is expanded to its group", () => {
    const arrow = API.createElement({
      type: "arrow",
      strokeWidth: 4,
      groupIds: ["g1"],
    });
    const groupMate = API.createElement({
      type: "rectangle",
      strokeWidth: 1,
      groupIds: ["g1"],
    });
    const other = API.createElement({ type: "ellipse", strokeWidth: 1 });
    API.setElements([arrow, groupMate, other]);
    API.setSelectedElements([arrow]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(h.state.selectedGroupIds).toEqual({ g1: true });
    expect(selectedIds().sort()).toEqual([arrow.id, groupMate.id].sort());
    expect(h.state.selectedLinearElement).toBeNull();
  });

  it("is only available when something is selected", () => {
    const rect = API.createElement({ type: "rectangle", strokeWidth: 1 });
    API.setElements([rect]);

    const isAvailable = () =>
      actionSelectAllWithSameStrokeWidth.predicate!(h.elements, h.state);

    API.setSelectedElements([]);
    expect(isAvailable()).toBe(false);

    API.setSelectedElements([rect]);
    expect(isAvailable()).toBe(true);
  });

  it("can be undone and redone", () => {
    const thin1 = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const thin2 = API.createElement({ type: "ellipse", strokeWidth: 1 });
    const bold = API.createElement({ type: "rectangle", strokeWidth: 2 });
    API.updateScene({
      elements: [thin1, thin2, bold],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([thin1]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);
    expect(selectedIds().sort()).toEqual([thin1.id, thin2.id].sort());

    Keyboard.undo();
    expect(h.state.selectedElementIds[thin2.id]).toBeUndefined();

    Keyboard.redo();
    expect(selectedIds().sort()).toEqual([thin1.id, thin2.id].sort());
  });
});
