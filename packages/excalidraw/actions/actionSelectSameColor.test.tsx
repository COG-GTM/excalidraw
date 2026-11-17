import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionSelectSameColor } from "./actionSelectSameColor";

const { h } = window;

const RED = "#e03131";
const BLUE = "#1971c2";

describe("actionSelectSameColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const createScene = () => {
    const redRect = API.createElement({
      type: "rectangle",
      id: "redRect",
      strokeColor: RED,
    });
    const redEllipse = API.createElement({
      type: "ellipse",
      id: "redEllipse",
      strokeColor: RED,
    });
    const redArrow = API.createElement({
      type: "arrow",
      id: "redArrow",
      strokeColor: RED,
    });
    const blueRect = API.createElement({
      type: "rectangle",
      id: "blueRect",
      strokeColor: BLUE,
    });
    const blueText = API.createElement({
      type: "text",
      id: "blueText",
      strokeColor: BLUE,
    });
    const lockedRed = API.createElement({
      type: "rectangle",
      id: "lockedRed",
      strokeColor: RED,
      locked: true,
    });
    const deletedRed = API.createElement({
      type: "diamond",
      id: "deletedRed",
      strokeColor: RED,
      isDeleted: true,
    });
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      strokeColor: BLUE,
    });
    const boundRedText = API.createElement({
      type: "text",
      id: "boundRedText",
      strokeColor: RED,
      containerId: container.id,
    });
    const redImage = API.createElement({
      type: "image",
      id: "redImage",
      strokeColor: RED,
    });
    const elements = [
      redRect,
      redEllipse,
      redArrow,
      blueRect,
      blueText,
      lockedRed,
      deletedRed,
      container,
      boundRedText,
      redImage,
    ];
    API.setElements(elements);
    return { redRect, blueRect };
  };

  it("selects only elements with the same stroke color", () => {
    const { redRect } = createScene();
    API.setSelectedElements([redRect]);

    API.executeAction(actionSelectSameColor);

    expect(Object.keys(h.state.selectedElementIds).sort()).toEqual(
      ["redArrow", "redEllipse", "redRect"].sort(),
    );
  });

  it("uses the first selected element's stroke color as the reference", () => {
    const { blueRect } = createScene();
    API.setSelectedElements([blueRect]);

    API.executeAction(actionSelectSameColor);

    expect(Object.keys(h.state.selectedElementIds).sort()).toEqual(
      ["blueRect", "blueText", "container"].sort(),
    );
  });

  it("does nothing when nothing is selected", () => {
    createScene();
    API.setSelectedElements([]);

    expect(h.app.actionManager.isActionEnabled(actionSelectSameColor)).toBe(
      false,
    );

    API.executeAction(actionSelectSameColor);

    expect(h.state.selectedElementIds).toEqual({});
  });

  it("is triggered by Ctrl/Cmd+Shift+A", () => {
    const { redRect } = createScene();
    API.setSelectedElements([redRect]);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });

    expect(Object.keys(h.state.selectedElementIds).sort()).toEqual(
      ["redArrow", "redEllipse", "redRect"].sort(),
    );
  });
});
