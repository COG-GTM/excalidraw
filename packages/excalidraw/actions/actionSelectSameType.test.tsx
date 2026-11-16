import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionSelectSameType } from "./actionSelectSameType";

import type { Action } from "./types";

const { h } = window;

const selectedIds = () =>
  Object.keys(h.state.selectedElementIds).filter(
    (id) => h.state.selectedElementIds[id],
  );

const execute = () => {
  act(() => {
    h.app.actionManager.executeAction(actionSelectSameType);
  });
};

describe("actionSelectSameType", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("selects all elements of the selected type", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });
    const rect3 = API.createElement({ type: "rectangle", x: 200 });
    const ellipse = API.createElement({ type: "ellipse", x: 300 });
    const diamond = API.createElement({ type: "diamond", x: 400 });

    API.setElements([rect1, rect2, ellipse, rect3, diamond]);
    API.setSelectedElements([rect1]);

    execute();

    expect(selectedIds().sort()).toEqual([rect1.id, rect2.id, rect3.id].sort());
  });

  it("selects all elements matching any type in a mixed selection", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });
    const ellipse1 = API.createElement({ type: "ellipse", x: 200 });
    const ellipse2 = API.createElement({ type: "ellipse", x: 300 });
    const diamond = API.createElement({ type: "diamond", x: 400 });

    API.setElements([rect1, rect2, ellipse1, ellipse2, diamond]);
    API.setSelectedElements([rect1, ellipse1]);

    execute();

    expect(selectedIds().sort()).toEqual(
      [rect1.id, rect2.id, ellipse1.id, ellipse2.id].sort(),
    );
  });

  it("excludes locked elements", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });
    const locked = API.createElement({
      type: "rectangle",
      x: 200,
      locked: true,
    });

    API.setElements([rect1, rect2, locked]);
    API.setSelectedElements([rect1]);

    execute();

    expect(selectedIds().sort()).toEqual([rect1.id, rect2.id].sort());
  });

  it("excludes deleted elements", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });
    const deleted = API.createElement({
      type: "rectangle",
      x: 200,
      isDeleted: true,
    });

    API.setElements([rect1, rect2, deleted]);
    API.setSelectedElements([rect1]);

    execute();

    expect(selectedIds().sort()).toEqual([rect1.id, rect2.id].sort());
  });

  it("excludes text bound to a container", () => {
    const [container, boundText] = API.createTextContainer();
    const text1 = API.createElement({ type: "text", x: 300, text: "a" });
    const text2 = API.createElement({ type: "text", x: 400, text: "b" });

    API.setElements([container, boundText, text1, text2]);
    API.setSelectedElements([text1]);

    execute();

    expect(selectedIds().sort()).toEqual([text1.id, text2.id].sort());
    expect(h.state.selectedElementIds[boundText.id]).toBeUndefined();
  });

  it("is hidden and a no-op when nothing is selected", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });

    API.setElements([rect1, rect2]);
    API.setSelectedElements([]);

    expect(actionSelectSameType.predicate!(h.elements, h.state)).toBe(false);

    execute();

    expect(selectedIds()).toEqual([]);
  });

  it("is visible when something is selected", () => {
    const rect = API.createElement({ type: "rectangle" });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    expect(actionSelectSameType.predicate!(h.elements, h.state)).toBe(true);
  });

  it("uses a type-specific label for a single type and a generic one for mixed types", () => {
    const rect = API.createElement({ type: "rectangle" });
    const ellipse = API.createElement({ type: "ellipse", x: 100 });
    API.setElements([rect, ellipse]);

    const label = actionSelectSameType.label as Exclude<
      Action["label"],
      string
    >;

    API.setSelectedElements([rect]);
    expect(label(h.elements, h.state, h.app)).toBe(
      "labels.selectAllSameType.rectangle",
    );

    API.setSelectedElements([rect, ellipse]);
    expect(label(h.elements, h.state, h.app)).toBe(
      "labels.selectAllSameTypeMultiple",
    );
  });

  it("is undoable", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });

    API.updateScene({
      elements: [rect1, rect2],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.updateScene({
      appState: { selectedElementIds: { [rect1.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    execute();
    expect(selectedIds().sort()).toEqual([rect1.id, rect2.id].sort());

    Keyboard.undo();
    expect(selectedIds()).toEqual([rect1.id]);
  });
});
