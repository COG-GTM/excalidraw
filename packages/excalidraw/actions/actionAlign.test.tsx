import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render, unmountComponent } from "../tests/test-utils";

import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
  actionAlignVerticallyCentered,
} from "./actionAlign";

import type { Action } from "./types";

const { h } = window;

const ALL_ALIGN_ACTIONS = [
  actionAlignTop,
  actionAlignBottom,
  actionAlignLeft,
  actionAlignRight,
  actionAlignVerticallyCentered,
  actionAlignHorizontallyCentered,
];

const isEnabled = (action: Action) =>
  h.app.actionManager.isActionEnabled(action);

const keyEvent = (
  key: string,
  modifiers: { ctrlOrCmd?: boolean; shift?: boolean } = {},
) =>
  ({
    key,
    shiftKey: !!modifiers.shift,
    ctrlKey: false,
    metaKey: false,
    [KEYS.CTRL_OR_CMD]: !!modifiers.ctrlOrCmd,
  } as unknown as KeyboardEvent);

const testKey = (action: Action, event: KeyboardEvent) =>
  action.keyTest?.(event, h.state, h.elements, h.app) ?? false;

describe("actionAlign", () => {
  beforeEach(async () => {
    unmountComponent();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("predicate", () => {
    it("is disabled for every align action with nothing or a single element selected", () => {
      const rect = API.createElement({ type: "rectangle", x: 0, y: 0 });
      API.setElements([rect]);

      for (const action of ALL_ALIGN_ACTIONS) {
        expect(isEnabled(action)).toBe(false);
      }

      API.setSelectedElements([rect]);

      for (const action of ALL_ALIGN_ACTIONS) {
        expect(isEnabled(action)).toBe(false);
      }
    });

    it("is enabled for every align action with two independent elements selected", () => {
      const rect1 = API.createElement({ type: "rectangle", x: 0, y: 0 });
      const rect2 = API.createElement({ type: "rectangle", x: 50, y: 50 });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      for (const action of ALL_ALIGN_ACTIONS) {
        expect(isEnabled(action)).toBe(true);
      }
    });

    it("treats a container and its bound text as a single unit (disabled)", () => {
      const [container, text] = API.createTextContainer();
      API.setElements([container, text]);
      API.setSelectedElements([container, text]);

      for (const action of ALL_ALIGN_ACTIONS) {
        expect(isEnabled(action)).toBe(false);
      }
    });

    it("is enabled for a single selected group with multiple members (aligns within the group)", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        groupIds: ["g1"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 50,
        y: 50,
        groupIds: ["g1"],
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(h.state.selectedGroupIds).toEqual({ g1: true });
      for (const action of ALL_ALIGN_ACTIONS) {
        expect(isEnabled(action)).toBe(true);
      }
    });

    it("is disabled when a frame is part of the selection", () => {
      const frame = API.createElement({
        type: "frame",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      });
      const rect = API.createElement({ type: "rectangle", x: 300, y: 300 });
      API.setElements([frame, rect]);
      API.setSelectedElements([frame, rect]);

      for (const action of ALL_ALIGN_ACTIONS) {
        expect(isEnabled(action)).toBe(false);
      }
    });

    it("stays disabled when select-all only picks up one unlocked element", () => {
      const unlocked = API.createElement({ type: "rectangle", x: 0, y: 0 });
      const locked = API.createElement({
        type: "rectangle",
        x: 200,
        y: 200,
        locked: true,
      });
      API.setElements([unlocked, locked]);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.A);
      });

      expect(h.state.selectedElementIds).toEqual({ [unlocked.id]: true });
      for (const action of ALL_ALIGN_ACTIONS) {
        expect(isEnabled(action)).toBe(false);
      }
    });
  });

  describe("keyTest", () => {
    it("maps CtrlOrCmd+Shift+Arrow to the matching edge alignment", () => {
      const mapping: [Action, string][] = [
        [actionAlignTop, KEYS.ARROW_UP],
        [actionAlignBottom, KEYS.ARROW_DOWN],
        [actionAlignLeft, KEYS.ARROW_LEFT],
        [actionAlignRight, KEYS.ARROW_RIGHT],
      ];

      for (const [action, key] of mapping) {
        for (const [otherAction, otherKey] of mapping) {
          expect(
            testKey(
              otherAction,
              keyEvent(key, { ctrlOrCmd: true, shift: true }),
            ),
          ).toBe(otherKey === key);
        }
        expect(testKey(action, keyEvent(key, { ctrlOrCmd: true }))).toBe(false);
        expect(testKey(action, keyEvent(key, { shift: true }))).toBe(false);
      }
    });

    it("has no keyboard shortcut for the center alignments", () => {
      expect(actionAlignVerticallyCentered.keyTest).toBeUndefined();
      expect(actionAlignHorizontallyCentered.keyTest).toBeUndefined();
    });
  });

  describe("perform", () => {
    it("aligns multiple groups as units against the common bounding box", () => {
      const a1 = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        groupIds: ["ga"],
      });
      const a2 = API.createElement({
        type: "rectangle",
        x: 60,
        y: 60,
        width: 50,
        height: 50,
        groupIds: ["ga"],
      });
      const b1 = API.createElement({
        type: "rectangle",
        x: 300,
        y: 200,
        width: 40,
        height: 40,
        groupIds: ["gb"],
      });
      const b2 = API.createElement({
        type: "rectangle",
        x: 300,
        y: 260,
        width: 40,
        height: 40,
        groupIds: ["gb"],
      });
      const loose = API.createElement({
        type: "rectangle",
        x: 150,
        y: 400,
        width: 20,
        height: 20,
      });
      API.setElements([a1, a2, b1, b2, loose]);
      API.setSelectedElements([a1, a2, b1, b2, loose]);

      expect(isEnabled(actionAlignBottom)).toBe(true);
      API.executeAction(actionAlignBottom);

      // selection bottom edge is 420 (loose element)
      const byId = (id: string) => h.elements.find((el) => el.id === id)!;
      // group A spans y 0..110 -> shifted by 310, keeping relative offsets
      expect(byId(a1.id).y).toBe(310);
      expect(byId(a2.id).y).toBe(370);
      // group B spans y 200..300 -> shifted by 120
      expect(byId(b1.id).y).toBe(320);
      expect(byId(b2.id).y).toBe(380);
      expect(byId(loose.id).y).toBe(400);
      // x is untouched by a vertical-axis alignment
      expect([a1, a2, b1, b2, loose].map((el) => byId(el.id).x)).toEqual([
        0, 60, 300, 300, 150,
      ]);
    });

    it("moves bound text together with its container", () => {
      const [container, text] = API.createTextContainer();
      API.updateElement(container, { x: 0, y: 0 });
      const other = API.createElement({
        type: "rectangle",
        x: 400,
        y: 300,
        width: 100,
        height: 100,
      });
      API.setElements([container, text, other]);
      API.setSelectedElements([container, other]);

      const textOffset = {
        x: h.elements[1].x - h.elements[0].x,
        y: h.elements[1].y - h.elements[0].y,
      };

      API.executeAction(actionAlignRight);

      const [newContainer, newText, newOther] = h.elements;
      expect(newContainer.x + newContainer.width).toBe(
        newOther.x + newOther.width,
      );
      expect(newText.x - newContainer.x).toBeCloseTo(textOffset.x);
      expect(newText.y - newContainer.y).toBeCloseTo(textOffset.y);
    });

    it("keeps frame membership for elements aligned within their frame", () => {
      const frame = API.createElement({
        type: "frame",
        x: 0,
        y: 0,
        width: 400,
        height: 400,
      });
      const rect1 = API.createElement({
        type: "rectangle",
        x: 20,
        y: 20,
        width: 50,
        height: 50,
        frameId: frame.id,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        frameId: frame.id,
      });
      API.setElements([frame, rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(isEnabled(actionAlignHorizontallyCentered)).toBe(true);
      API.executeAction(actionAlignHorizontallyCentered);

      const [, newRect1, newRect2] = h.elements;
      // selection spans x 20..300 -> center 160
      expect(newRect1.x).toBe(135);
      expect(newRect2.x).toBe(110);
      expect(newRect1.frameId).toBe(frame.id);
      expect(newRect2.frameId).toBe(frame.id);
      expect(h.elements[0].x).toBe(0);
    });
  });

  describe("history", () => {
    it("records a single undoable step that restores the original positions", async () => {
      const rect1 = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        x: 200,
        y: 300,
        width: 50,
        height: 50,
      });
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: "IMMEDIATELY",
      });
      API.setSelectedElements([rect1, rect2]);

      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionAlignVerticallyCentered);

      expect(h.elements.map((el) => el.y)).toEqual([125, 150]);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);

      await act(async () => {
        Keyboard.undo();
      });
      expect(h.elements.map((el) => [el.x, el.y])).toEqual([
        [0, 0],
        [200, 300],
      ]);

      await act(async () => {
        Keyboard.redo();
      });
      expect(h.elements.map((el) => el.y)).toEqual([125, 150]);
    });
  });
});
