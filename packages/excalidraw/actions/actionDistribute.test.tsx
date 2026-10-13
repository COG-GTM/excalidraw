import { fireEvent, queryByTitle } from "@testing-library/react";

import { CODES, KEYS } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  distributeHorizontally,
  distributeVertically,
} from "./actionDistribute";

const { h } = window;

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const xs = (...ids: string[]) => ids.map((id) => getElement(id).x);
const ys = (...ids: string[]) => ids.map((id) => getElement(id).y);

const keyEvent = (
  code: string,
  modifiers: { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
) =>
  new KeyboardEvent("keydown", {
    code,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...modifiers,
  });

const renderWithElements = async (elements: NonDeletedExcalidrawElement[]) => {
  await render(
    <Excalidraw initialData={{ elements }} handleKeyboardGlobally={true} />,
  );
  API.setSelectedElements(elements.filter((el) => el.type !== "text"));
};

const queryDistributeButton = (title: "horizontally" | "vertically") =>
  queryByTitle<HTMLButtonElement>(
    document.querySelector(".App-menu__left") as HTMLElement,
    new RegExp(`^Distribute ${title}`),
  );

const isDistributeButtonShown = (title: "horizontally" | "vertically") => {
  const button = queryDistributeButton(title);
  return !!button && !button.hidden;
};

describe("actionDistribute", () => {
  describe("keyTest", () => {
    it("maps Alt+H to distributeHorizontally and Alt+V to distributeVertically", () => {
      const altH = keyEvent(CODES.H, { altKey: true });
      const altV = keyEvent(CODES.V, { altKey: true });

      expect(distributeHorizontally.keyTest!(altH)).toBe(true);
      expect(distributeVertically.keyTest!(altH)).toBe(false);
      expect(distributeVertically.keyTest!(altV)).toBe(true);
      expect(distributeHorizontally.keyTest!(altV)).toBe(false);
    });

    it("does not match without Alt or when Ctrl/Cmd is held", () => {
      for (const action of [distributeHorizontally, distributeVertically]) {
        const code = action === distributeHorizontally ? CODES.H : CODES.V;
        expect(action.keyTest!(keyEvent(code))).toBe(false);
        expect(
          action.keyTest!(
            keyEvent(code, { altKey: true, [KEYS.CTRL_OR_CMD]: true }),
          ),
        ).toBe(false);
      }
    });
  });

  describe("perform", () => {
    it("distributes unevenly sized elements with equal horizontal gaps", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0, width: 50, height: 50 }),
        API.createElement({ id: "b", x: 60, y: 0, width: 100, height: 50 }),
        API.createElement({ id: "c", x: 300, y: 0, width: 20, height: 50 }),
      ]);

      API.executeAction(distributeHorizontally);

      // total span 320, occupied 170 → gap of 75 between each element
      expect(xs("a", "b", "c")).toEqual([0, 125, 300]);
      expect(ys("a", "b", "c")).toEqual([0, 0, 0]);
    });

    it("distributes unevenly sized elements with equal vertical gaps", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0, width: 50, height: 40 }),
        API.createElement({ id: "b", x: 0, y: 50, width: 50, height: 80 }),
        API.createElement({ id: "c", x: 0, y: 400, width: 50, height: 20 }),
      ]);

      API.executeAction(distributeVertically);

      // total span 420, occupied 140 → gap of 140 between each element
      expect(ys("a", "b", "c")).toEqual([0, 180, 400]);
      expect(xs("a", "b", "c")).toEqual([0, 0, 0]);
    });

    it("orders elements by their position, not by selection or z-order", async () => {
      await renderWithElements([
        API.createElement({ id: "right", x: 400, y: 0, width: 100 }),
        API.createElement({ id: "middle", x: 120, y: 0, width: 100 }),
        API.createElement({ id: "left", x: 0, y: 0, width: 100 }),
      ]);

      API.executeAction(distributeHorizontally);

      expect(xs("left", "middle", "right")).toEqual([0, 200, 400]);
    });

    it("treats a group as a single unit and keeps its members' relative offsets", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
        API.createElement({
          id: "g1",
          x: 110,
          y: 0,
          width: 40,
          height: 100,
          groupIds: ["group"],
        }),
        API.createElement({
          id: "g2",
          x: 170,
          y: 50,
          width: 40,
          height: 100,
          groupIds: ["group"],
        }),
        API.createElement({ id: "c", x: 500, y: 0, width: 100, height: 100 }),
      ]);

      API.executeAction(distributeHorizontally);

      // group spans 100px (110..210); total span 600, occupied 300 → gap 150
      expect(xs("a", "g1", "g2", "c")).toEqual([0, 250, 310, 500]);
      expect(ys("g1", "g2")).toEqual([0, 50]);
    });

    it("is a no-op when the selection resolves to fewer than three units", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0, width: 100 }),
        API.createElement({ id: "g1", x: 300, y: 0, groupIds: ["group"] }),
        API.createElement({ id: "g2", x: 340, y: 0, groupIds: ["group"] }),
      ]);

      API.executeAction(distributeHorizontally);

      expect(xs("a", "g1", "g2")).toEqual([0, 300, 340]);
    });

    it("does not move unselected elements", async () => {
      const elements = [
        API.createElement({ id: "a", x: 0, y: 0, width: 100 }),
        API.createElement({ id: "b", x: 120, y: 0, width: 100 }),
        API.createElement({ id: "c", x: 400, y: 0, width: 100 }),
        API.createElement({ id: "other", x: 150, y: 300, width: 100 }),
      ];
      await render(<Excalidraw initialData={{ elements }} />);
      API.setSelectedElements(elements.slice(0, 3));

      API.executeAction(distributeHorizontally);

      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
      expect(getElement("other").x).toBe(150);
      expect(getElement("other").y).toBe(300);
    });
  });

  describe("keyboard shortcuts", () => {
    it("Alt+H and Alt+V distribute the selection on the canvas", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
        API.createElement({ id: "b", x: 120, y: 120, width: 100, height: 100 }),
        API.createElement({ id: "c", x: 400, y: 400, width: 100, height: 100 }),
      ]);

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codeDown(CODES.H);
      });
      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
      expect(ys("a", "b", "c")).toEqual([0, 120, 400]);

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codeDown(CODES.V);
      });
      expect(ys("a", "b", "c")).toEqual([0, 200, 400]);
    });
  });

  describe("history", () => {
    it("records a single undoable entry that can be undone and redone", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0, width: 100 }),
        API.createElement({ id: "b", x: 120, y: 0, width: 100 }),
        API.createElement({ id: "c", x: 400, y: 0, width: 100 }),
      ]);
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(distributeHorizontally);

      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);

      Keyboard.undo();
      expect(xs("a", "b", "c")).toEqual([0, 120, 400]);
      expect(API.getRedoStack().length).toBe(1);

      Keyboard.redo();
      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
    });
  });

  describe("PanelComponent", () => {
    it("shows distribute buttons for three ungrouped elements and applies on click", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
        API.createElement({ id: "b", x: 120, y: 120, width: 100, height: 100 }),
        API.createElement({ id: "c", x: 400, y: 400, width: 100, height: 100 }),
      ]);

      const horizontal = queryDistributeButton("horizontally");
      expect(isDistributeButtonShown("horizontally")).toBe(true);
      expect(isDistributeButtonShown("vertically")).toBe(true);

      act(() => {
        fireEvent.click(horizontal!);
      });
      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);

      act(() => {
        fireEvent.click(queryDistributeButton("vertically")!);
      });
      expect(ys("a", "b", "c")).toEqual([0, 200, 400]);
    });

    it("hides distribute buttons when grouped elements form fewer than three units", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0 }),
        API.createElement({ id: "g1", x: 200, y: 0, groupIds: ["group"] }),
        API.createElement({ id: "g2", x: 400, y: 0, groupIds: ["group"] }),
      ]);

      expect(Object.keys(h.state.selectedElementIds)).toHaveLength(3);
      expect(isDistributeButtonShown("horizontally")).toBe(false);
      expect(isDistributeButtonShown("vertically")).toBe(false);
    });

    it("hides distribute buttons when a frame is part of the selection", async () => {
      await renderWithElements([
        API.createElement({ id: "a", x: 0, y: 0 }),
        API.createElement({ id: "b", x: 200, y: 0 }),
        API.createElement({ id: "c", x: 400, y: 0 }),
        API.createElement({
          id: "frame",
          type: "frame",
          x: 0,
          y: 300,
          width: 200,
          height: 200,
        }),
      ]);

      expect(Object.keys(h.state.selectedElementIds)).toHaveLength(4);
      expect(isDistributeButtonShown("horizontally")).toBe(false);
      expect(isDistributeButtonShown("vertically")).toBe(false);
    });
  });
});
