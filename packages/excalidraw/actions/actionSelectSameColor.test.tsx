import React from "react";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import { actionSelectSameColor } from "./actionSelectSameColor";

const { h } = window;

describe("actionSelectSameColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects elements sharing a stroke or background color", () => {
    const red = API.createElement({
      type: "rectangle",
      strokeColor: "#e03131",
    });
    const redStroke = API.createElement({
      type: "ellipse",
      strokeColor: "#e03131",
    });
    const redFill = API.createElement({
      type: "diamond",
      strokeColor: "#1e1e1e",
      backgroundColor: "#e03131",
    });
    const blue = API.createElement({
      type: "rectangle",
      strokeColor: "#1971c2",
    });
    const deleted = API.createElement({
      type: "rectangle",
      strokeColor: "#e03131",
      isDeleted: true,
    });
    const locked = API.createElement({
      type: "rectangle",
      strokeColor: "#e03131",
      locked: true,
    });
    const container = API.createElement({
      type: "rectangle",
      strokeColor: "#1971c2",
    });
    const boundText = API.createElement({
      type: "text",
      strokeColor: "#e03131",
      containerId: container.id,
    });

    API.setElements([
      red,
      redStroke,
      redFill,
      blue,
      deleted,
      locked,
      container,
      boundText,
    ]);
    API.setSelectedElements([red]);

    API.executeAction(actionSelectSameColor);

    expect(Object.keys(h.state.selectedElementIds).sort()).toEqual(
      [red.id, redStroke.id, redFill.id].sort(),
    );
  });

  it("does nothing when nothing is selected", () => {
    const red = API.createElement({
      type: "rectangle",
      strokeColor: "#e03131",
    });
    API.setElements([red]);
    API.setSelectedElements([]);

    expect(actionSelectSameColor.predicate!(h.elements, h.state)).toBe(false);
    API.executeAction(actionSelectSameColor);
    expect(h.state.selectedElementIds).toEqual({});
  });
});
