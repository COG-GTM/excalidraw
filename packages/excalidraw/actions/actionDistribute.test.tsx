import { fireEvent } from "@testing-library/react";

import { CODES } from "@excalidraw/common";
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
  distributeHorizontally,
  distributeVertically,
} from "./actionDistribute";

const { h } = window;

const rect = (
  id: string,
  x: number,
  y: number,
  opts: Partial<Parameters<typeof API.createElement>[0]> = {},
) =>
  API.createElement({
    type: "rectangle",
    id,
    x,
    y,
    width: 100,
    height: 100,
    ...opts,
  });

const byId = (id: string) => h.elements.find((el) => el.id === id)!;

const xs = (...ids: string[]) => ids.map((id) => byId(id).x);
const ys = (...ids: string[]) => ids.map((id) => byId(id).y);

/** three 100x100 rectangles with an uneven gap on both axes */
const createThreeRects = () => [
  rect("a", 0, 0),
  rect("b", 110, 20),
  rect("c", 400, 500),
];

const keyEvent = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", init);

const queryButton = (label: string) =>
  document.querySelector<HTMLElement>(
    `.selected-shape-actions [aria-label="${label}"]`,
  );

describe("actionDistribute", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("keyTest", () => {
    it("maps Alt+H to horizontal and Alt+V to vertical", () => {
      const altH = keyEvent({ altKey: true, code: CODES.H });
      const altV = keyEvent({ altKey: true, code: CODES.V });

      expect(distributeHorizontally.keyTest!(altH)).toBe(true);
      expect(distributeHorizontally.keyTest!(altV)).toBe(false);
      expect(distributeVertically.keyTest!(altV)).toBe(true);
      expect(distributeVertically.keyTest!(altH)).toBe(false);
    });

    it("requires Alt and rejects Ctrl", () => {
      for (const [action, code] of [
        [distributeHorizontally, CODES.H],
        [distributeVertically, CODES.V],
      ] as const) {
        expect(action.keyTest!(keyEvent({ code }))).toBe(false);
        expect(
          action.keyTest!(keyEvent({ altKey: true, ctrlKey: true, code })),
        ).toBe(false);
      }
    });
  });

  describe("keyboard dispatch", () => {
    it("Alt+H distributes only along the x axis", () => {
      const elements = createThreeRects();
      API.setElements(elements);
      API.setSelectedElements(elements);

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codePress(CODES.H);
      });

      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
      expect(ys("a", "b", "c")).toEqual([0, 20, 500]);
    });

    it("Alt+V distributes only along the y axis", () => {
      const elements = createThreeRects();
      API.setElements(elements);
      API.setSelectedElements(elements);

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codePress(CODES.V);
      });

      expect(ys("a", "b", "c")).toEqual([0, 250, 500]);
      expect(xs("a", "b", "c")).toEqual([0, 110, 400]);
    });

    it("Ctrl+Alt+H does not distribute", () => {
      const elements = createThreeRects();
      API.setElements(elements);
      API.setSelectedElements(elements);

      Keyboard.withModifierKeys({ alt: true, ctrl: true }, () => {
        Keyboard.codePress(CODES.H);
      });

      expect(xs("a", "b", "c")).toEqual([0, 110, 400]);
    });
  });

  describe("perform", () => {
    it("requests an immediate history capture and keeps appState", () => {
      const elements = createThreeRects();
      API.setElements(elements);
      API.setSelectedElements(elements);

      for (const action of [distributeHorizontally, distributeVertically]) {
        const appState = h.state;
        let result!: {
          appState: unknown;
          elements: readonly ExcalidrawElement[];
          captureUpdate: unknown;
        };
        act(() => {
          result = action.perform(
            h.app.scene.getElementsIncludingDeleted(),
            appState,
            null,
            h.app,
          ) as typeof result;
        });

        expect(result.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
        expect(result.appState).toBe(appState);
        expect(result.elements.map((el) => el.id)).toEqual(["a", "b", "c"]);
      }
    });

    it("leaves unselected elements untouched and keeps scene order", () => {
      const [a, b, c] = createThreeRects();
      const bystander = rect("bystander", 150, 150);
      API.setElements([a, bystander, b, c]);
      API.setSelectedElements([a, b, c]);

      API.executeAction(distributeHorizontally);
      API.executeAction(distributeVertically);

      expect(h.elements.map((el) => el.id)).toEqual([
        "a",
        "bystander",
        "b",
        "c",
      ]);
      expect([byId("bystander").x, byId("bystander").y]).toEqual([150, 150]);
      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
      expect(ys("a", "b", "c")).toEqual([0, 250, 500]);
    });

    it("orders by position, not by scene order", () => {
      const elements = [rect("c", 400, 0), rect("b", 110, 0), rect("a", 0, 0)];
      API.setElements(elements);
      API.setSelectedElements(elements);

      API.executeAction(distributeHorizontally);

      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
    });

    it("evens out the gaps between four elements", () => {
      const elements = [
        rect("a", 0, 0),
        rect("b", 110, 0),
        rect("c", 220, 0),
        rect("d", 600, 0),
      ];
      API.setElements(elements);
      API.setSelectedElements(elements);

      API.executeAction(distributeHorizontally);

      expect(xs("a", "b", "c", "d")).toEqual([0, 200, 400, 600]);
    });

    it("does not move anything when only two elements are selected", () => {
      const elements = [rect("a", 0, 0), rect("b", 110, 20)];
      API.setElements(elements);
      API.setSelectedElements(elements);

      API.executeAction(distributeHorizontally);
      API.executeAction(distributeVertically);

      expect(xs("a", "b")).toEqual([0, 110]);
      expect(ys("a", "b")).toEqual([0, 20]);
    });

    it("moves a group as one unit", () => {
      const elements = [
        rect("a", 0, 0),
        rect("g1", 110, 0, { groupIds: ["g"] }),
        rect("g2", 160, 50, { groupIds: ["g"] }),
        rect("c", 550, 0),
      ];
      API.setElements(elements);
      API.setSelectedElements(elements);

      API.executeAction(distributeHorizontally);

      // group box is 150 wide: gap = (650 - 350) / 2 = 150
      expect(xs("a", "g1", "g2", "c")).toEqual([0, 250, 300, 550]);
      expect(ys("g1", "g2")).toEqual([0, 50]);
    });

    it("distributes the members of a single selected group", () => {
      const elements = [
        rect("a", 0, 0, { groupIds: ["g"] }),
        rect("b", 110, 0, { groupIds: ["g"] }),
        rect("c", 400, 0, { groupIds: ["g"] }),
      ];
      API.setElements(elements);
      API.setSelectedElements(elements);

      API.executeAction(distributeHorizontally);

      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
    });

    it("moves bound text together with its container", () => {
      const [a, b, c] = createThreeRects();
      const text = API.createElement({
        type: "text",
        id: "label",
        x: 120,
        y: 30,
        width: 50,
        height: 20,
        text: "hi",
        containerId: "b",
      });
      API.updateElement(b, { boundElements: [{ type: "text", id: "label" }] });
      API.setElements([a, b, text, c]);
      API.setSelectedElements([a, b, c]);

      const offsetX = byId("label").x - byId("b").x;
      const offsetY = byId("label").y - byId("b").y;

      API.executeAction(distributeHorizontally);
      API.executeAction(distributeVertically);

      expect([byId("b").x, byId("b").y]).toEqual([200, 250]);
      expect(byId("label").x - byId("b").x).toBeCloseTo(offsetX);
      expect(byId("label").y - byId("b").y).toBeCloseTo(offsetY);
    });

    it("keeps frame membership of distributed children", () => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        x: -50,
        y: -50,
        width: 700,
        height: 700,
      });
      const elements = createThreeRects().map((el) => ({
        ...el,
        frameId: "frame",
      })) as NonDeletedExcalidrawElement[];
      API.setElements([...elements, frame]);
      API.setSelectedElements(elements);

      API.executeAction(distributeHorizontally);

      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
      expect(h.elements.map((el) => el.frameId)).toEqual([
        "frame",
        "frame",
        "frame",
        null,
      ]);
    });
  });

  describe("history", () => {
    it("records a single entry that undo restores and redo reapplies", () => {
      const elements = createThreeRects();
      API.updateScene({
        elements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements(elements);
      const undoStackLength = API.getUndoStack().length;

      API.executeAction(distributeHorizontally);

      expect(API.getUndoStack().length).toBe(undoStackLength + 1);
      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);

      Keyboard.undo();

      expect(xs("a", "b", "c")).toEqual([0, 110, 400]);
      expect(h.elements.every((el) => !el.isDeleted)).toBe(true);
      expect(API.getRedoStack().length).toBe(1);

      Keyboard.redo();

      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);
      expect(API.getUndoStack().length).toBe(undoStackLength + 1);
    });
  });

  describe("PanelComponent", () => {
    it("shows both buttons with their shortcuts for three selected elements", () => {
      const elements = createThreeRects();
      API.setElements(elements);
      API.setSelectedElements(elements);

      const horizontal = queryButton("Distribute horizontally")!;
      const vertical = queryButton("Distribute vertically")!;

      expect(horizontal.hidden).toBe(false);
      expect(vertical.hidden).toBe(false);
      expect(horizontal.title).toBe("Distribute horizontally — Alt+H");
      expect(vertical.title).toBe("Distribute vertically — Alt+V");
    });

    it("distributes when the buttons are clicked", () => {
      const elements = createThreeRects();
      API.setElements(elements);
      API.setSelectedElements(elements);

      fireEvent.click(queryButton("Distribute horizontally")!);
      expect(xs("a", "b", "c")).toEqual([0, 200, 400]);

      fireEvent.click(queryButton("Distribute vertically")!);
      expect(ys("a", "b", "c")).toEqual([0, 250, 500]);
    });

    it("offers no enabled button for two selected elements", () => {
      const elements = [rect("a", 0, 0), rect("b", 110, 20)];
      API.setElements(elements);
      API.setSelectedElements(elements);

      for (const label of [
        "Distribute horizontally",
        "Distribute vertically",
      ]) {
        const button = queryButton(label);
        expect(button === null || button.hidden).toBe(true);
      }
    });

    it("hides the buttons when two of three selected elements share a group", () => {
      const elements = [
        rect("a", 0, 0, { groupIds: ["g"] }),
        rect("b", 110, 20, { groupIds: ["g"] }),
        rect("c", 400, 500),
      ];
      API.setElements(elements);
      API.setSelectedElements(elements);

      expect(queryButton("Distribute horizontally")!.hidden).toBe(true);
      expect(queryButton("Distribute vertically")!.hidden).toBe(true);
    });

    it("hides the buttons when a frame is part of the selection", () => {
      const elements = [
        ...createThreeRects(),
        API.createElement({
          type: "frame",
          id: "frame",
          x: 1000,
          y: 1000,
          width: 100,
          height: 100,
        }),
      ];
      API.setElements(elements);
      API.setSelectedElements(elements);

      for (const label of [
        "Distribute horizontally",
        "Distribute vertically",
      ]) {
        const button = queryButton(label);
        expect(button === null || button.hidden).toBe(true);
      }
    });
  });
});
