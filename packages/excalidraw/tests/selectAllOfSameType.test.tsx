import { actionSelectAllElementsOfSameType } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();

const h = window.h;

describe("actionSelectAllElementsOfSameType", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  it("selects all elements matching the selected element's type", () => {
    const rect1 = API.createElement({ type: "rectangle", x: 0 });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });
    const rect3 = API.createElement({ type: "rectangle", x: 200 });
    const ellipse1 = API.createElement({ type: "ellipse", x: 300 });
    const ellipse2 = API.createElement({ type: "ellipse", x: 400 });
    const arrow = API.createElement({ type: "arrow", x: 500 });
    const deletedRect = API.createElement({
      type: "rectangle",
      x: 600,
      isDeleted: true,
    });

    API.setElements([
      rect1,
      rect2,
      rect3,
      ellipse1,
      ellipse2,
      arrow,
      deletedRect,
    ]);
    API.setSelectedElements([rect1]);

    act(() => API.executeAction(actionSelectAllElementsOfSameType));

    expect(h.state.selectedElementIds).toEqual({
      [rect1.id]: true,
      [rect2.id]: true,
      [rect3.id]: true,
    });
  });

  it("selects all elements matching any of the selected types", () => {
    const rect1 = API.createElement({ type: "rectangle", x: 0 });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });
    const ellipse1 = API.createElement({ type: "ellipse", x: 200 });
    const ellipse2 = API.createElement({ type: "ellipse", x: 300 });
    const diamond = API.createElement({ type: "diamond", x: 400 });

    API.setElements([rect1, rect2, ellipse1, ellipse2, diamond]);
    API.setSelectedElements([rect1, ellipse1]);

    act(() => API.executeAction(actionSelectAllElementsOfSameType));

    expect(h.state.selectedElementIds).toEqual({
      [rect1.id]: true,
      [rect2.id]: true,
      [ellipse1.id]: true,
      [ellipse2.id]: true,
    });
  });

  it("does not select locked elements", () => {
    const rect1 = API.createElement({ type: "rectangle", x: 0 });
    const rect2 = API.createElement({ type: "rectangle", x: 100 });
    const lockedRect = API.createElement({
      type: "rectangle",
      x: 200,
      locked: true,
    });

    API.setElements([rect1, rect2, lockedRect]);
    API.setSelectedElements([rect1]);

    act(() => API.executeAction(actionSelectAllElementsOfSameType));

    expect(h.state.selectedElementIds).toEqual({
      [rect1.id]: true,
      [rect2.id]: true,
    });
  });

  it("has a type-aware label and requires a selection", () => {
    const rect = API.createElement({ type: "rectangle" });
    const ellipse = API.createElement({ type: "ellipse", x: 100 });
    API.setElements([rect, ellipse]);

    const isApplicable = () =>
      actionSelectAllElementsOfSameType.predicate!(h.elements, h.state);
    const getLabel = () =>
      (actionSelectAllElementsOfSameType.label as Function)(
        h.elements,
        h.state,
        h.app,
      );

    expect(isApplicable()).toBe(false);

    API.setSelectedElements([rect]);
    expect(isApplicable()).toBe(true);
    expect(getLabel()).toBe("labels.selectAllOfType.rectangle");

    API.setSelectedElements([rect, ellipse]);
    expect(getLabel()).toBe("labels.selectAllElementsOfSameType");
  });
});
