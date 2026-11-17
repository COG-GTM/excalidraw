import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionSelectAllWithSameOpacity } from "./actionSelectAllWithSameOpacity";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds).filter(
    (id) => h.state.selectedElementIds[id],
  );

describe("actionSelectAllWithSameOpacity", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every element with a matching opacity", () => {
    const a = API.createElement({ type: "rectangle", opacity: 50 });
    const b = API.createElement({ type: "ellipse", opacity: 50 });
    const c = API.createElement({ type: "diamond", opacity: 100 });
    API.setElements([a, b, c]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds().sort()).toEqual([a.id, b.id].sort());
  });

  it("does not select elements with other opacity values", () => {
    const a = API.createElement({ type: "rectangle", opacity: 30 });
    const b = API.createElement({ type: "rectangle", opacity: 60 });
    const c = API.createElement({ type: "rectangle", opacity: 100 });
    API.setElements([a, b, c]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual([a.id]);
  });

  it("matches any opacity in a mixed selection", () => {
    const a = API.createElement({ type: "rectangle", opacity: 30 });
    const b = API.createElement({ type: "rectangle", opacity: 60 });
    const c = API.createElement({ type: "ellipse", opacity: 30 });
    const d = API.createElement({ type: "ellipse", opacity: 60 });
    const e = API.createElement({ type: "ellipse", opacity: 100 });
    API.setElements([a, b, c, d, e]);
    API.setSelectedElements([a, b]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds().sort()).toEqual([a.id, b.id, c.id, d.id].sort());
  });

  it("skips locked elements", () => {
    const a = API.createElement({ type: "rectangle", opacity: 50 });
    const locked = API.createElement({
      type: "rectangle",
      opacity: 50,
      locked: true,
    });
    API.setElements([a, locked]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual([a.id]);
  });

  it("skips deleted elements", () => {
    const a = API.createElement({ type: "rectangle", opacity: 50 });
    const deleted = API.createElement({
      type: "rectangle",
      opacity: 50,
      isDeleted: true,
    });
    API.setElements([a, deleted]);
    API.setSelectedElements([a]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds()).toEqual([a.id]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({ type: "rectangle", opacity: 50 });
    const boundText = API.createElement({
      type: "text",
      text: "hi",
      opacity: 50,
      containerId: container.id,
    });
    const other = API.createElement({ type: "ellipse", opacity: 50 });
    API.setElements([container, boundText, other]);
    API.setSelectedElements([other]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds().sort()).toEqual([container.id, other.id].sort());
  });

  it("expands groups like Select All", () => {
    const a = API.createElement({
      type: "rectangle",
      opacity: 50,
      groupIds: ["g1"],
    });
    const b = API.createElement({
      type: "rectangle",
      opacity: 50,
      groupIds: ["g1"],
    });
    const c = API.createElement({ type: "ellipse", opacity: 50 });
    API.setElements([a, b, c]);
    API.setSelectedElements([c]);

    API.executeAction(actionSelectAllWithSameOpacity);

    expect(selectedIds().sort()).toEqual([a.id, b.id, c.id].sort());
    expect(h.state.selectedGroupIds).toEqual({ g1: true });
  });

  it("is only available when something is selected", () => {
    const a = API.createElement({ type: "rectangle", opacity: 50 });
    API.setElements([a]);

    expect(
      actionSelectAllWithSameOpacity.predicate!(h.elements, h.state, {}, h.app),
    ).toBe(false);

    API.setSelectedElements([a]);

    expect(
      actionSelectAllWithSameOpacity.predicate!(h.elements, h.state, {}, h.app),
    ).toBe(true);
  });

  it("can be undone", () => {
    const a = API.createElement({ type: "rectangle", opacity: 50 });
    const b = API.createElement({ type: "rectangle", opacity: 50 });
    API.updateScene({
      elements: [a, b],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { selectedElementIds: { [a.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.executeAction(actionSelectAllWithSameOpacity);
    expect(selectedIds().sort()).toEqual([a.id, b.id].sort());

    act(() => {
      Keyboard.undo();
    });
    expect(selectedIds()).toEqual([a.id]);
  });
});
