import { actionSelectSameColor } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const h = window.h;

describe("actionSelectSameColor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  it("selects all elements sharing the selected element's strokeColor, excluding locked and deleted", () => {
    const red1 = API.createElement({ type: "rectangle", strokeColor: "red" });
    const red2 = API.createElement({ type: "ellipse", strokeColor: "red" });
    const red3 = API.createElement({ type: "diamond", strokeColor: "red" });
    const blue = API.createElement({ type: "rectangle", strokeColor: "blue" });
    const redLocked = API.createElement({
      type: "rectangle",
      strokeColor: "red",
      locked: true,
    });
    const redDeleted = API.createElement({
      type: "rectangle",
      strokeColor: "red",
      isDeleted: true,
    });

    API.setElements([red1, red2, red3, blue, redLocked, redDeleted]);
    API.setSelectedElements([red1]);

    API.executeAction(actionSelectSameColor);

    expect(h.state.selectedElementIds).toEqual({
      [red1.id]: true,
      [red2.id]: true,
      [red3.id]: true,
    });
  });

  it("excludes text bound to a container", () => {
    const container = API.createElement({
      type: "rectangle",
      strokeColor: "red",
    });
    const boundText = API.createElement({
      type: "text",
      strokeColor: "red",
      containerId: container.id,
    });

    API.setElements([container, boundText]);
    API.setSelectedElements([container]);

    API.executeAction(actionSelectSameColor);

    expect(h.state.selectedElementIds).toEqual({ [container.id]: true });
  });

  it("is not applicable without a selection", () => {
    const rect = API.createElement({ type: "rectangle", strokeColor: "red" });
    API.setElements([rect]);

    expect(actionSelectSameColor.predicate!(h.elements, h.state)).toBe(false);
  });
});
