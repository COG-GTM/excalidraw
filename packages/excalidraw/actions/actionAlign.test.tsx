import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

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

const isEnabled = (action: Action) =>
  action.predicate!(h.elements, h.state, h.app.props, h.app);

const keyEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    shiftKey: true,
    [KEYS.CTRL_OR_CMD]: true,
    ...modifiers,
  } as unknown as KeyboardEvent);

const setup = () => {
  const a = API.createElement({
    type: "rectangle",
    id: "a",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const b = API.createElement({
    type: "rectangle",
    id: "b",
    x: 200,
    y: 300,
    width: 50,
    height: 50,
  });
  API.updateScene({
    elements: [a, b],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  API.setSelectedElements([a, b]);
};

const position = (id: string) => {
  const element = h.elements.find((el) => el.id === id)!;
  return [element.x, element.y];
};

describe("align actions", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it.each([
    [actionAlignTop, { a: [0, 0], b: [200, 0] }],
    [actionAlignBottom, { a: [0, 250], b: [200, 300] }],
    [actionAlignLeft, { a: [0, 0], b: [0, 300] }],
    [actionAlignRight, { a: [150, 0], b: [200, 300] }],
    [actionAlignVerticallyCentered, { a: [0, 125], b: [200, 150] }],
    [actionAlignHorizontallyCentered, { a: [75, 0], b: [100, 300] }],
  ] as const)("%o aligns the selection", (action, expected) => {
    setup();
    expect(isEnabled(action)).toBe(true);

    API.executeAction(action);

    for (const id of ["a", "b"] as const) {
      const [x, y] = position(id);
      expect(x).toBeCloseTo(expected[id][0]);
      expect(y).toBeCloseTo(expected[id][1]);
    }

    Keyboard.undo();
    expect(position("a")).toEqual([0, 0]);
    expect(position("b")).toEqual([200, 300]);

    Keyboard.redo();
    expect(position("b")[0]).toBeCloseTo(expected.b[0]);
    expect(position("b")[1]).toBeCloseTo(expected.b[1]);
  });

  it("is disabled for a single element or when frames are selected", () => {
    setup();
    const [a] = h.app.scene.getNonDeletedElements();

    API.setSelectedElements([a]);
    expect(isEnabled(actionAlignTop)).toBe(false);

    const frame = API.createElement({ type: "frame", x: 500, y: 500 });
    const rect = API.createElement({ type: "rectangle", x: 0, y: 0 });
    API.updateScene({
      elements: [frame, rect],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([frame, rect]);
    expect(isEnabled(actionAlignRight)).toBe(false);
  });

  it("matches Ctrl/Cmd+Shift+Arrow shortcuts", () => {
    expect(actionAlignTop.keyTest!(keyEvent(KEYS.ARROW_UP))).toBe(true);
    expect(actionAlignBottom.keyTest!(keyEvent(KEYS.ARROW_DOWN))).toBe(true);
    expect(actionAlignLeft.keyTest!(keyEvent(KEYS.ARROW_LEFT))).toBe(true);
    expect(actionAlignRight.keyTest!(keyEvent(KEYS.ARROW_RIGHT))).toBe(true);

    expect(
      actionAlignTop.keyTest!(keyEvent(KEYS.ARROW_UP, { shiftKey: false })),
    ).toBe(false);
    expect(actionAlignTop.keyTest!(keyEvent(KEYS.ARROW_DOWN))).toBe(false);
  });

  it("aligns via keyboard shortcut", () => {
    setup();
    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    expect(position("b")[0]).toBeCloseTo(0);
  });
});
