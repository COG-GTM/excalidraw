import { pointFrom } from "@excalidraw/math";

import { arrayToMap } from "@excalidraw/common";
import { CaptureUpdateAction, LinearElementEditor } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawLineElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { fireEvent, render } from "../tests/test-utils";

import {
  actionToggleLinearEditor,
  actionTogglePolygon,
} from "./actionLinearEditor";

import type { Action } from "./types";

const { h } = window;

const isEnabled = (action: Parameters<typeof API.executeAction>[0]) =>
  h.app.actionManager.isActionEnabled(action);

const getLabel = (action: Action) =>
  typeof action.label === "function"
    ? action.label(h.elements, h.state, h.app)
    : action.label;

const squarePoints: LocalPoint[] = [
  pointFrom(0, 0),
  pointFrom(100, 0),
  pointFrom(100, 100),
  pointFrom(0, 100),
];

const closedSquarePoints: LocalPoint[] = [...squarePoints, pointFrom(0, 0)];

const createLine = (
  id: string,
  opts: { points?: LocalPoint[]; polygon?: boolean; backgroundColor?: string },
) => {
  const line = API.createElement({
    type: "line",
    id,
    points: opts.points ?? squarePoints,
    backgroundColor: opts.backgroundColor,
  });
  return {
    ...line,
    polygon: opts.polygon ?? false,
  } as NonDeleted<ExcalidrawLineElement>;
};

const getLine = (id: string) =>
  h.elements.find((el) => el.id === id) as ExcalidrawLineElement;

describe("actionLinearEditor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("toggleLinearEditor", () => {
    it("labels the action based on the selected element type", () => {
      const line = createLine("line", {});
      const arrow = API.createElement({ type: "arrow", id: "arrow" });
      API.setElements([line, arrow]);

      API.setSelectedElements([line]);
      expect(getLabel(actionToggleLinearEditor)).toBe("labels.lineEditor.edit");

      API.setSelectedElements([arrow]);
      expect(getLabel(actionToggleLinearEditor)).toBe(
        "labels.lineEditor.editArrow",
      );
    });

    it("is enabled only for a single non-elbow linear element", () => {
      const line = createLine("line", {});
      const elbow = API.createElement({
        type: "arrow",
        id: "elbow",
        elbowed: true,
      });
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([line, elbow, rect]);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionToggleLinearEditor)).toBe(false);

      API.setSelectedElements([elbow]);
      expect(isEnabled(actionToggleLinearEditor)).toBe(false);

      API.setSelectedElements([line, rect]);
      expect(isEnabled(actionToggleLinearEditor)).toBe(false);

      API.setSelectedElements([line]);
      expect(isEnabled(actionToggleLinearEditor)).toBe(true);
    });

    it("toggles the editing state of the selected linear element", () => {
      const line = createLine("line", {});
      API.setElements([line]);
      API.setSelectedElements([line]);
      API.setAppState({
        selectedLinearElement: new LinearElementEditor(
          line,
          arrayToMap(h.elements),
        ),
      });
      expect(h.state.selectedLinearElement?.elementId).toBe(line.id);
      expect(h.state.selectedLinearElement?.isEditing).toBe(false);

      API.executeAction(actionToggleLinearEditor);
      expect(h.state.selectedLinearElement?.isEditing).toBe(true);
      expect(isEnabled(actionToggleLinearEditor)).toBe(false);

      API.executeAction(actionToggleLinearEditor);
      expect(h.state.selectedLinearElement?.isEditing).toBe(false);
    });
  });

  describe("togglePolygon", () => {
    it("is enabled only when every selected element is a line with 4+ points", () => {
      const line = createLine("line", {});
      const shortLine = createLine("short", {
        points: [pointFrom(0, 0), pointFrom(10, 10), pointFrom(20, 0)],
      });
      const arrow = API.createElement({ type: "arrow", id: "arrow" });
      API.setElements([line, shortLine, arrow]);

      API.setSelectedElements([]);
      expect(isEnabled(actionTogglePolygon)).toBe(false);

      API.setSelectedElements([shortLine]);
      expect(isEnabled(actionTogglePolygon)).toBe(false);

      API.setSelectedElements([line, arrow]);
      expect(isEnabled(actionTogglePolygon)).toBe(false);

      API.setSelectedElements([line]);
      expect(isEnabled(actionTogglePolygon)).toBe(true);
    });

    it("labels the action as break only when all selected lines are polygons", () => {
      const open = createLine("open", {});
      const closed = createLine("closed", {
        points: closedSquarePoints,
        polygon: true,
      });
      API.setElements([open, closed]);

      API.setSelectedElements([closed]);
      expect(getLabel(actionTogglePolygon)).toBe("labels.polygon.breakPolygon");

      API.setSelectedElements([open, closed]);
      expect(getLabel(actionTogglePolygon)).toBe(
        "labels.polygon.convertToPolygon",
      );
    });

    it("converts an open line into a closed polygon", () => {
      const line = createLine("line", { backgroundColor: "#ffc9c9" });
      API.setElements([line]);
      API.setSelectedElements([line]);

      API.executeAction(actionTogglePolygon);

      const updated = getLine(line.id);
      expect(updated.polygon).toBe(true);
      expect(updated.points).toHaveLength(5);
      expect(updated.points[4]).toEqual(updated.points[0]);
      expect(updated.backgroundColor).toBe("#ffc9c9");
    });

    it("snaps the last point onto the first when they are close", () => {
      const line = createLine("line", {
        points: [...squarePoints, pointFrom(5, 5)],
      });
      API.setElements([line]);
      API.setSelectedElements([line]);

      API.executeAction(actionTogglePolygon);

      const updated = getLine(line.id);
      expect(updated.polygon).toBe(true);
      expect(updated.points).toHaveLength(5);
      expect(updated.points[4]).toEqual(pointFrom(0, 0));
    });

    it("breaks a polygon and clears its background", () => {
      const line = createLine("line", {
        points: closedSquarePoints,
        polygon: true,
        backgroundColor: "#ffc9c9",
      });
      API.setElements([line]);
      API.setSelectedElements([line]);

      API.executeAction(actionTogglePolygon);

      const updated = getLine(line.id);
      expect(updated.polygon).toBe(false);
      expect(updated.points).toEqual(closedSquarePoints);
      expect(updated.backgroundColor).toBe("transparent");
    });

    it("converts every selected line when at least one is not a polygon", () => {
      const open = createLine("open", {});
      const closed = createLine("closed", {
        points: closedSquarePoints,
        polygon: true,
        backgroundColor: "#ffc9c9",
      });
      const unselected = createLine("unselected", {});
      API.setElements([open, closed, unselected]);
      API.setSelectedElements([open, closed]);

      API.executeAction(actionTogglePolygon);

      expect(getLine(open.id).polygon).toBe(true);
      expect(getLine(closed.id).polygon).toBe(true);
      expect(getLine(closed.id).backgroundColor).toBe("#ffc9c9");
      expect(getLine(unselected.id)).toBe(unselected);
    });

    it("does nothing when a non-line element is selected", () => {
      const line = createLine("line", {});
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([line, rect]);
      API.setSelectedElements([line, rect]);

      API.executeAction(actionTogglePolygon);

      expect(getLine(line.id)).toBe(line);
      expect(getLine(line.id).polygon).toBe(false);
    });

    it("renders the break-polygon toggle only for polygon selections", () => {
      const open = createLine("open", {});
      const closed = createLine("closed", {
        points: closedSquarePoints,
        polygon: true,
      });
      API.setElements([open, closed]);

      API.setSelectedElements([open]);
      expect(document.querySelector('[aria-label="Break polygon"]')).toBeNull();

      API.setSelectedElements([closed]);
      const toggle = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Break polygon"]',
      );
      expect(toggle).not.toBeNull();
      expect(toggle!.getAttribute("aria-pressed")).toBe("true");

      fireEvent.click(toggle!);

      expect(getLine(closed.id).polygon).toBe(false);
    });

    it("records one undoable history entry", () => {
      const line = createLine("line", {});
      API.updateScene({
        elements: [line],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      API.setSelectedElements([line]);

      API.executeAction(actionTogglePolygon);
      expect(getLine(line.id).polygon).toBe(true);

      Keyboard.undo();
      expect(getLine(line.id).polygon).toBe(false);
      expect(getLine(line.id).points).toEqual(squarePoints);

      Keyboard.redo();
      expect(getLine(line.id).polygon).toBe(true);
    });
  });
});
