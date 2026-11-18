import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionSelectAllWithSameStrokeWidth } from "./actionSelectAllWithSameStrokeWidth";

const { h } = window;

const selectedIds = () => Object.keys(h.state.selectedElementIds).sort();

describe("actionSelectAllWithSameStrokeWidth", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects elements with matching stroke width and skips others", () => {
    const thin1 = API.createElement({ id: "thin1", strokeWidth: 1 });
    const thin2 = API.createElement({
      id: "thin2",
      type: "ellipse",
      strokeWidth: 1,
    });
    const bold = API.createElement({ id: "bold", strokeWidth: 4 });
    API.setElements([thin1, thin2, bold]);
    API.setSelectedElements([thin1]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds()).toEqual(["thin1", "thin2"]);
  });

  it("matches any stroke width in a mixed selection", () => {
    const a = API.createElement({ id: "a", strokeWidth: 1 });
    const b = API.createElement({ id: "b", strokeWidth: 4 });
    const c = API.createElement({ id: "c", strokeWidth: 4 });
    const d = API.createElement({ id: "d", strokeWidth: 2 });
    API.setElements([a, b, c, d]);
    API.setSelectedElements([a, b]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds()).toEqual(["a", "b", "c"]);
  });

  it("skips locked and deleted elements", () => {
    const a = API.createElement({ id: "a", strokeWidth: 1 });
    const locked = API.createElement({
      id: "locked",
      strokeWidth: 1,
      locked: true,
    });
    const deleted = API.createElement({
      id: "deleted",
      strokeWidth: 1,
      isDeleted: true,
    });
    API.setElements([a, locked, deleted]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds()).toEqual(["a"]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      id: "container",
      strokeWidth: 2,
    });
    const boundText = API.createElement({
      id: "boundText",
      type: "text",
      strokeWidth: 2,
      containerId: container.id,
    });
    const other = API.createElement({ id: "other", strokeWidth: 2 });
    API.setElements([container, boundText, other]);
    API.setSelectedElements([other]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(selectedIds()).toEqual(["container", "other"]);
  });

  it("expands groups like select all", () => {
    const a = API.createElement({ id: "a", strokeWidth: 1, groupIds: ["g"] });
    const b = API.createElement({ id: "b", strokeWidth: 4, groupIds: ["g"] });
    const c = API.createElement({ id: "c", strokeWidth: 1 });
    API.setElements([a, b, c]);
    API.setSelectedElements([c]);

    API.executeAction(actionSelectAllWithSameStrokeWidth);

    expect(h.state.selectedGroupIds).toEqual({ g: true });
    expect(selectedIds()).toEqual(["a", "b", "c"]);
  });

  it("is only available when something is selected", () => {
    const a = API.createElement({ strokeWidth: 1 });
    API.setElements([a]);
    API.setSelectedElements([]);

    const predicate = actionSelectAllWithSameStrokeWidth.predicate!;
    expect(predicate(h.elements, h.state)).toBe(false);

    API.setSelectedElements([a]);
    expect(predicate(h.elements, h.state)).toBe(true);
  });

  it("uses the English label", () => {
    expect(actionSelectAllWithSameStrokeWidth.label).toBe(
      "labels.selectAllWithSameStrokeWidth",
    );
  });

  it("is undoable", () => {
    const a = API.createElement({ id: "a", strokeWidth: 1 });
    const b = API.createElement({ id: "b", strokeWidth: 1 });
    API.updateScene({
      elements: [a, b],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { ...h.state, selectedElementIds: { a: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.executeAction(actionSelectAllWithSameStrokeWidth);
    expect(selectedIds()).toEqual(["a", "b"]);

    Keyboard.undo();
    expect(selectedIds()).toEqual(["a"]);

    Keyboard.redo();
    expect(selectedIds()).toEqual(["a", "b"]);
  });
});
