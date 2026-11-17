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

  it("selects elements with matching stroke width only", () => {
    const thin1 = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const thin2 = API.createElement({ type: "ellipse", strokeWidth: 1 });
    const thinArrow = API.createElement({ type: "arrow", strokeWidth: 1 });
    const bold = API.createElement({ type: "rectangle", strokeWidth: 4 });
    API.setElements([thin1, thin2, thinArrow, bold]);
    API.setSelectedElements([thin1]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds().sort()).toEqual(
      [thin1.id, thin2.id, thinArrow.id].sort(),
    );
    expect(h.state.selectedElementIds[bold.id]).toBeUndefined();
  });

  it("matches any stroke width in a mixed selection", () => {
    const thin = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const bold = API.createElement({ type: "rectangle", strokeWidth: 4 });
    const thin2 = API.createElement({ type: "diamond", strokeWidth: 1 });
    const bold2 = API.createElement({ type: "ellipse", strokeWidth: 4 });
    const medium = API.createElement({ type: "rectangle", strokeWidth: 2 });
    API.setElements([thin, bold, thin2, bold2, medium]);
    API.setSelectedElements([thin, bold]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds().sort()).toEqual(
      [thin.id, bold.id, thin2.id, bold2.id].sort(),
    );
  });

  it("skips locked and deleted elements", () => {
    const source = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const locked = API.createElement({
      type: "rectangle",
      strokeWidth: 1,
      locked: true,
    });
    const deleted = API.createElement({
      type: "rectangle",
      strokeWidth: 1,
      isDeleted: true,
    });
    API.setElements([source, locked, deleted]);
    API.setSelectedElements([source]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds()).toEqual([source.id]);
  });

  it("skips text bound inside a container", () => {
    const source = API.createElement({ type: "rectangle", strokeWidth: 4 });
    const container = API.createElement({
      type: "rectangle",
      strokeWidth: 4,
      id: "container",
      boundElements: [{ type: "text", id: "boundText" }],
    });
    const boundText = API.createElement({
      type: "text",
      id: "boundText",
      strokeWidth: 4,
      containerId: container.id,
    });
    const freeText = API.createElement({ type: "text", strokeWidth: 4 });
    API.setElements([source, container, boundText, freeText]);
    API.setSelectedElements([source]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds().sort()).toEqual(
      [source.id, container.id, freeText.id].sort(),
    );
    expect(h.state.selectedElementIds[boundText.id]).toBeUndefined();
  });

  it("expands groups like Select All", () => {
    const source = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const groupedThin = API.createElement({
      type: "rectangle",
      strokeWidth: 1,
      groupIds: ["g1"],
    });
    const groupedBold = API.createElement({
      type: "rectangle",
      strokeWidth: 4,
      groupIds: ["g1"],
    });
    API.setElements([source, groupedThin, groupedBold]);
    API.setSelectedElements([source]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(h.state.selectedGroupIds).toEqual({ g1: true });
    expect(selectedIds().sort()).toEqual(
      [source.id, groupedThin.id, groupedBold.id].sort(),
    );
  });

  it("is only available when something is selected", () => {
    const rect = API.createElement({ type: "rectangle", strokeWidth: 1 });
    API.setElements([rect]);

    expect(
      actionSelectAllWithSameStrokeWidth.predicate!(h.elements, h.state),
    ).toBe(false);

    API.setSelectedElements([rect]);

    expect(
      actionSelectAllWithSameStrokeWidth.predicate!(h.elements, h.state),
    ).toBe(true);
  });

  it("uses the English label", () => {
    expect(actionSelectAllWithSameStrokeWidth.label).toBe(
      "labels.selectAllWithSameStrokeWidth",
    );
  });

  it("is undoable", () => {
    const thin1 = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const thin2 = API.createElement({ type: "rectangle", strokeWidth: 1 });
    const bold = API.createElement({ type: "rectangle", strokeWidth: 4 });
    API.updateScene({
      elements: [thin1, thin2, bold],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { ...h.state, selectedElementIds: { [thin1.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.executeAction(actionSelectAllWithSameStrokeWidth);
    expect(selectedIds().sort()).toEqual([thin1.id, thin2.id].sort());

    Keyboard.undo();
    expect(selectedIds()).toEqual([thin1.id]);

    Keyboard.redo();
    expect(selectedIds().sort()).toEqual([thin1.id, thin2.id].sort());
  });
});
