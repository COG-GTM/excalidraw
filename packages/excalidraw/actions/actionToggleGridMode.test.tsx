import { fireEvent } from "@testing-library/react";

import { CODES } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { isGridModeEnabled } from "../snapping";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import { actionToggleGridMode } from "./actionToggleGridMode";

const { h } = window;

const pressGridShortcut = () => {
  fireEvent.keyDown(document, { ctrlKey: true, code: CODES.QUOTE });
};

describe("actionToggleGridMode", () => {
  describe("definition", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("should be registered as the view-mode enabled gridMode action", () => {
      expect(actionToggleGridMode.name).toBe("gridMode");
      expect(actionToggleGridMode.label).toBe("labels.toggleGrid");
      expect(actionToggleGridMode.viewMode).toBe(true);
      expect(actionToggleGridMode.keywords).toContain("snap");
      expect(h.app.actionManager.actions.gridMode).toBe(actionToggleGridMode);
    });

    it("should report checked based on appState.gridModeEnabled", () => {
      expect(
        actionToggleGridMode.checked!({ ...h.state, gridModeEnabled: false }),
      ).toBe(false);
      expect(
        actionToggleGridMode.checked!({ ...h.state, gridModeEnabled: true }),
      ).toBe(true);
    });

    it("should match only Ctrl/Cmd + Quote in keyTest", () => {
      const keyTest = (init: KeyboardEventInit) =>
        actionToggleGridMode.keyTest!(new KeyboardEvent("keydown", init));

      expect(keyTest({ ctrlKey: true, code: CODES.QUOTE })).toBe(true);
      expect(
        keyTest({ ctrlKey: true, shiftKey: true, code: CODES.QUOTE }),
      ).toBe(true);
      expect(keyTest({ code: CODES.QUOTE })).toBeFalsy();
      expect(keyTest({ altKey: true, code: CODES.QUOTE })).toBeFalsy();
      expect(keyTest({ ctrlKey: true, code: CODES.SLASH })).toBe(false);
      // matches on the physical key, not on the produced character
      expect(keyTest({ ctrlKey: true, key: "'" })).toBe(false);
    });
  });

  describe("predicate", () => {
    const predicate = () =>
      actionToggleGridMode.predicate!(h.elements, h.state, h.app.props);

    it("should be enabled when the host doesn't control gridModeEnabled", async () => {
      await render(<Excalidraw />);
      expect(predicate()).toBe(true);
    });

    it.each([true, false])(
      "should be disabled when the host passes gridModeEnabled={%s}",
      async (gridModeEnabled) => {
        await render(<Excalidraw gridModeEnabled={gridModeEnabled} />);
        expect(predicate()).toBe(false);
        expect(isGridModeEnabled(h.app)).toBe(gridModeEnabled);
      },
    );
  });

  describe("perform", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("should toggle gridModeEnabled on and off", () => {
      expect(h.state.gridModeEnabled).toBe(false);

      API.executeAction(actionToggleGridMode);
      expect(h.state.gridModeEnabled).toBe(true);
      expect(isGridModeEnabled(h.app)).toBe(true);

      API.executeAction(actionToggleGridMode);
      expect(h.state.gridModeEnabled).toBe(false);
      expect(isGridModeEnabled(h.app)).toBe(false);
    });

    it("should disable objects snap mode when turning the grid on", () => {
      API.setAppState({ objectsSnapModeEnabled: true });
      expect(h.state.objectsSnapModeEnabled).toBe(true);

      API.executeAction(actionToggleGridMode);

      expect(h.state.gridModeEnabled).toBe(true);
      expect(h.state.objectsSnapModeEnabled).toBe(false);
    });

    it("should return only an appState update that is captured eventually", () => {
      const result = actionToggleGridMode.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
      );

      expect(result).toEqual({
        appState: {
          ...h.state,
          gridModeEnabled: true,
          objectsSnapModeEnabled: false,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(result).not.toHaveProperty("elements");
    });

    it("should not modify or select elements", () => {
      const rect = API.createElement({ type: "rectangle", x: 13, y: 27 });
      API.setElements([rect]);
      const versionBefore = h.elements[0].version;

      API.executeAction(actionToggleGridMode);

      expect(h.elements).toHaveLength(1);
      expect(h.elements[0]).toEqual(
        expect.objectContaining({ id: rect.id, x: 13, y: 27 }),
      );
      expect(h.elements[0].version).toBe(versionBefore);
      expect(h.state.selectedElementIds).toEqual({});
    });

    it("should not create an undo entry", () => {
      API.updateScene({
        elements: [API.createElement({ type: "rectangle" })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      API.executeAction(actionToggleGridMode);
      API.executeAction(actionToggleGridMode);
      API.executeAction(actionToggleGridMode);

      expect(h.state.gridModeEnabled).toBe(true);
      expect(h.history.isUndoStackEmpty).toBe(true);
      expect(h.history.isRedoStackEmpty).toBe(true);
    });
  });

  describe("keyboard shortcut", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("should toggle the grid with Ctrl + Quote", () => {
      pressGridShortcut();
      expect(h.state.gridModeEnabled).toBe(true);

      pressGridShortcut();
      expect(h.state.gridModeEnabled).toBe(false);
    });

    it("should not toggle the grid on Quote without Ctrl", () => {
      fireEvent.keyDown(document, { code: CODES.QUOTE });
      expect(h.state.gridModeEnabled).toBe(false);
    });

    it("should toggle the grid in view mode", () => {
      API.setAppState({ viewModeEnabled: true });

      pressGridShortcut();

      expect(h.state.viewModeEnabled).toBe(true);
      expect(h.state.gridModeEnabled).toBe(true);
    });
  });

  describe("host-controlled gridModeEnabled", () => {
    it("should keep the effective grid mode equal to the prop after the shortcut", async () => {
      await render(
        <Excalidraw handleKeyboardGlobally={true} gridModeEnabled={true} />,
      );
      expect(isGridModeEnabled(h.app)).toBe(true);

      pressGridShortcut();

      expect(isGridModeEnabled(h.app)).toBe(true);
    });
  });
});
