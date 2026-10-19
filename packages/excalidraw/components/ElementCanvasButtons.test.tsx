import React from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, GlobalTestState, render } from "../tests/test-utils";

import type { AppState } from "../types";

const { h } = window;

const queryCanvasButtons = () =>
  GlobalTestState.renderResult.container.querySelector<HTMLElement>(
    ".excalidraw-canvas-buttons",
  );

const renderWithSelectedMagicFrame = async () => {
  await render(<Excalidraw />);
  const magicFrame = API.createElement({
    type: "magicframe",
    x: 100,
    y: 50,
    width: 200,
    height: 120,
  });
  API.setElements([magicFrame]);
  API.setSelectedElements([magicFrame]);
  return magicFrame;
};

describe("ElementCanvasButtons", () => {
  it("renders the element's canvas buttons when it is selected", async () => {
    await renderWithSelectedMagicFrame();

    const container = queryCanvasButtons();
    expect(container).not.toBeNull();
    expect(
      container!.querySelector('[title="Convert to code"]'),
    ).not.toBeNull();
  });

  it("does not render when nothing is selected", async () => {
    await renderWithSelectedMagicFrame();
    API.setAppState({ selectedElementIds: {} });

    expect(queryCanvasButtons()).toBeNull();
  });

  it("positions the buttons at the element's top-right corner in viewport coords", async () => {
    await renderWithSelectedMagicFrame();

    let container = queryCanvasButtons()!;
    expect(container.style.top).toBe("50px");
    expect(container.style.left).toBe(`${100 + 200 + 10}px`);
    expect(container.style.padding).toBe("5px");

    API.setAppState({
      scrollX: 20,
      scrollY: -10,
      zoom: { value: 2 as AppState["zoom"]["value"] },
    });

    container = queryCanvasButtons()!;
    // ((sceneX + scrollX) * zoom) + 10, (sceneY + scrollY) * zoom
    expect(container.style.left).toBe(`${(100 + 200 + 20) * 2 + 10}px`);
    expect(container.style.top).toBe(`${(50 - 10) * 2}px`);
  });

  it("subtracts the editor offset so position is relative to the container", async () => {
    await renderWithSelectedMagicFrame();

    API.setAppState({ offsetLeft: 37, offsetTop: 21 });

    const container = queryCanvasButtons()!;
    expect(container.style.top).toBe("50px");
    expect(container.style.left).toBe(`${100 + 200 + 10}px`);
  });

  describe("hides the buttons while", () => {
    const guards: [
      string,
      (element: NonDeletedExcalidrawElement) => Partial<AppState>,
    ][] = [
      ["view mode is enabled", () => ({ viewModeEnabled: true })],
      [
        "the context menu is open",
        () => ({ contextMenu: { items: [], top: 0, left: 0 } }),
      ],
      [
        "an element is being created",
        (element) => ({ newElement: element as AppState["newElement"] }),
      ],
      [
        "an element is being resized",
        (element) => ({ resizingElement: element }),
      ],
      ["an element is being rotated", () => ({ isRotating: true })],
      ["a menu is open", () => ({ openMenu: "canvas" })],
    ];

    it.each(guards)("%s", async (_, getState) => {
      const magicFrame = await renderWithSelectedMagicFrame();
      expect(queryCanvasButtons()).not.toBeNull();

      API.setAppState(getState(magicFrame) as AppState);
      // entering view mode clears the selection, so re-select to make sure
      // the guard itself (not the deselection) is what hides the buttons
      API.setSelectedElements([magicFrame]);
      expect(h.state.selectedElementIds[magicFrame.id]).toBe(true);
      expect(queryCanvasButtons()).toBeNull();
    });
  });

  it("reappears once the guarding interaction ends", async () => {
    await renderWithSelectedMagicFrame();

    API.setAppState({ isRotating: true });
    expect(queryCanvasButtons()).toBeNull();

    act(() => {
      h.setState({ isRotating: false });
    });
    expect(queryCanvasButtons()).not.toBeNull();
  });
});
