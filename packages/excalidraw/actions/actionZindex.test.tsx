import { fireEvent, queryByTestId } from "@testing-library/react";
import React from "react";

import { CODES } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actionZindex";

const { h } = window;
const mouse = new Pointer("mouse");

const ids = () => h.elements.map((element) => element.id);

const createScene = () => {
  const elements = ["A", "B", "C", "D"].map((id, i) =>
    API.createElement({
      id,
      type: "rectangle",
      x: i * 150,
      y: 0,
      width: 100,
      height: 100,
    }),
  );
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
  return h.elements;
};

const select = (...elementIds: string[]) => {
  API.setSelectedElements(
    h.elements.filter(
      (element): element is NonDeletedExcalidrawElement =>
        !element.isDeleted && elementIds.includes(element.id),
    ),
  );
};

const keyEvent = (init: KeyboardEventInit) =>
  new h.app.ownerWindow.KeyboardEvent("keydown", init);

const expectSortedIndices = (elements: readonly ExcalidrawElement[]) => {
  const indices = elements.map((element) => element.index!);
  expect(indices).toEqual([...indices].sort());
  expect(new Set(indices).size).toBe(indices.length);
};

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("actionZindex", () => {
  describe("registration", () => {
    it("registers all four actions with labels, keywords and tracking", () => {
      const actions = [
        actionSendBackward,
        actionBringForward,
        actionSendToBack,
        actionBringToFront,
      ];
      expect(actions.map((action) => action.name)).toEqual([
        "sendBackward",
        "bringForward",
        "sendToBack",
        "bringToFront",
      ]);
      for (const action of actions) {
        expect(action.label).toBe(`labels.${action.name}`);
        expect(action.keywords).toContain("zindex");
        expect(action.keywords).toContain("layer");
        expect(action.trackEvent).toEqual({ category: "element" });
        expect(action.icon).toBeDefined();
        expect(h.app.actionManager.actions[action.name]).toBe(action);
      }
    });

    it("gives the one-step actions a higher key priority than the to-back/front actions", () => {
      expect(actionSendBackward.keyPriority).toBe(40);
      expect(actionBringForward.keyPriority).toBe(40);
      expect(
        h.app.actionManager.actions.sendToBack.keyPriority,
      ).toBeUndefined();
      expect(
        h.app.actionManager.actions.bringToFront.keyPriority,
      ).toBeUndefined();
    });
  });

  describe("keyTest (non-darwin)", () => {
    it.each([
      [
        actionSendBackward.name,
        actionSendBackward,
        { ctrlKey: true, code: CODES.BRACKET_LEFT },
      ],
      [
        actionBringForward.name,
        actionBringForward,
        { ctrlKey: true, code: CODES.BRACKET_RIGHT },
      ],
      [
        actionSendToBack.name,
        actionSendToBack,
        { ctrlKey: true, shiftKey: true, code: CODES.BRACKET_LEFT },
      ],
      [
        actionBringToFront.name,
        actionBringToFront,
        { ctrlKey: true, shiftKey: true, code: CODES.BRACKET_RIGHT },
      ],
    ] as const)("%s matches only its own shortcut", (_name, action, init) => {
      const all = [
        actionSendBackward,
        actionBringForward,
        actionSendToBack,
        actionBringToFront,
      ];
      const event = keyEvent(init);
      expect(all.filter((candidate) => candidate.keyTest!(event))).toEqual([
        action,
      ]);
      expect(action.keyTest!(keyEvent({ ...init, ctrlKey: false }))).toBe(
        false,
      );
    });
  });

  describe("keyTest (darwin)", () => {
    afterEach(() => {
      vi.doUnmock("@excalidraw/common");
      vi.resetModules();
    });

    it("uses CtrlOrCmd+Alt for send to back / bring to front", async () => {
      vi.resetModules();
      vi.doMock("@excalidraw/common", async (importOriginal) => {
        const module = await importOriginal<
          typeof import("@excalidraw/common")
        >();
        return {
          ...module,
          isDarwin: true,
          KEYS: { ...module.KEYS, CTRL_OR_CMD: "metaKey" },
        };
      });
      const darwin = await import("./actionZindex");

      const cmdAlt = { metaKey: true, altKey: true };
      const cmdShift = { metaKey: true, shiftKey: true };

      expect(
        darwin.actionSendToBack.keyTest!(
          keyEvent({ ...cmdAlt, code: CODES.BRACKET_LEFT }),
        ),
      ).toBe(true);
      expect(
        darwin.actionBringToFront.keyTest!(
          keyEvent({ ...cmdAlt, code: CODES.BRACKET_RIGHT }),
        ),
      ).toBe(true);
      expect(
        darwin.actionSendToBack.keyTest!(
          keyEvent({ ...cmdShift, code: CODES.BRACKET_LEFT }),
        ),
      ).toBe(false);
      expect(
        darwin.actionBringToFront.keyTest!(
          keyEvent({ ...cmdShift, code: CODES.BRACKET_RIGHT }),
        ),
      ).toBe(false);
      expect(
        darwin.actionSendBackward.keyTest!(
          keyEvent({ metaKey: true, code: CODES.BRACKET_LEFT }),
        ),
      ).toBe(true);
      expect(
        darwin.actionSendBackward.keyTest!(
          keyEvent({ ctrlKey: true, code: CODES.BRACKET_LEFT }),
        ),
      ).toBe(false);
    });
  });

  describe("perform", () => {
    it.each([
      [actionSendBackward.name, actionSendBackward, ["A", "C", "B", "D"]],
      [actionBringForward.name, actionBringForward, ["A", "B", "D", "C"]],
      [actionSendToBack.name, actionSendToBack, ["C", "A", "B", "D"]],
      [actionBringToFront.name, actionBringToFront, ["A", "B", "D", "C"]],
    ] as const)(
      "%s reorders the selected element and keeps fractional indices valid",
      (_name, action, expected) => {
        createScene();
        select("C");
        const selectedElementIds = h.state.selectedElementIds;

        API.executeAction(action);

        expect(ids()).toEqual(expected);
        expectSortedIndices(h.elements);
        expect(h.state.selectedElementIds).toEqual(selectedElementIds);
      },
    );

    it("moves a multi-selection together", () => {
      createScene();
      select("A", "C");

      API.executeAction(actionBringToFront);
      expect(ids()).toEqual(["B", "D", "A", "C"]);

      API.executeAction(actionSendToBack);
      expect(ids()).toEqual(["A", "C", "B", "D"]);
    });

    it("is a no-op at the stack boundaries and without a selection", () => {
      createScene();

      API.executeAction(actionBringToFront);
      expect(ids()).toEqual(["A", "B", "C", "D"]);

      select("A");
      API.executeAction(actionSendBackward);
      API.executeAction(actionSendToBack);
      expect(ids()).toEqual(["A", "B", "C", "D"]);

      select("D");
      API.executeAction(actionBringForward);
      API.executeAction(actionBringToFront);
      expect(ids()).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("keyboard", () => {
    it.each([
      [{ ctrl: true }, CODES.BRACKET_LEFT, ["A", "C", "B", "D"]],
      [{ ctrl: true }, CODES.BRACKET_RIGHT, ["A", "B", "D", "C"]],
      [{ ctrl: true, shift: true }, CODES.BRACKET_LEFT, ["C", "A", "B", "D"]],
      [{ ctrl: true, shift: true }, CODES.BRACKET_RIGHT, ["A", "B", "D", "C"]],
    ] as const)(
      "%j + %s dispatches the matching action",
      (modifiers, code, expected) => {
        createScene();
        select("C");

        Keyboard.withModifierKeys(modifiers, () => {
          Keyboard.codePress(code);
        });

        expect(ids()).toEqual(expected);
      },
    );
  });

  describe("history", () => {
    it.each([
      [actionSendBackward.name, actionSendBackward, ["A", "C", "B", "D"]],
      [actionBringForward.name, actionBringForward, ["A", "B", "D", "C"]],
      [actionSendToBack.name, actionSendToBack, ["C", "A", "B", "D"]],
      [actionBringToFront.name, actionBringToFront, ["A", "B", "D", "C"]],
    ] as const)(
      "%s records one undo entry that undo reverts and redo reapplies",
      (_name, action, expected) => {
        createScene();
        select("C");
        const undoDepth = h.history.undoStack.length;

        API.executeAction(action);
        expect(h.history.undoStack.length).toBe(undoDepth + 1);

        Keyboard.undo();
        expect(ids()).toEqual(["A", "B", "C", "D"]);
        expect(h.elements.every((element) => !element.isDeleted)).toBe(true);
        expectSortedIndices(h.elements);

        Keyboard.redo();
        expect(ids()).toEqual(expected);
        expectSortedIndices(h.elements);
      },
    );
  });

  describe("UI", () => {
    it("renders the layer buttons with shortcut titles and runs the action on click", () => {
      createScene();
      select("C");

      const button = (title: string) =>
        document.querySelector<HTMLButtonElement>(
          `button.zIndexButton[title="${title}"]`,
        );

      expect(button("Send backward — Ctrl+[")).not.toBe(null);
      expect(button("Bring forward — Ctrl+]")).not.toBe(null);
      expect(button("Send to back — Ctrl+Shift+[")).not.toBe(null);
      expect(button("Bring to front — Ctrl+Shift+]")).not.toBe(null);

      fireEvent.click(button("Send to back — Ctrl+Shift+[")!);
      expect(ids()).toEqual(["C", "A", "B", "D"]);

      fireEvent.click(button("Bring forward — Ctrl+]")!);
      expect(ids()).toEqual(["A", "C", "B", "D"]);
    });

    it("runs bring to front from the element context menu", () => {
      createScene();
      select("A");

      mouse.rightClickAt(50, 50);
      const item = queryByTestId(UI.queryContextMenu()!, "bringToFront");
      expect(item).not.toBe(null);

      fireEvent.click(item!);
      expect(ids()).toEqual(["B", "C", "D", "A"]);
    });
  });
});
