import { fireEvent, queryByTestId } from "@testing-library/react";
import React from "react";

import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { isGridModeEnabled } from "../snapping";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionToggleGridMode } from "./actionToggleGridMode";

const { h } = window;
const mouse = new Pointer("mouse");

const pressToggleGridShortcut = () => {
  act(() => {
    fireEvent.keyDown(document, { ctrlKey: true, code: CODES.QUOTE });
  });
};

describe("actionToggleGridMode", () => {
  it("toggles appState.gridModeEnabled on and off", async () => {
    await render(<Excalidraw />);
    expect(h.state.gridModeEnabled).toBe(false);

    API.executeAction(actionToggleGridMode);
    expect(h.state.gridModeEnabled).toBe(true);

    API.executeAction(actionToggleGridMode);
    expect(h.state.gridModeEnabled).toBe(false);
  });

  it("checked() reflects appState.gridModeEnabled", async () => {
    await render(<Excalidraw />);
    expect(actionToggleGridMode.checked!(h.state)).toBe(false);

    API.executeAction(actionToggleGridMode);
    expect(actionToggleGridMode.checked!(h.state)).toBe(true);

    API.setAppState({ gridModeEnabled: false });
    expect(actionToggleGridMode.checked!(h.state)).toBe(false);
  });

  it("disables objectsSnapModeEnabled when enabling the grid", async () => {
    await render(<Excalidraw />);
    API.setAppState({ objectsSnapModeEnabled: true, gridModeEnabled: false });

    API.executeAction(actionToggleGridMode);

    expect(h.state.gridModeEnabled).toBe(true);
    expect(h.state.objectsSnapModeEnabled).toBe(false);
  });

  it("also resets objectsSnapModeEnabled when disabling the grid", async () => {
    await render(<Excalidraw />);
    API.setAppState({ objectsSnapModeEnabled: true, gridModeEnabled: true });

    API.executeAction(actionToggleGridMode);

    expect(h.state.gridModeEnabled).toBe(false);
    expect(h.state.objectsSnapModeEnabled).toBe(false);
  });

  it("does not modify scene elements", async () => {
    const rect = API.createElement({ type: "rectangle", x: 10, y: 10 });
    await render(<Excalidraw initialData={{ elements: [rect] }} />);
    const before = h.elements.map((el) => ({ ...el }));

    API.executeAction(actionToggleGridMode);

    expect(h.elements.map((el) => ({ ...el }))).toEqual(before);
  });

  it("does not create an undoable history entry", async () => {
    await render(<Excalidraw />);
    expect(h.history.isUndoStackEmpty).toBe(true);

    API.executeAction(actionToggleGridMode);
    API.executeAction(actionToggleGridMode);
    API.executeAction(actionToggleGridMode);

    expect(h.state.gridModeEnabled).toBe(true);
    expect(h.history.isUndoStackEmpty).toBe(true);
  });

  describe("keyTest", () => {
    const keyTest = (event: Partial<KeyboardEvent>) =>
      actionToggleGridMode.keyTest!(event as KeyboardEvent);

    it("matches Ctrl+' (Quote key code) only", async () => {
      await render(<Excalidraw />);

      expect(keyTest({ ctrlKey: true, code: CODES.QUOTE })).toBe(true);
      expect(keyTest({ ctrlKey: false, code: CODES.QUOTE })).toBe(false);
      expect(keyTest({ ctrlKey: true, code: CODES.EQUAL })).toBe(false);
    });

    it("toggles the grid via the Ctrl+' keyboard shortcut", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      pressToggleGridShortcut();
      expect(h.state.gridModeEnabled).toBe(true);

      pressToggleGridShortcut();
      expect(h.state.gridModeEnabled).toBe(false);
    });
  });

  it("is allowed in view mode", async () => {
    await render(
      <Excalidraw viewModeEnabled={true} handleKeyboardGlobally={true} />,
    );
    expect(h.state.viewModeEnabled).toBe(true);
    expect(actionToggleGridMode.viewMode).toBe(true);

    pressToggleGridShortcut();
    expect(h.state.gridModeEnabled).toBe(true);
  });

  describe("predicate (host-controlled gridModeEnabled prop)", () => {
    it("is enabled when the gridModeEnabled prop is not provided", async () => {
      await render(<Excalidraw />);
      expect(h.app.actionManager.isActionEnabled(actionToggleGridMode)).toBe(
        true,
      );

      mouse.rightClickAt(0, 0);
      const item = queryByTestId(UI.queryContextMenu()!, "gridMode");
      expect(item).not.toBe(null);

      fireEvent.click(item!.querySelector("button")!);
      expect(h.state.gridModeEnabled).toBe(true);
    });

    it("is disabled when the host controls gridModeEnabled", async () => {
      await render(<Excalidraw gridModeEnabled={true} />);
      expect(isGridModeEnabled(h.app)).toBe(true);
      expect(h.app.actionManager.isActionEnabled(actionToggleGridMode)).toBe(
        false,
      );

      mouse.rightClickAt(0, 0);
      expect(queryByTestId(UI.queryContextMenu()!, "gridMode")).toBe(null);
    });

    // the shortcut path in ActionManager does not consult `predicate`, so
    // appState still flips, but the host prop keeps precedence for snapping
    it("keyboard shortcut cannot override a host-controlled gridModeEnabled", async () => {
      await render(
        <Excalidraw gridModeEnabled={true} handleKeyboardGlobally={true} />,
      );
      const stateBefore = h.state.gridModeEnabled;

      pressToggleGridShortcut();

      expect(h.state.gridModeEnabled).toBe(!stateBefore);
      expect(isGridModeEnabled(h.app)).toBe(true);
    });
  });
});
