import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import { actionSelectAllWithSameBackgroundColor } from "./actionSelectAllWithSameBackgroundColor";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds).filter(
    (id) => h.state.selectedElementIds[id],
  );

describe("actionSelectAllWithSameBackgroundColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects every element whose background matches the selection", () => {
    const red1 = API.createElement({
      type: "rectangle",
      backgroundColor: "#ff0000",
    });
    const red2 = API.createElement({
      type: "ellipse",
      backgroundColor: "#ff0000",
    });
    const blue = API.createElement({
      type: "rectangle",
      backgroundColor: "#0000ff",
    });
    API.setElements([red1, red2, blue]);
    API.setSelectedElements([red1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds().sort()).toEqual([red1.id, red2.id].sort());
  });

  it("matches any background color in a multi-selection", () => {
    const red = API.createElement({ backgroundColor: "#ff0000" });
    const blue = API.createElement({ backgroundColor: "#0000ff" });
    const blue2 = API.createElement({ backgroundColor: "#0000ff" });
    const green = API.createElement({ backgroundColor: "#00ff00" });
    API.setElements([red, blue, blue2, green]);
    API.setSelectedElements([red, blue]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds().sort()).toEqual([red.id, blue.id, blue2.id].sort());
  });

  it("matches transparent backgrounds", () => {
    const t1 = API.createElement({ backgroundColor: "transparent" });
    const t2 = API.createElement({
      type: "diamond",
      backgroundColor: "transparent",
    });
    const filled = API.createElement({ backgroundColor: "#ff0000" });
    API.setElements([t1, t2, filled]);
    API.setSelectedElements([t1]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds().sort()).toEqual([t1.id, t2.id].sort());
  });

  it("skips locked, deleted and container-bound text elements", () => {
    const red = API.createElement({ backgroundColor: "#ff0000" });
    const locked = API.createElement({
      backgroundColor: "#ff0000",
      locked: true,
    });
    const deleted = API.createElement({
      backgroundColor: "#ff0000",
      isDeleted: true,
    });
    const container = API.createElement({
      type: "rectangle",
      backgroundColor: "#ff0000",
    });
    const boundText = API.createElement({
      type: "text",
      backgroundColor: "#ff0000",
      containerId: container.id,
    });
    API.setElements([red, locked, deleted, container, boundText]);
    API.setSelectedElements([red]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(selectedIds().sort()).toEqual([red.id, container.id].sort());
  });

  it("expands groups like Select all", () => {
    const red = API.createElement({ backgroundColor: "#ff0000" });
    const groupedRed = API.createElement({
      backgroundColor: "#ff0000",
      groupIds: ["g1"],
    });
    const groupedBlue = API.createElement({
      backgroundColor: "#0000ff",
      groupIds: ["g1"],
    });
    API.setElements([red, groupedRed, groupedBlue]);
    API.setSelectedElements([red]);

    API.executeAction(actionSelectAllWithSameBackgroundColor);

    expect(h.state.selectedGroupIds).toEqual({ g1: true });
    expect(h.state.selectedElementIds[groupedRed.id]).toBe(true);
  });

  it("is not available when nothing is selected", () => {
    const red = API.createElement({ backgroundColor: "#ff0000" });
    API.setElements([red]);
    API.setSelectedElements([]);

    expect(
      actionSelectAllWithSameBackgroundColor.predicate!(h.elements, h.state),
    ).toBe(false);

    API.setSelectedElements([red]);
    expect(
      actionSelectAllWithSameBackgroundColor.predicate!(h.elements, h.state),
    ).toBe(true);
  });

  it("can be undone", () => {
    const red1 = API.createElement({ backgroundColor: "#ff0000" });
    const red2 = API.createElement({ backgroundColor: "#ff0000" });
    API.updateScene({
      elements: [red1, red2],
      appState: { selectedElementIds: { [red1.id]: true } },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.executeAction(actionSelectAllWithSameBackgroundColor);
    expect(selectedIds().length).toBe(2);

    API.executeAction(h.app.actionManager.actions.undo);
    expect(selectedIds()).toEqual([red1.id]);
  });
});
