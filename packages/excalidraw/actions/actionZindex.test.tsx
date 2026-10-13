import { CODES, reseed } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { fireEvent, queryByTestId } from "@testing-library/react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { render, unmountComponent } from "../tests/test-utils";

import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actionZindex";

import type { Action } from "./types";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

type KeyEventInit = {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

const keyTest = (action: Action, init: KeyEventInit) =>
  !!action.keyTest!(
    new KeyboardEvent("keydown", init) as any,
    h.state,
    h.elements,
    h.app,
  );

const ids = () => h.elements.map((el) => el.id);

const expectValidFractionalIndices = () => {
  const indices = h.elements.map((el) => el.index!);
  expect(indices.every(Boolean)).toBe(true);
  expect([...indices].sort()).toEqual(indices);
  expect(new Set(indices).size).toBe(indices.length);
};

// load elements without recording them in history, so that undo/redo only
// reverts what the z-index actions did
const setScene = (elements: ExcalidrawElement[]) => {
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
};

const setupABCD = (selected: string[]) => {
  const elements = ["A", "B", "C", "D"].map((id, i) =>
    API.createElement({ type: "rectangle", id, x: i * 10 }),
  );
  setScene(elements);
  API.setSelectedElements(elements.filter((el) => selected.includes(el.id)));
  return elements;
};

describe("actionZindex", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("keyTest (non-darwin)", () => {
    it("maps Ctrl+[ / Ctrl+] to one-step moves only", () => {
      const left = { code: CODES.BRACKET_LEFT, ctrlKey: true };
      const right = { code: CODES.BRACKET_RIGHT, ctrlKey: true };

      expect(keyTest(actionSendBackward, left)).toBe(true);
      expect(keyTest(actionBringForward, right)).toBe(true);

      expect(keyTest(actionSendBackward, right)).toBe(false);
      expect(keyTest(actionBringForward, left)).toBe(false);
      expect(keyTest(actionSendToBack, left)).toBe(false);
      expect(keyTest(actionBringToFront, right)).toBe(false);

      // shift turns one-step move into send-to-back / bring-to-front
      expect(keyTest(actionSendBackward, { ...left, shiftKey: true })).toBe(
        false,
      );
      expect(keyTest(actionBringForward, { ...right, shiftKey: true })).toBe(
        false,
      );
    });

    it("maps Ctrl+Shift+[ / Ctrl+Shift+] to send-to-back / bring-to-front, not Ctrl+Alt", () => {
      const left = { code: CODES.BRACKET_LEFT, ctrlKey: true };
      const right = { code: CODES.BRACKET_RIGHT, ctrlKey: true };

      expect(keyTest(actionSendToBack, { ...left, shiftKey: true })).toBe(true);
      expect(keyTest(actionBringToFront, { ...right, shiftKey: true })).toBe(
        true,
      );

      expect(keyTest(actionSendToBack, { ...left, altKey: true })).toBe(false);
      expect(keyTest(actionBringToFront, { ...right, altKey: true })).toBe(
        false,
      );
    });

    it("requires the Ctrl modifier (Meta alone does not match)", () => {
      for (const [action, code, shiftKey] of [
        [actionSendBackward, CODES.BRACKET_LEFT, false],
        [actionBringForward, CODES.BRACKET_RIGHT, false],
        [actionSendToBack, CODES.BRACKET_LEFT, true],
        [actionBringToFront, CODES.BRACKET_RIGHT, true],
      ] as const) {
        expect(keyTest(action, { code, shiftKey })).toBe(false);
        expect(keyTest(action, { code, shiftKey, metaKey: true })).toBe(false);
        expect(keyTest(action, { code, shiftKey, ctrlKey: true })).toBe(true);
      }
    });
  });

  describe("keyTest (darwin)", () => {
    afterEach(() => {
      vi.doUnmock("@excalidraw/common");
      vi.resetModules();
    });

    it("uses Cmd for all shortcuts and Cmd+Alt (not Cmd+Shift) for send-to-back / bring-to-front", async () => {
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
      const left = { code: CODES.BRACKET_LEFT, metaKey: true };
      const right = { code: CODES.BRACKET_RIGHT, metaKey: true };

      expect(keyTest(darwin.actionSendBackward, left)).toBe(true);
      expect(keyTest(darwin.actionBringForward, right)).toBe(true);
      expect(
        keyTest(darwin.actionSendBackward, {
          code: CODES.BRACKET_LEFT,
          ctrlKey: true,
        }),
      ).toBe(false);

      expect(keyTest(darwin.actionSendToBack, { ...left, altKey: true })).toBe(
        true,
      );
      expect(
        keyTest(darwin.actionBringToFront, { ...right, altKey: true }),
      ).toBe(true);

      expect(
        keyTest(darwin.actionSendToBack, { ...left, shiftKey: true }),
      ).toBe(false);
      expect(
        keyTest(darwin.actionBringToFront, { ...right, shiftKey: true }),
      ).toBe(false);
    });
  });

  describe("keyboard shortcuts", () => {
    it("Ctrl+] / Ctrl+[ move the selection by one step", () => {
      setupABCD(["B"]);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.codePress(CODES.BRACKET_RIGHT);
      });
      expect(ids()).toEqual(["A", "C", "B", "D"]);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.codePress(CODES.BRACKET_LEFT);
        Keyboard.codePress(CODES.BRACKET_LEFT);
      });
      expect(ids()).toEqual(["B", "A", "C", "D"]);
      expectValidFractionalIndices();
    });

    it("Ctrl+Shift+] / Ctrl+Shift+[ move the selection all the way", () => {
      setupABCD(["B"]);

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.codePress(CODES.BRACKET_RIGHT);
      });
      expect(ids()).toEqual(["A", "C", "D", "B"]);

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.codePress(CODES.BRACKET_LEFT);
      });
      expect(ids()).toEqual(["B", "A", "C", "D"]);
      expectValidFractionalIndices();
    });
  });

  it("preserves relative order of a non-contiguous multi-selection and keeps it selected", () => {
    setupABCD(["A", "C"]);
    const selectedBefore = { ...h.state.selectedElementIds };

    API.executeAction(actionBringToFront);
    expect(ids()).toEqual(["B", "D", "A", "C"]);

    API.executeAction(actionSendToBack);
    expect(ids()).toEqual(["A", "C", "B", "D"]);

    expect(h.state.selectedElementIds).toEqual(selectedBefore);
    expectValidFractionalIndices();
  });

  it("does nothing (and records no history) when nothing is selected", () => {
    setupABCD([]);
    const undoStackSize = API.getUndoStack().length;

    for (const action of [
      actionBringForward,
      actionSendBackward,
      actionBringToFront,
      actionSendToBack,
    ]) {
      API.executeAction(action);
    }

    expect(ids()).toEqual(["A", "B", "C", "D"]);
    expect(API.getUndoStack().length).toBe(undoStackSize);
  });

  it("is undoable and redoable as a single history entry per action", () => {
    setupABCD(["A"]);
    const undoStackSize = API.getUndoStack().length;

    API.executeAction(actionBringToFront);
    expect(ids()).toEqual(["B", "C", "D", "A"]);
    expect(API.getUndoStack().length).toBe(undoStackSize + 1);

    API.executeAction(actionSendBackward);
    expect(ids()).toEqual(["B", "C", "A", "D"]);
    expect(API.getUndoStack().length).toBe(undoStackSize + 2);

    Keyboard.undo();
    expect(ids()).toEqual(["B", "C", "D", "A"]);

    Keyboard.undo();
    expect(ids()).toEqual(["A", "B", "C", "D"]);

    Keyboard.redo();
    Keyboard.redo();
    expect(ids()).toEqual(["B", "C", "A", "D"]);
    expectValidFractionalIndices();
  });

  it("moves bound text together with its container on bring-to-front / send-to-back", () => {
    const before = API.createElement({ type: "rectangle", id: "before" });
    const [container, text] = API.createTextContainer();
    const after = API.createElement({ type: "rectangle", id: "after" });
    setScene([before, container, text, after]);
    API.setSelectedElements([container]);

    API.executeAction(actionBringToFront);
    expect(ids()).toEqual(["before", "after", container.id, text.id]);

    API.executeAction(actionSendToBack);
    expect(ids()).toEqual([container.id, text.id, "before", "after"]);
    expectValidFractionalIndices();
  });

  it("keeps a frame child within its frame and undo restores the original order", () => {
    const frame = API.createElement({ type: "frame", id: "F" });
    const child1 = API.createElement({ id: "F_1", frameId: frame.id });
    const child2 = API.createElement({ id: "F_2", frameId: frame.id });
    const outside = API.createElement({ id: "R" });
    setScene([child1, child2, frame, outside]);
    API.setSelectedElements([child1]);

    // bring-to-front moves the child to the front of its own frame (rendered
    // above the frame element), but never past elements outside the frame
    API.executeAction(actionBringToFront);
    expect(ids()).toEqual(["F_2", "F", "F_1", "R"]);
    expect(API.getElement(child1 as ExcalidrawElement).frameId).toBe(frame.id);

    Keyboard.undo();
    expect(ids()).toEqual(["F_1", "F_2", "F", "R"]);
  });

  it("exposes all four actions in the element context menu and executes them", () => {
    const [, b] = setupABCD(["B"]);

    mouse.rightClickAt(b.x + 5, b.y + 5);
    const contextMenu = UI.queryContextMenu()!;
    for (const name of [
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
    ]) {
      expect(queryByTestId(contextMenu, name)).not.toBe(null);
    }

    fireEvent.click(queryByTestId(contextMenu, "bringToFront")!);
    expect(ids()).toEqual(["A", "C", "D", "B"]);
  });
});
