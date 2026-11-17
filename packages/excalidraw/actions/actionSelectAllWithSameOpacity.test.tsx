import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionSelectAllWithSameOpacity } from "./actionSelectAllWithSameOpacity";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds)
    .filter((id) => h.state.selectedElementIds[id])
    .sort();

describe("actionSelectAllWithSameOpacity", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every element with a matching opacity", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      opacity: 50,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse",
      opacity: 50,
    });
    const diamond = API.createElement({
      type: "diamond",
      id: "diamond",
      opacity: 100,
    });
    API.setElements([rect, ellipse, diamond]);
    API.setSelectedElements([rect]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["ellipse", "rect"]);
  });

  it("matches any opacity in a mixed selection", () => {
    const a = API.createElement({ type: "rectangle", id: "a", opacity: 30 });
    const b = API.createElement({ type: "rectangle", id: "b", opacity: 70 });
    const c = API.createElement({ type: "ellipse", id: "c", opacity: 30 });
    const d = API.createElement({ type: "ellipse", id: "d", opacity: 70 });
    const e = API.createElement({ type: "diamond", id: "e", opacity: 100 });
    API.setElements([a, b, c, d, e]);
    API.setSelectedElements([a, b]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["a", "b", "c", "d"]);
  });

  it("skips locked and deleted elements", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      opacity: 40,
    });
    const locked = API.createElement({
      type: "ellipse",
      id: "locked",
      opacity: 40,
      locked: true,
    });
    const deleted = API.createElement({
      type: "diamond",
      id: "deleted",
      opacity: 40,
      isDeleted: true,
    });
    API.setElements([rect, locked, deleted]);
    API.setSelectedElements([rect]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["rect"]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      opacity: 60,
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      opacity: 60,
      containerId: "container",
    });
    const freeText = API.createElement({
      type: "text",
      id: "free",
      opacity: 60,
    });
    API.setElements([container, label, freeText]);
    API.setSelectedElements([container]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["container", "free"]);
  });

  it("expands groups like Select All", () => {
    const a = API.createElement({
      type: "rectangle",
      id: "a",
      opacity: 20,
      groupIds: ["g1"],
    });
    const b = API.createElement({
      type: "ellipse",
      id: "b",
      opacity: 20,
      groupIds: ["g1"],
    });
    const c = API.createElement({ type: "diamond", id: "c", opacity: 20 });
    API.setElements([a, b, c]);
    API.setSelectedElements([c]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["a", "b", "c"]);
    expect(h.state.selectedGroupIds).toEqual({ g1: true });
  });

  it("is only available when something is selected", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      opacity: 50,
    });
    API.setElements([rect]);

    expect(actionSelectAllWithSameOpacity.predicate!(h.elements, h.state)).toBe(
      false,
    );

    API.setSelectedElements([rect]);
    expect(actionSelectAllWithSameOpacity.predicate!(h.elements, h.state)).toBe(
      true,
    );
  });

  it("uses the English label", () => {
    expect(actionSelectAllWithSameOpacity.label).toBe(
      "labels.selectAllWithSameOpacity",
    );
  });

  it("is undoable", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      opacity: 50,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse",
      opacity: 50,
    });
    API.updateScene({
      elements: [rect, ellipse],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    act(() => {
      API.updateScene({
        appState: { ...h.state, selectedElementIds: { rect: true } },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    API.executeAction(actionSelectAllWithSameOpacity);
    expect(selectedIds()).toEqual(["ellipse", "rect"]);

    Keyboard.undo();
    expect(selectedIds()).toEqual(["rect"]);

    Keyboard.redo();
    expect(selectedIds()).toEqual(["ellipse", "rect"]);
  });
});
