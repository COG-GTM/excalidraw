import { CaptureUpdateAction } from "@excalidraw/element";
import { CODES, KEYS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { fireEvent, render } from "../tests/test-utils";

import {
  distributeHorizontally,
  distributeVertically,
} from "./actionDistribute";

const { h } = window;

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const queryButton = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const keyEvent = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", init);

// three 100x100 rects spread unevenly on both axes; the common bounding box
// is 500 wide/tall, so distributing leaves 100px gaps (0, 200, 400)
const createUnevenRects = (groupIds: string[][] = [[], [], []]) => [
  API.createElement({
    type: "rectangle",
    id: "A",
    groupIds: groupIds[0],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  }),
  API.createElement({
    type: "rectangle",
    id: "B",
    groupIds: groupIds[1],
    x: 130,
    y: 130,
    width: 100,
    height: 100,
  }),
  API.createElement({
    type: "rectangle",
    id: "C",
    groupIds: groupIds[2],
    x: 400,
    y: 400,
    width: 100,
    height: 100,
  }),
];

const loadScene = (elements: ExcalidrawElement[]) => {
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
};

beforeEach(async () => {
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("actionDistribute", () => {
  describe("keyTest", () => {
    it("maps Alt+H to distributeHorizontally only", () => {
      expect(
        distributeHorizontally.keyTest!(
          keyEvent({ altKey: true, code: CODES.H }) as any,
        ),
      ).toBe(true);
      expect(
        distributeVertically.keyTest!(
          keyEvent({ altKey: true, code: CODES.H }) as any,
        ),
      ).toBe(false);
      expect(
        distributeHorizontally.keyTest!(keyEvent({ code: CODES.H }) as any),
      ).toBe(false);
      expect(
        distributeHorizontally.keyTest!(
          keyEvent({
            altKey: true,
            [KEYS.CTRL_OR_CMD]: true,
            code: CODES.H,
          }) as any,
        ),
      ).toBe(false);
    });

    it("maps Alt+V to distributeVertically only", () => {
      expect(
        distributeVertically.keyTest!(
          keyEvent({ altKey: true, code: CODES.V }) as any,
        ),
      ).toBe(true);
      expect(
        distributeHorizontally.keyTest!(
          keyEvent({ altKey: true, code: CODES.V }) as any,
        ),
      ).toBe(false);
      expect(
        distributeVertically.keyTest!(keyEvent({ code: CODES.V }) as any),
      ).toBe(false);
      expect(
        distributeVertically.keyTest!(
          keyEvent({
            altKey: true,
            [KEYS.CTRL_OR_CMD]: true,
            code: CODES.V,
          }) as any,
        ),
      ).toBe(false);
    });
  });

  describe("keyboard dispatch", () => {
    it("Alt+H distributes the selection horizontally and leaves y untouched", () => {
      const elements = createUnevenRects();
      loadScene(elements);
      API.setSelectedElements(elements);

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codePress(CODES.H);
      });

      expect(["A", "B", "C"].map((id) => getElement(id).x)).toEqual([
        0, 200, 400,
      ]);
      expect(["A", "B", "C"].map((id) => getElement(id).y)).toEqual([
        0, 130, 400,
      ]);
    });

    it("Alt+V distributes the selection vertically and leaves x untouched", () => {
      const elements = createUnevenRects();
      loadScene(elements);
      API.setSelectedElements(elements);

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codePress(CODES.V);
      });

      expect(["A", "B", "C"].map((id) => getElement(id).y)).toEqual([
        0, 200, 400,
      ]);
      expect(["A", "B", "C"].map((id) => getElement(id).x)).toEqual([
        0, 130, 400,
      ]);
    });
  });

  describe("perform", () => {
    it("does not move unselected elements", () => {
      const elements = [
        ...createUnevenRects(),
        API.createElement({
          type: "rectangle",
          id: "D",
          x: 1000,
          y: 1000,
          width: 50,
          height: 50,
        }),
      ];
      loadScene(elements);
      API.setSelectedElements(elements.slice(0, 3));

      API.executeAction(distributeHorizontally);

      expect(getElement("B").x).toBe(200);
      expect(getElement("D").x).toBe(1000);
      expect(getElement("D").y).toBe(1000);
    });

    it("keeps the outer elements in place when only two are selected", () => {
      const [a, , c] = createUnevenRects();
      loadScene([a, c]);
      API.setSelectedElements([a, c]);

      API.executeAction(distributeHorizontally);

      expect(getElement("A").x).toBe(0);
      expect(getElement("C").x).toBe(400);
    });

    it("moves a selected group as a single unit, preserving member offsets", () => {
      const elements = [
        API.createElement({
          type: "rectangle",
          id: "A",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        }),
        API.createElement({
          type: "rectangle",
          id: "G1",
          x: 50,
          y: 0,
          width: 50,
          height: 50,
          groupIds: ["g"],
        }),
        API.createElement({
          type: "rectangle",
          id: "G2",
          x: 120,
          y: 0,
          width: 50,
          height: 50,
          groupIds: ["g"],
        }),
        API.createElement({
          type: "rectangle",
          id: "C",
          x: 400,
          y: 0,
          width: 100,
          height: 100,
        }),
      ];
      loadScene(elements);
      API.setSelectedElements(elements);

      API.executeAction(distributeHorizontally);

      // bounds 0..500, span 100 + 120 + 100 = 320 -> 90px gaps
      expect(getElement("A").x).toBe(0);
      expect(getElement("G1").x).toBe(190);
      expect(getElement("G2").x).toBe(260);
      expect(getElement("C").x).toBe(400);
    });

    it("moves bound text together with its container", () => {
      const [a, , c] = createUnevenRects();
      const container = API.createElement({
        type: "rectangle",
        id: "container",
        x: 130,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ type: "text", id: "label" }],
      });
      const text = API.createElement({
        type: "text",
        id: "label",
        text: "label",
        x: 155,
        y: 40,
        width: 50,
        height: 20,
        containerId: container.id,
      });
      loadScene([a, c, container, text]);
      API.setSelectedElements([a, container, c]);

      API.executeAction(distributeHorizontally);

      expect(getElement(container.id).x).toBe(200);
      expect(getElement(text.id).x).toBe(225);
    });
  });

  describe("history", () => {
    it("records a single undo entry that undo reverts and redo reapplies", () => {
      const elements = createUnevenRects();
      loadScene(elements);
      API.setSelectedElements(elements);
      const undoStackLength = h.history.undoStack.length;

      API.executeAction(distributeHorizontally);

      expect(h.history.undoStack.length).toBe(undoStackLength + 1);
      expect(getElement("B").x).toBe(200);

      Keyboard.undo();
      expect(getElement("B").x).toBe(130);
      expect(getElement("B").isDeleted).toBe(false);

      Keyboard.redo();
      expect(getElement("B").x).toBe(200);
    });
  });

  describe("PanelComponent", () => {
    it("is not rendered for fewer than three selected elements", () => {
      const [a, b] = createUnevenRects();
      loadScene([a, b]);
      API.setSelectedElements([a, b]);

      expect(queryButton("Distribute horizontally")).toBe(null);
      expect(queryButton("Distribute vertically")).toBe(null);
    });

    it("renders both buttons with shortcut titles and distributes on click", () => {
      const elements = createUnevenRects();
      loadScene(elements);
      API.setSelectedElements(elements);

      const horizontal = queryButton("Distribute horizontally")!;
      const vertical = queryButton("Distribute vertically")!;
      expect(horizontal.hidden).toBe(false);
      expect(vertical.hidden).toBe(false);
      expect(horizontal.title).toBe("Distribute horizontally — Alt+H");
      expect(vertical.title).toBe("Distribute vertically — Alt+V");

      fireEvent.click(horizontal);
      expect(getElement("B").x).toBe(200);

      fireEvent.click(vertical);
      expect(getElement("B").y).toBe(200);
    });

    it("is hidden when two groups make up the whole selection", () => {
      const elements = createUnevenRects([["g1"], ["g1"], ["g2"]]);
      loadScene(elements);
      API.setSelectedElements(elements);

      expect(queryButton("Distribute horizontally")?.hidden).toBe(true);
    });

    it("is hidden when a frame is part of the selection", () => {
      const [a, b] = createUnevenRects();
      const frame = API.createElement({
        type: "frame",
        id: "F",
        x: 600,
        y: 0,
        width: 200,
        height: 200,
      });
      loadScene([a, b, frame]);
      API.setSelectedElements([a, b, frame]);

      const button = queryButton("Distribute horizontally");
      expect(button === null || button.hidden).toBe(true);
    });
  });
});
