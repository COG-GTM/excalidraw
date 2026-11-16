import { fireEvent, queryByTestId } from "@testing-library/react";

import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { isGridModeEnabled } from "../snapping";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import { actionToggleGridMode } from "./actionToggleGridMode";

const { h } = window;
const mouse = new Pointer("mouse");

const pressToggleGridShortcut = () => {
  fireEvent.keyDown(document, { [KEYS.CTRL_OR_CMD]: true, code: CODES.QUOTE });
};

describe("actionToggleGridMode", () => {
  describe("perform", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("enables grid mode and disables objects snap mode", () => {
      API.setAppState({ gridModeEnabled: false, objectsSnapModeEnabled: true });

      API.executeAction(actionToggleGridMode);

      expect(h.state.gridModeEnabled).toBe(true);
      expect(h.state.objectsSnapModeEnabled).toBe(false);
      expect(isGridModeEnabled(h.app)).toBe(true);
    });

    it("disables grid mode when it is enabled", () => {
      API.setAppState({ gridModeEnabled: true, objectsSnapModeEnabled: true });

      API.executeAction(actionToggleGridMode);

      expect(h.state.gridModeEnabled).toBe(false);
      expect(h.state.objectsSnapModeEnabled).toBe(false);
    });

    it("returns EVENTUALLY capture and leaves elements and gridSize untouched", () => {
      const rect = API.createElement({ type: "rectangle", x: 10, y: 10 });
      API.setElements([rect]);
      API.setAppState({ gridModeEnabled: false, gridSize: 20 });

      const result = actionToggleGridMode.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
      );

      expect(result.captureUpdate).toBe(CaptureUpdateAction.EVENTUALLY);
      expect("elements" in result).toBe(false);
      expect(result.appState?.gridModeEnabled).toBe(true);
      expect(result.appState?.gridSize).toBe(20);
      expect(h.elements).toEqual([rect]);
    });

    it("does not add an undo entry", () => {
      expect(h.history.isUndoStackEmpty).toBe(true);

      API.executeAction(actionToggleGridMode);
      API.executeAction(actionToggleGridMode);

      expect(h.state.gridModeEnabled).toBe(false);
      expect(h.history.isUndoStackEmpty).toBe(true);
      expect(h.history.isRedoStackEmpty).toBe(true);
    });
  });

  describe("checked / trackEvent", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("checked mirrors appState.gridModeEnabled", () => {
      expect(
        actionToggleGridMode.checked!({ ...h.state, gridModeEnabled: true }),
      ).toBe(true);
      expect(
        actionToggleGridMode.checked!({ ...h.state, gridModeEnabled: false }),
      ).toBe(false);
    });

    it("tracks the event only when grid mode is enabled", () => {
      const { trackEvent } = actionToggleGridMode;
      expect(trackEvent.category).toBe("canvas");
      expect(trackEvent.predicate!({ ...h.state, gridModeEnabled: true })).toBe(
        true,
      );
      expect(
        trackEvent.predicate!({ ...h.state, gridModeEnabled: false }),
      ).toBe(false);
    });
  });

  describe("predicate", () => {
    it("is enabled when the host does not control gridModeEnabled", async () => {
      await render(<Excalidraw />);

      expect(
        actionToggleGridMode.predicate!(h.elements, h.state, h.app.props),
      ).toBe(true);
    });

    it.each([true, false])(
      "is disabled when the host sets gridModeEnabled={%s}",
      async (gridModeEnabled) => {
        await render(<Excalidraw gridModeEnabled={gridModeEnabled} />);

        expect(
          actionToggleGridMode.predicate!(h.elements, h.state, h.app.props),
        ).toBe(false);
      },
    );
  });

  describe("keyTest", () => {
    it("matches Ctrl/Cmd + Quote by event.code", () => {
      expect(
        actionToggleGridMode.keyTest!(
          new KeyboardEvent("keydown", {
            [KEYS.CTRL_OR_CMD]: true,
            code: CODES.QUOTE,
          }),
        ),
      ).toBe(true);
    });

    it("ignores Quote without the modifier and other codes with it", () => {
      expect(
        actionToggleGridMode.keyTest!(
          new KeyboardEvent("keydown", { code: CODES.QUOTE }),
        ),
      ).toBe(false);
      expect(
        actionToggleGridMode.keyTest!(
          new KeyboardEvent("keydown", {
            [KEYS.CTRL_OR_CMD]: true,
            code: CODES.BRACKET_RIGHT,
          }),
        ),
      ).toBe(false);
      // `key` alone is not enough; the shortcut is layout-independent
      expect(
        actionToggleGridMode.keyTest!(
          new KeyboardEvent("keydown", {
            [KEYS.CTRL_OR_CMD]: true,
            key: "'",
          }),
        ),
      ).toBe(false);
    });
  });

  describe("keyboard shortcut", () => {
    it("toggles grid mode on and off", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      expect(h.state.gridModeEnabled).toBe(false);

      pressToggleGridShortcut();
      expect(h.state.gridModeEnabled).toBe(true);

      pressToggleGridShortcut();
      expect(h.state.gridModeEnabled).toBe(false);
    });

    it("works in view mode", async () => {
      await render(
        <Excalidraw handleKeyboardGlobally={true} viewModeEnabled={true} />,
      );
      expect(h.state.viewModeEnabled).toBe(true);

      pressToggleGridShortcut();

      expect(h.state.gridModeEnabled).toBe(true);
    });

    it("does not change the effective grid mode when the host controls it", async () => {
      await render(
        <Excalidraw handleKeyboardGlobally={true} gridModeEnabled={true} />,
      );
      expect(isGridModeEnabled(h.app)).toBe(true);

      pressToggleGridShortcut();

      expect(isGridModeEnabled(h.app)).toBe(true);
    });
  });

  describe("context menu", () => {
    it("is listed in the canvas context menu in view mode", async () => {
      await render(<Excalidraw viewModeEnabled={true} />);

      mouse.rightClickAt(0, 0);

      const item = queryByTestId(UI.queryContextMenu()!, "gridMode");
      expect(item).not.toBe(null);
      fireEvent.click(item!);
      expect(h.state.gridModeEnabled).toBe(true);
    });
  });
});
