import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render } from "../tests/test-utils";

import { actionSelectSameType } from "./actionSelectSameType";

const { h } = window;

const execute = () => {
  act(() => {
    h.app.actionManager.executeAction(actionSelectSameType);
  });
};

const selectedIds = () => Object.keys(h.state.selectedElementIds).sort();

const idsOf = (...elements: ExcalidrawElement[]) =>
  elements.map((element) => element.id).sort();

const getLabel = () =>
  (actionSelectSameType.label as Function)(h.elements, h.state, h.app);

const isVisible = () =>
  actionSelectSameType.predicate(h.elements, h.state);

describe("actionSelectSameType", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("selects all elements of the selected type", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 200 });
    const rect3 = API.createElement({ type: "rectangle", x: 400 });
    const ellipse = API.createElement({ type: "ellipse", y: 200 });
    const diamond = API.createElement({ type: "diamond", y: 400 });

    API.setElements([rect1, ellipse, rect2, diamond, rect3]);
    API.setSelectedElements([rect1]);

    expect(isVisible()).toBe(true);
    expect(getLabel()).toBe("labels.selectAllSameType.rectangle");

    execute();

    expect(selectedIds()).toEqual(idsOf(rect1, rect2, rect3));
  });

  it("selects all matching types for a mixed-type selection", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 200 });
    const ellipse1 = API.createElement({ type: "ellipse", y: 200 });
    const ellipse2 = API.createElement({ type: "ellipse", x: 200, y: 200 });
    const diamond = API.createElement({ type: "diamond", y: 400 });
    const arrow = API.createElement({ type: "arrow", y: 600 });

    API.setElements([rect1, rect2, ellipse1, ellipse2, diamond, arrow]);
    API.setSelectedElements([rect1, ellipse1]);

    expect(getLabel()).toBe("labels.selectAllSameTypeMultiple");

    execute();

    expect(selectedIds()).toEqual(idsOf(rect1, rect2, ellipse1, ellipse2));
  });

  it("excludes locked elements", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 200 });
    const locked = API.createElement({
      type: "rectangle",
      x: 400,
      locked: true,
    });

    API.setElements([rect1, rect2, locked]);
    API.setSelectedElements([rect1]);

    execute();

    expect(selectedIds()).toEqual(idsOf(rect1, rect2));
  });

  it("excludes deleted elements", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 200 });
    const deleted = API.createElement({
      type: "rectangle",
      x: 400,
      isDeleted: true,
    });

    API.setElements([rect1, rect2, deleted]);
    API.setSelectedElements([rect1]);

    execute();

    expect(selectedIds()).toEqual(idsOf(rect1, rect2));
  });

  it("excludes text bound to a container", () => {
    const [container, boundText] = API.createTextContainer();
    const text1 = API.createElement({ type: "text", text: "a", y: 200 });
    const text2 = API.createElement({ type: "text", text: "b", y: 400 });

    API.setElements([container, boundText, text1, text2]);
    API.setSelectedElements([text1]);

    expect(getLabel()).toBe("labels.selectAllSameType.text");

    execute();

    expect(selectedIds()).toEqual(idsOf(text1, text2));
  });

  it("selects a single matching linear element without entering the editor", () => {
    const rect = API.createElement({ type: "rectangle" });
    const arrow = API.createElement({ type: "arrow", y: 200 });

    API.setElements([rect, arrow]);
    API.setSelectedElements([arrow]);

    execute();

    expect(selectedIds()).toEqual(idsOf(arrow));
    expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);
    expect(h.state.selectedLinearElement?.isEditing).toBeFalsy();
  });

  it("is hidden and a no-op when nothing is selected", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 200 });

    API.setElements([rect1, rect2]);
    API.clearSelection();

    expect(isVisible()).toBe(false);

    execute();

    expect(selectedIds()).toEqual([]);
  });

  it("can be undone", () => {
    const rect1 = API.createElement({ type: "rectangle" });
    const rect2 = API.createElement({ type: "rectangle", x: 200 });

    API.updateScene({
      elements: [rect1, rect2],
      appState: { selectedElementIds: { [rect1.id]: true } },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    execute();
    expect(selectedIds()).toEqual(idsOf(rect1, rect2));

    act(() => {
      h.app.actionManager.executeAction(h.app.actionManager.actions.undo);
    });

    expect(selectedIds()).toEqual(idsOf(rect1));
  });
});
