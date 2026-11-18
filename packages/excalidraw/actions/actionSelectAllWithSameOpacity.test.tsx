import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionSelectAllWithSameOpacity } from "./actionSelectAllWithSameOpacity";

const { h } = window;

const selectedIds = () => Object.keys(h.state.selectedElementIds).sort();

describe("actionSelectAllWithSameOpacity", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every element with a matching opacity and skips other values", () => {
    const a = API.createElement({ id: "a", type: "rectangle", opacity: 50 });
    const b = API.createElement({ id: "b", type: "ellipse", opacity: 50 });
    const c = API.createElement({ id: "c", type: "diamond", opacity: 100 });
    const d = API.createElement({ id: "d", type: "arrow", opacity: 50 });
    API.setElements([a, b, c, d]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["a", "b", "d"]);
  });

  it("matches any opacity in a mixed selection", () => {
    const a = API.createElement({ id: "a", opacity: 30 });
    const b = API.createElement({ id: "b", opacity: 60 });
    const c = API.createElement({ id: "c", opacity: 30 });
    const d = API.createElement({ id: "d", opacity: 60 });
    const e = API.createElement({ id: "e", opacity: 90 });
    API.setElements([a, b, c, d, e]);
    API.setSelectedElements([a, b]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["a", "b", "c", "d"]);
  });

  it("skips locked and deleted elements", () => {
    const a = API.createElement({ id: "a", opacity: 40 });
    const locked = API.createElement({
      id: "locked",
      opacity: 40,
      locked: true,
    });
    const deleted = API.createElement({
      id: "deleted",
      opacity: 40,
      isDeleted: true,
    });
    API.setElements([a, locked, deleted]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["a"]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      id: "container",
      type: "rectangle",
      opacity: 70,
      boundElements: [{ type: "text", id: "bound" }],
    });
    const bound = API.createElement({
      id: "bound",
      type: "text",
      opacity: 70,
      containerId: "container",
    });
    const free = API.createElement({ id: "free", type: "text", opacity: 70 });
    const other = API.createElement({ id: "other", opacity: 70 });
    API.setElements([container, bound, free, other]);
    API.setSelectedElements([other]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["container", "free", "other"]);
  });

  it("expands groups like Select All", () => {
    const a = API.createElement({ id: "a", opacity: 20, groupIds: ["g1"] });
    const b = API.createElement({ id: "b", opacity: 20, groupIds: ["g1"] });
    const c = API.createElement({ id: "c", opacity: 100 });
    API.setElements([a, b, c]);
    API.setSelectedElements([c]);
    act(() => {
      h.setState({ selectedElementIds: { a: true } });
    });

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual(["a", "b"]);
    expect(h.state.selectedGroupIds).toEqual({ g1: true });
  });

  it("is only available when something is selected", () => {
    const a = API.createElement({ id: "a", opacity: 50 });
    API.setElements([a]);
    API.setSelectedElements([]);

    expect(
      actionSelectAllWithSameOpacity.predicate!(h.elements, h.state, {}, h.app),
    ).toBe(false);

    API.setSelectedElements([a]);

    expect(
      actionSelectAllWithSameOpacity.predicate!(h.elements, h.state, {}, h.app),
    ).toBe(true);
  });

  it("is undoable", () => {
    const a = API.createElement({ id: "a", opacity: 50 });
    const b = API.createElement({ id: "b", opacity: 50 });
    API.updateScene({
      elements: [a, b],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { ...h.state, selectedElementIds: { a: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.executeAction(actionSelectAllWithSameOpacity);
    expect(selectedIds()).toEqual(["a", "b"]);

    Keyboard.undo();
    expect(selectedIds()).toEqual(["a"]);

    Keyboard.redo();
    expect(selectedIds()).toEqual(["a", "b"]);
  });
});
