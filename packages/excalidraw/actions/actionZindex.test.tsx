import { fireEvent, queryByTestId } from "@testing-library/react";
import React from "react";

import { CODES } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  validateFractionalIndices,
} from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actionZindex";

const { h } = window;
const mouse = new Pointer("mouse");

const ACTIONS = {
  sendBackward: actionSendBackward,
  bringForward: actionBringForward,
  sendToBack: actionSendToBack,
  bringToFront: actionBringToFront,
};

type ActionName = keyof typeof ACTIONS;

const SHORTCUTS: Record<ActionName, { code: string; shiftKey: boolean }> = {
  sendBackward: { code: CODES.BRACKET_LEFT, shiftKey: false },
  bringForward: { code: CODES.BRACKET_RIGHT, shiftKey: false },
  sendToBack: { code: CODES.BRACKET_LEFT, shiftKey: true },
  bringToFront: { code: CODES.BRACKET_RIGHT, shiftKey: true },
};

const ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

const createRects = (ids: string[]) =>
  ids.map((id, idx) =>
    API.createElement({
      type: "rectangle",
      id,
      x: idx * 200,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffc9c9",
      fillStyle: "solid",
    }),
  );

const order = () => h.elements.map((element) => element.id);

const select = (...ids: string[]) =>
  API.setSelectedElements(
    h.app.scene
      .getNonDeletedElements()
      .filter((element) => ids.includes(element.id)),
  );

const matchingActions = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", init);
  return ACTION_NAMES.filter((name) => ACTIONS[name].keyTest!(event));
};

const pressShortcut = (name: ActionName) =>
  fireEvent.keyDown(document, { ctrlKey: true, ...SHORTCUTS[name] });

describe("actionZindex", () => {
  describe("keyTest", () => {
    it.each(ACTION_NAMES)("%s matches only its own shortcut", (name) => {
      expect(matchingActions({ ctrlKey: true, ...SHORTCUTS[name] })).toEqual([
        name,
      ]);
    });

    it("requires the ctrl modifier and a bracket code", () => {
      for (const code of [CODES.BRACKET_LEFT, CODES.BRACKET_RIGHT]) {
        expect(matchingActions({ code })).toEqual([]);
        expect(matchingActions({ code, shiftKey: true })).toEqual([]);
        expect(matchingActions({ code, altKey: true })).toEqual([]);
      }
      expect(matchingActions({ ctrlKey: true, code: CODES.QUOTE })).toEqual([]);
      // `key` alone is not enough, the actions match on `code`
      expect(matchingActions({ ctrlKey: true, key: "[" })).toEqual([]);
      expect(matchingActions({ ctrlKey: true, key: "]" })).toEqual([]);
    });

    describe("on darwin", () => {
      afterEach(() => {
        vi.doUnmock("@excalidraw/common");
        vi.resetModules();
      });

      it("uses cmd for one-step moves and cmd+alt for moves to the ends", async () => {
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

        const module = await import("./actionZindex");
        const darwinActions = {
          sendBackward: module.actionSendBackward,
          bringForward: module.actionBringForward,
          sendToBack: module.actionSendToBack,
          bringToFront: module.actionBringToFront,
        };

        const matching = (init: KeyboardEventInit) => {
          const event = new KeyboardEvent("keydown", init);
          return ACTION_NAMES.filter((name) =>
            darwinActions[name].keyTest!(event),
          );
        };

        expect(matching({ metaKey: true, code: CODES.BRACKET_LEFT })).toEqual([
          "sendBackward",
        ]);
        expect(matching({ metaKey: true, code: CODES.BRACKET_RIGHT })).toEqual([
          "bringForward",
        ]);
        expect(
          matching({ metaKey: true, altKey: true, code: CODES.BRACKET_LEFT }),
        ).toContain("sendToBack");
        expect(
          matching({ metaKey: true, altKey: true, code: CODES.BRACKET_RIGHT }),
        ).toContain("bringToFront");

        // cmd+shift is the non-darwin shortcut and must not move to the ends
        expect(
          matching({ metaKey: true, shiftKey: true, code: CODES.BRACKET_LEFT }),
        ).toEqual([]);
        expect(
          matching({
            metaKey: true,
            shiftKey: true,
            code: CODES.BRACKET_RIGHT,
          }),
        ).toEqual([]);
        // ctrl is not the primary modifier on darwin
        expect(matching({ ctrlKey: true, code: CODES.BRACKET_LEFT })).toEqual(
          [],
        );
      });
    });
  });

  describe("keyboard dispatch", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      API.setElements(createRects(["A", "B", "C", "D"]));
    });

    it.each([
      ["sendBackward", "C", ["A", "C", "B", "D"]],
      ["bringForward", "B", ["A", "C", "B", "D"]],
      ["sendToBack", "C", ["C", "A", "B", "D"]],
      ["bringToFront", "B", ["A", "C", "D", "B"]],
    ] as [ActionName, string, string[]][])(
      "%s shortcut reorders the selected element",
      (name, selectedId, expected) => {
        select(selectedId);

        pressShortcut(name);

        expect(order()).toEqual(expected);
        expect(h.state.selectedElementIds).toEqual({ [selectedId]: true });
      },
    );

    it("does not reorder when the bracket key is pressed without ctrl", () => {
      select("B");

      fireEvent.keyDown(document, { code: CODES.BRACKET_RIGHT });
      fireEvent.keyDown(document, { code: CODES.BRACKET_LEFT, shiftKey: true });

      expect(order()).toEqual(["A", "B", "C", "D"]);
    });

    it("does not reorder in view mode", () => {
      select("B");
      API.setAppState({ viewModeEnabled: true });

      ACTION_NAMES.forEach(pressShortcut);

      expect(order()).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("perform", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it.each(ACTION_NAMES)(
      "%s is a no-op without a selection and records no history",
      (name) => {
        const elements = createRects(["A", "B", "C"]);
        API.updateScene({
          elements,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        const before = h.elements.map(({ id, index, version }) => ({
          id,
          index,
          version,
        }));

        API.executeAction(ACTIONS[name]);

        expect(
          h.elements.map(({ id, index, version }) => ({ id, index, version })),
        ).toEqual(before);
        expect(API.getUndoStack().length).toBe(0);
      },
    );

    it.each([
      ["sendBackward", "A"],
      ["sendToBack", "A"],
      ["bringForward", "C"],
      ["bringToFront", "C"],
    ] as [ActionName, string][])(
      "%s on an element already at the boundary leaves elements untouched",
      (name, selectedId) => {
        API.updateScene({
          elements: createRects(["A", "B", "C"]),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        select(selectedId);
        const before = h.elements.map(({ id, index, version }) => ({
          id,
          index,
          version,
        }));

        API.executeAction(ACTIONS[name]);

        expect(
          h.elements.map(({ id, index, version }) => ({ id, index, version })),
        ).toEqual(before);
        // the only thing captured is the preceding selection change
        for (const entry of API.getUndoStack()) {
          expect(entry.elements.isEmpty()).toBe(true);
        }
      },
    );

    it.each([
      ["sendBackward", "C", ["A", "C", "B", "D"]],
      ["bringForward", "B", ["A", "C", "B", "D"]],
      ["sendToBack", "C", ["C", "A", "B", "D"]],
      ["bringToFront", "B", ["A", "C", "D", "B"]],
    ] as [ActionName, string, string[]][])(
      "%s only touches the moved element and keeps fractional indices valid",
      (name, selectedId, expected) => {
        API.setElements(createRects(["A", "B", "C", "D"]));
        select(selectedId);
        // elements are mutated in place, so snapshot the values
        const before = new Map(
          h.elements.map(({ id, index, version }) => [id, { index, version }]),
        );

        API.executeAction(ACTIONS[name]);

        expect(order()).toEqual(expected);
        expect(() =>
          validateFractionalIndices(h.elements, {
            shouldThrow: true,
            includeBoundTextValidation: true,
          }),
        ).not.toThrow();

        for (const element of h.elements) {
          const prev = before.get(element.id)!;
          if (element.id === selectedId) {
            expect(element.index).not.toBe(prev.index);
            expect(element.version).toBeGreaterThan(prev.version);
          } else {
            expect(element.index).toBe(prev.index);
            expect(element.version).toBe(prev.version);
          }
        }
      },
    );

    it("moves locked elements that are selected", () => {
      const elements = createRects(["A", "B", "C"]);
      API.setElements([
        { ...elements[0], locked: true },
        elements[1],
        elements[2],
      ]);
      select("A");

      API.executeAction(actionBringToFront);
      expect(order()).toEqual(["B", "C", "A"]);
      expect(h.elements[2].locked).toBe(true);

      API.executeAction(actionSendBackward);
      expect(order()).toEqual(["B", "A", "C"]);
    });

    it("keeps deleted elements in the scene when moving to the ends", () => {
      const elements = createRects(["A", "B", "C", "D"]);
      API.setElements([
        { ...elements[0], isDeleted: true },
        elements[1],
        elements[2],
        { ...elements[3], isDeleted: true },
      ]);
      select("B");

      API.executeAction(actionBringToFront);
      expect([...order()].sort()).toEqual(["A", "B", "C", "D"]);
      expect(order().indexOf("B")).toBeGreaterThan(order().indexOf("C"));

      API.executeAction(actionSendToBack);
      expect([...order()].sort()).toEqual(["A", "B", "C", "D"]);
      expect(order().indexOf("B")).toBeLessThan(order().indexOf("C"));
      expect(
        h.elements.filter((element) => element.isDeleted).map(({ id }) => id),
      ).toEqual(expect.arrayContaining(["A", "D"]));
    });
  });

  describe("history", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      API.updateScene({
        elements: createRects(["A", "B", "C", "D"]),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    it.each([
      ["sendBackward", "C", ["A", "C", "B", "D"]],
      ["bringForward", "B", ["A", "C", "B", "D"]],
      ["sendToBack", "C", ["C", "A", "B", "D"]],
      ["bringToFront", "B", ["A", "C", "D", "B"]],
    ] as [ActionName, string, string[]][])(
      "%s records exactly one undo entry; undo restores and redo reapplies",
      (name, selectedId, expected) => {
        select(selectedId);
        expect(API.getUndoStack().length).toBe(0);

        API.executeAction(ACTIONS[name]);
        expect(order()).toEqual(expected);
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);

        Keyboard.undo();
        expect(order()).toEqual(["A", "B", "C", "D"]);
        expect(h.elements.every((element) => !element.isDeleted)).toBe(true);
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);

        Keyboard.redo();
        expect(order()).toEqual(expected);
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
      },
    );

    it("undoes consecutive moves one step at a time", () => {
      select("A");

      API.executeAction(actionBringForward);
      API.executeAction(actionBringForward);
      API.executeAction(actionBringToFront);
      expect(order()).toEqual(["B", "C", "D", "A"]);
      expect(API.getUndoStack().length).toBe(3);

      Keyboard.undo();
      expect(order()).toEqual(["B", "C", "A", "D"]);
      Keyboard.undo();
      expect(order()).toEqual(["B", "A", "C", "D"]);
      Keyboard.undo();
      expect(order()).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("UI", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      API.setElements(createRects(["A", "B", "C", "D"]));
    });

    const queryButton = (label: string) =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>("button.zIndexButton"),
      ).find((button) => button.title.startsWith(label));

    it("renders the layer buttons with shortcut titles only when something is selected", () => {
      expect(document.querySelector("button.zIndexButton")).toBe(null);

      select("B");

      expect(
        Array.from(
          document.querySelectorAll<HTMLButtonElement>("button.zIndexButton"),
        ).map((button) => button.title),
      ).toEqual([
        "Send to back — Ctrl+Shift+[",
        "Send backward — Ctrl+[",
        "Bring forward — Ctrl+]",
        "Bring to front — Ctrl+Shift+]",
      ]);
    });

    it.each([
      ["Send backward", "C", ["A", "C", "B", "D"]],
      ["Bring forward", "B", ["A", "C", "B", "D"]],
      ["Send to back", "C", ["C", "A", "B", "D"]],
      ["Bring to front", "B", ["A", "C", "D", "B"]],
    ])(
      "%s panel button reorders the selection",
      (label, selectedId, expected) => {
        select(selectedId);

        act(() => {
          fireEvent.click(queryButton(label)!);
        });

        expect(order()).toEqual(expected);
      },
    );

    it.each([
      ["sendBackward", ["B", "A", "C", "D"]],
      ["bringForward", ["A", "C", "B", "D"]],
      ["sendToBack", ["B", "A", "C", "D"]],
      ["bringToFront", ["A", "C", "D", "B"]],
    ] as [ActionName, string[]][])(
      "%s context menu item reorders the right-clicked element",
      (name, expected) => {
        // B spans x: 200..300
        mouse.rightClickAt(250, 50);
        expect(h.state.selectedElementIds).toEqual({ B: true });

        const item = queryByTestId(UI.queryContextMenu()!, name);
        expect(item).not.toBe(null);

        fireEvent.click(item!.querySelector("button")!);

        expect(order()).toEqual(expected);
        expect(UI.queryContextMenu()).toBe(null);
      },
    );
  });
});
