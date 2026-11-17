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

  it("selects elements with a matching stroke style and skips others", () => {
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

  it("matches any stroke style in a mixed selection", () => {
    const dashed1 = API.createElement({ strokeStyle: "dashed" });
    const dashed2 = API.createElement({ strokeStyle: "dashed" });
    const dotted1 = API.createElement({ strokeStyle: "dotted" });
    const dotted2 = API.createElement({ strokeStyle: "dotted" });
    const solid = API.createElement({ strokeStyle: "solid" });
    API.setElements([dashed1, dashed2, dotted1, dotted2, solid]);
    API.setSelectedElements([dashed1, dotted1]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds().sort()).toEqual(
      [dashed1.id, dashed2.id, dotted1.id, dotted2.id].sort(),
    );
  });

  it("skips locked and deleted elements", () => {
    const dotted = API.createElement({ strokeStyle: "dotted" });
    const locked = API.createElement({ strokeStyle: "dotted", locked: true });
    const deleted = API.createElement({
      strokeStyle: "dotted",
      isDeleted: true,
    });
    API.setElements([dotted, locked, deleted]);
    API.setSelectedElements([dotted]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds()).toEqual([dotted.id]);
  });

  it("skips text bound inside a container", () => {
    const container = API.createElement({
      type: "rectangle",
      strokeStyle: "solid",
    });
    const boundText = API.createElement({
      type: "text",
      strokeStyle: "solid",
      containerId: container.id,
    });
    const other = API.createElement({ type: "ellipse", strokeStyle: "solid" });
    API.setElements([container, boundText, other]);
    API.setSelectedElements([other]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds().sort()).toEqual([container.id, other.id].sort());
  });

  it("expands groups like Select All", () => {
    const a = API.createElement({ strokeStyle: "dashed", groupIds: ["g1"] });
    const b = API.createElement({ strokeStyle: "dashed", groupIds: ["g1"] });
    const seed = API.createElement({ strokeStyle: "dashed" });
    API.setElements([a, b, seed]);
    API.setSelectedElements([seed]);

    API.executeAction(actionSelectAllWithSameStrokeStyle);

    expect(selectedIds().sort()).toEqual([a.id, b.id, seed.id].sort());
    expect(h.state.selectedGroupIds).toEqual({ g1: true });
  });

  it("is hidden when nothing is selected", () => {
    const rect = API.createElement({ strokeStyle: "dashed" });
    API.setElements([rect]);

    expect(
      actionSelectAllWithSameStrokeStyle.predicate!(h.elements, h.state),
    ).toBe(false);

    API.setSelectedElements([rect]);
    expect(
      actionSelectAllWithSameStrokeStyle.predicate!(h.elements, h.state),
    ).toBe(true);
  });

  it("can be undone", () => {
    const dashed1 = API.createElement({ strokeStyle: "dashed" });
    const dashed2 = API.createElement({ strokeStyle: "dashed" });
    act(() => {
      API.updateScene({
        elements: [dashed1, dashed2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
    act(() => {
      API.updateScene({
        appState: { ...h.state, selectedElementIds: { [dashed1.id]: true } },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    API.executeAction(actionSelectAllWithSameStrokeStyle);
    expect(selectedIds().sort()).toEqual([dashed1.id, dashed2.id].sort());

    Keyboard.undo();
    expect(selectedIds()).toEqual([dashed1.id]);
  });
});
