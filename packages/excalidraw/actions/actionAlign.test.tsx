import { fireEvent } from "@testing-library/react";

import { CaptureUpdateAction } from "@excalidraw/element";
import { KEYS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

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
  alignActionsPredicate,
} from "./actionAlign";

const { h } = window;

const alignActions = [
  actionAlignTop,
  actionAlignBottom,
  actionAlignLeft,
  actionAlignRight,
  actionAlignVerticallyCentered,
  actionAlignHorizontallyCentered,
];

const createRects = () => {
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
    height: 60,
  });
  const rect3 = API.createElement({
    type: "rectangle",
    x: 500,
    y: 600,
    width: 80,
    height: 40,
  });
  return [rect1, rect2, rect3] as const;
};

const positions = (elements: readonly ExcalidrawElement[] = h.elements) =>
  elements.map((el) => [el.x, el.y]);

const keyEvent = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", init);

describe("actionAlign", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("predicate", () => {
    it("is disabled with no selection or a single selected element", () => {
      const [rect1, rect2] = createRects();
      API.setElements([rect1, rect2]);

      expect(alignActionsPredicate(h.state, h.app)).toBe(false);

      API.setSelectedElements([rect1]);

      expect(alignActionsPredicate(h.state, h.app)).toBe(false);
      for (const action of alignActions) {
        expect(action.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
          false,
        );
      }
    });

    it("is enabled for every align action when two elements are selected", () => {
      const [rect1, rect2] = createRects();
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(alignActionsPredicate(h.state, h.app)).toBe(true);
      for (const action of alignActions) {
        expect(action.predicate!(h.elements, h.state, h.app.props, h.app)).toBe(
          true,
        );
      }
    });

    it("is disabled when the selection contains a frame", () => {
      const [rect1, rect2] = createRects();
      const frame = API.createElement({
        type: "frame",
        x: 1000,
        y: 1000,
        width: 200,
        height: 200,
      });
      API.setElements([rect1, rect2, frame]);

      API.setSelectedElements([rect1, rect2]);
      expect(alignActionsPredicate(h.state, h.app)).toBe(true);

      API.setSelectedElements([rect1, rect2, frame]);
      expect(alignActionsPredicate(h.state, h.app)).toBe(false);
    });

    it("treats a single selected group as its members, so it needs at least two of them", () => {
      const groupA = "groupA";
      const groupB = "groupB";
      const [rect1, rect2, rect3] = createRects();
      const a1 = { ...rect1, groupIds: [groupA] };
      const a2 = { ...rect2, groupIds: [groupA] };
      const b1 = { ...rect3, groupIds: [groupB] };
      API.setElements([a1, a2, b1]);

      // a single selected group is split into its members
      API.setSelectedElements([a1, a2]);
      act(() => {
        h.setState({ selectedGroupIds: { [groupA]: true } });
      });
      expect(alignActionsPredicate(h.state, h.app)).toBe(true);

      // a one-element group alone is a single alignable unit
      API.setSelectedElements([b1]);
      act(() => {
        h.setState({ selectedGroupIds: { [groupB]: true } });
      });
      expect(alignActionsPredicate(h.state, h.app)).toBe(false);
    });
  });

  describe("keyTest", () => {
    const shortcuts = [
      [actionAlignTop, KEYS.ARROW_UP],
      [actionAlignBottom, KEYS.ARROW_DOWN],
      [actionAlignLeft, KEYS.ARROW_LEFT],
      [actionAlignRight, KEYS.ARROW_RIGHT],
    ] as const;

    it("maps Ctrl+Shift+Arrow to exactly one align action each", () => {
      for (const [action, key] of shortcuts) {
        const event = keyEvent({ ctrlKey: true, shiftKey: true, key });
        expect(
          shortcuts
            .filter(([other]) => other.keyTest!(event))
            .map(([other]) => other.name),
        ).toEqual([action.name]);
      }
    });

    it("requires both Ctrl and Shift", () => {
      for (const [action, key] of shortcuts) {
        expect(action.keyTest!(keyEvent({ key }))).toBeFalsy();
        expect(action.keyTest!(keyEvent({ ctrlKey: true, key }))).toBeFalsy();
        expect(action.keyTest!(keyEvent({ shiftKey: true, key }))).toBeFalsy();
      }
    });

    it("has no keyboard shortcut for the centering actions", () => {
      expect(actionAlignVerticallyCentered.keyTest).toBeUndefined();
      expect(actionAlignHorizontallyCentered.keyTest).toBeUndefined();
    });
  });

  describe("perform", () => {
    it.each([
      [actionAlignTop, [0, 0], [200, 0]],
      [actionAlignBottom, [0, 260], [200, 300]],
      [actionAlignLeft, [0, 0], [0, 300]],
      [actionAlignRight, [150, 0], [200, 300]],
      [actionAlignVerticallyCentered, [0, 130], [200, 150]],
      [actionAlignHorizontallyCentered, [75, 0], [100, 300]],
    ] as const)(
      "$name aligns only the selected elements along one axis",
      (action, expected1, expected2) => {
        const [rect1, rect2, rect3] = createRects();
        API.setElements([rect1, rect2, rect3]);
        API.setSelectedElements([rect1, rect2]);

        API.executeAction(action);

        expect(positions()).toEqual([expected1, expected2, [500, 600]]);
        // size and selection are untouched
        expect(h.elements.map((el) => [el.width, el.height])).toEqual([
          [100, 100],
          [50, 60],
          [80, 40],
        ]);
        expect(h.state.selectedElementIds).toEqual({
          [rect1.id]: true,
          [rect2.id]: true,
        });
      },
    );

    it("does not move deleted or unselected elements", () => {
      const [rect1, rect2, rect3] = createRects();
      const deleted = { ...rect3, isDeleted: true };
      API.setElements([rect1, rect2, deleted]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionAlignLeft);

      expect(positions()).toEqual([
        [0, 0],
        [0, 300],
        [500, 600],
      ]);
      expect(h.elements[2].isDeleted).toBe(true);
    });

    it("moves bound text together with its container", () => {
      const [rect1] = createRects();
      const [container, text] = API.createTextContainer();
      h.app.scene.mutateElement(container, { x: 300, y: 400 });
      h.app.scene.mutateElement(text, { x: 325, y: 440 });
      API.setElements([rect1, container, text]);
      API.setSelectedElements([rect1, container]);

      const offsetX = text.x - container.x;
      const offsetY = text.y - container.y;

      API.executeAction(actionAlignTop);

      const [, newContainer, newText] = h.elements;
      expect(newContainer.y).toBe(0);
      expect(newContainer.x).toBe(300);
      expect(newText.x - newContainer.x).toBeCloseTo(offsetX);
      expect(newText.y - newContainer.y).toBeCloseTo(offsetY);
    });

    it("keeps frame membership of aligned frame children", () => {
      const frame = API.createElement({
        type: "frame",
        x: 0,
        y: 0,
        width: 400,
        height: 400,
      });
      const child1 = API.createElement({
        type: "rectangle",
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        frameId: frame.id,
      });
      const child2 = API.createElement({
        type: "rectangle",
        x: 200,
        y: 200,
        width: 50,
        height: 50,
        frameId: frame.id,
      });
      API.setElements([child1, child2, frame]);
      API.setSelectedElements([child1, child2]);

      API.executeAction(actionAlignRight);

      expect(positions()).toEqual([
        [200, 10],
        [200, 200],
        [0, 0],
      ]);
      expect(h.elements.map((el) => el.frameId)).toEqual([
        frame.id,
        frame.id,
        null,
      ]);
    });
  });

  describe("history", () => {
    it("records a single undo entry; undo restores and redo reapplies", () => {
      const [rect1, rect2] = createRects();
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([rect1, rect2]);

      expect(API.getUndoStack().length).toBe(0);

      API.executeAction(actionAlignBottom);

      expect(API.getUndoStack().length).toBe(1);
      expect(positions()).toEqual([
        [0, 260],
        [200, 300],
      ]);

      Keyboard.undo();

      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(positions()).toEqual([
        [0, 0],
        [200, 300],
      ]);
      expect(h.elements.every((el) => !el.isDeleted)).toBe(true);

      Keyboard.redo();

      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(positions()).toEqual([
        [0, 260],
        [200, 300],
      ]);
    });
  });

  describe("properties panel", () => {
    const labels = [
      "Align top",
      "Align bottom",
      "Align left",
      "Align right",
      "Center vertically",
      "Center horizontally",
    ];

    const queryButton = (label: string) =>
      document.querySelector<HTMLButtonElement>(
        `.excalidraw button[aria-label="${label}"]`,
      );

    it("renders no align buttons for a single selected element", () => {
      const [rect1, rect2] = createRects();
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1]);

      for (const label of labels) {
        const button = queryButton(label);
        expect(button === null || button.hidden).toBe(true);
      }
    });

    it("renders all six align buttons for a multi-selection and aligns on click", () => {
      const [rect1, rect2] = createRects();
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      for (const label of labels) {
        const button = queryButton(label);
        expect(button).not.toBe(null);
        expect(button!.hidden).toBe(false);
      }

      fireEvent.click(queryButton("Center horizontally")!);

      expect(positions()).toEqual([
        [75, 0],
        [100, 300],
      ]);
    });
  });
});
