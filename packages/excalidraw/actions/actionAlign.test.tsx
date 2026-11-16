import { fireEvent, queryByLabelText } from "@testing-library/react";

import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
  actionAlignVerticallyCentered,
} from "./actionAlign";

import type { Action, ActionResult } from "./types";

const { h } = window;

const createRects = () => [
  API.createElement({ id: "A", x: 0, y: 0, width: 100, height: 100 }),
  API.createElement({ id: "B", x: 200, y: 50, width: 50, height: 150 }),
];

const getById = (id: string) =>
  h.elements.find((el) => el.id === id)! as NonDeletedExcalidrawElement;

const selectAll = () =>
  API.setSelectedElements(h.elements as NonDeletedExcalidrawElement[]);

const isEnabled = (
  action: Action,
  elements: readonly ExcalidrawElement[] = h.elements,
) => action.predicate!(elements, h.state, h.app.props, h.app);

const keyEvent = (
  key: string,
  modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {},
) =>
  new KeyboardEvent("keydown", {
    key,
    ctrlKey: modifiers.ctrlKey ?? true,
    shiftKey: modifiers.shiftKey ?? true,
  });

beforeEach(async () => {
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("actionAlign predicate", () => {
  it("is disabled with no selection or a single selected element", () => {
    API.setElements(createRects());
    expect(isEnabled(actionAlignTop)).toBe(false);

    API.setSelectedElements([getById("A")]);
    expect(isEnabled(actionAlignTop)).toBe(false);
  });

  it("is enabled for all six align actions with two selected elements", () => {
    API.setElements(createRects());
    selectAll();

    for (const action of [
      actionAlignTop,
      actionAlignBottom,
      actionAlignLeft,
      actionAlignRight,
      actionAlignVerticallyCentered,
      actionAlignHorizontallyCentered,
    ]) {
      expect(isEnabled(action)).toBe(true);
    }
  });

  it("is enabled for a single selected group (aligns its members)", () => {
    API.setElements(createRects().map((el) => ({ ...el, groupIds: ["g1"] })));
    selectAll();

    expect(h.state.selectedGroupIds).toEqual({ g1: true });
    expect(isEnabled(actionAlignLeft)).toBe(true);
  });

  it("is disabled when a frame is part of the selection", () => {
    const frame = API.createElement({
      type: "frame",
      id: "F",
      x: 400,
      y: 0,
      width: 200,
      height: 200,
    });
    API.setElements([...createRects(), frame]);
    selectAll();

    expect(isEnabled(actionAlignTop)).toBe(false);
    expect(isEnabled(actionAlignHorizontallyCentered)).toBe(false);
  });
});

describe("actionAlign keyTest", () => {
  it("maps CtrlOrCmd+Shift+Arrow to the four edge alignments", () => {
    const cases = [
      [actionAlignTop, KEYS.ARROW_UP],
      [actionAlignBottom, KEYS.ARROW_DOWN],
      [actionAlignLeft, KEYS.ARROW_LEFT],
      [actionAlignRight, KEYS.ARROW_RIGHT],
    ] as const;

    for (const [action, key] of cases) {
      expect(action.keyTest!(keyEvent(key))).toBe(true);
      expect(action.keyTest!(keyEvent(key, { shiftKey: false }))).toBe(false);
      expect(action.keyTest!(keyEvent(key, { ctrlKey: false }))).toBe(false);
      for (const [, otherKey] of cases) {
        if (otherKey !== key) {
          expect(action.keyTest!(keyEvent(otherKey))).toBe(false);
        }
      }
    }
  });

  it("has no keyboard shortcut for the center alignments", () => {
    expect(actionAlignVerticallyCentered.keyTest).toBeUndefined();
    expect(actionAlignHorizontallyCentered.keyTest).toBeUndefined();
  });

  it("does not align when the shortcut is pressed with fewer than two selected elements", () => {
    API.setElements(createRects());
    API.setSelectedElements([getById("B")]);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    expect(getById("B").y).toBe(50);
  });
});

describe("actionAlign perform", () => {
  it("returns the unchanged appState with an IMMEDIATELY capture", () => {
    API.setElements(createRects());
    selectAll();

    const appState = h.state;
    let result = false as ActionResult;
    act(() => {
      result = actionAlignTop.perform(
        h.app.scene.getElementsIncludingDeleted(),
        appState,
        null,
        h.app,
      );
    });

    expect(result).not.toBe(false);
    if (result) {
      expect(result.appState).toBe(appState);
      expect(result.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
      expect(result.elements!.find((el) => el.id === "B")!.y).toBe(0);
    }
  });

  it("only moves selected elements", () => {
    API.setElements([
      ...createRects(),
      API.createElement({ id: "C", x: 500, y: 300, width: 10, height: 10 }),
    ]);
    API.setSelectedElements([getById("A"), getById("B")]);

    API.executeAction(actionAlignBottom);

    expect(getById("A").y).toBe(100);
    expect(getById("B").y).toBe(50);
    expect(getById("C")).toMatchObject({ x: 500, y: 300 });
  });

  it("keeps frame membership when aligning elements inside a frame", () => {
    const frame = API.createElement({
      type: "frame",
      id: "F",
      x: -50,
      y: -50,
      width: 400,
      height: 400,
    });
    API.setElements([
      frame,
      ...createRects().map((el) => ({ ...el, frameId: "F" })),
    ]);
    API.setSelectedElements([getById("A"), getById("B")]);

    API.executeAction(actionAlignRight);

    expect(getById("A").x).toBe(150);
    expect(getById("B").x).toBe(200);
    expect(getById("A").frameId).toBe("F");
    expect(getById("B").frameId).toBe("F");
  });
});

describe("actionAlign history", () => {
  it("records exactly one undo entry; undo restores and redo reapplies", () => {
    API.updateScene({
      elements: createRects(),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    selectAll();
    const undoStackSize = h.history.undoStack.length;

    API.executeAction(actionAlignHorizontallyCentered);

    expect(h.history.undoStack.length).toBe(undoStackSize + 1);
    expect(getById("A").x).toBe(75);
    expect(getById("B").x).toBe(100);

    Keyboard.undo();
    expect(getById("A").x).toBe(0);
    expect(getById("B").x).toBe(200);
    expect(getById("A").isDeleted).toBe(false);

    Keyboard.redo();
    expect(getById("A").x).toBe(75);
    expect(getById("B").x).toBe(100);
  });
});

describe("actionAlign PanelComponent", () => {
  it("renders align buttons for a multi-selection and aligns on click", () => {
    API.setElements(createRects());
    selectAll();

    const button = queryByLabelText(document.body, "Center vertically");
    expect(button).not.toBe(null);

    fireEvent.click(button!);

    expect(getById("A").y).toBe(50);
    expect(getById("B").y).toBe(25);
  });

  it("does not render align buttons for a single selected element", () => {
    API.setElements(createRects());
    API.setSelectedElements([getById("A")]);

    expect(queryByLabelText(document.body, "Align top")).toBe(null);
  });
});
