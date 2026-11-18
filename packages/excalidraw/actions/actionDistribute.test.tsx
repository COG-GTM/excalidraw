import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import {
  distributeHorizontally,
  distributeVertically,
} from "./actionDistribute";

const { h } = window;

const setup = () => {
  // a/c are the outer elements, b is off-center on both axes
  const elements = [
    API.createElement({
      type: "rectangle",
      id: "a",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }),
    API.createElement({
      type: "rectangle",
      id: "b",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
    }),
    API.createElement({
      type: "rectangle",
      id: "c",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    }),
  ];
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
  API.setSelectedElements(elements);
};

const getB = () => h.elements.find((el) => el.id === "b")!;

describe("distribute actions", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("distributeHorizontally evenly spaces elements on the x axis", () => {
    setup();

    API.executeAction(distributeHorizontally);

    // span 0..500, total width 250 → gaps of 125
    expect(getB().x).toBeCloseTo(225);
    expect(getB().y).toBe(150);

    Keyboard.undo();
    expect(getB().x).toBe(150);
    Keyboard.redo();
    expect(getB().x).toBeCloseTo(225);
  });

  it("distributeVertically evenly spaces elements on the y axis", () => {
    setup();

    API.executeAction(distributeVertically);

    expect(getB().y).toBeCloseTo(225);
    expect(getB().x).toBe(150);
  });

  it("matches Alt+H / Alt+V without Ctrl/Cmd", () => {
    const event = (code: string, modifiers: Record<string, boolean> = {}) =>
      ({
        code,
        altKey: true,
        [KEYS.CTRL_OR_CMD]: false,
        ...modifiers,
      } as unknown as KeyboardEvent);

    expect(distributeHorizontally.keyTest!(event(CODES.H))).toBe(true);
    expect(distributeVertically.keyTest!(event(CODES.V))).toBe(true);
    expect(distributeHorizontally.keyTest!(event(CODES.V))).toBe(false);
    expect(
      distributeHorizontally.keyTest!(
        event(CODES.H, { [KEYS.CTRL_OR_CMD]: true }),
      ),
    ).toBe(false);
    expect(
      distributeVertically.keyTest!(event(CODES.V, { altKey: false })),
    ).toBe(false);
  });
});
