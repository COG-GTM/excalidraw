import { render as rtlRender, fireEvent } from "@testing-library/react";

import { arrayToMap } from "@excalidraw/common";
import { CaptureUpdateAction, LinearElementEditor } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawLineElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

import {
  actionToggleLinearEditor,
  actionTogglePolygon,
} from "./actionLinearEditor";

import type { ActionResult } from "./types";

type PerformResult = Exclude<ActionResult, false>;

const { h } = window;

const square: LocalPoint[] = [
  pointFrom(0, 0),
  pointFrom(100, 0),
  pointFrom(100, 100),
  pointFrom(0, 100),
];

const createLine = (
  id: string,
  opts: {
    points?: LocalPoint[];
    polygon?: boolean;
    backgroundColor?: string;
  } = {},
) =>
  API.createElement({
    type: "line",
    id,
    points: opts.points ?? square,
    polygon: opts.polygon ?? false,
    backgroundColor: opts.backgroundColor ?? "#ffc9c9",
  });

const getLine = (id: string) =>
  h.elements.find((el) => el.id === id) as ExcalidrawLineElement;

describe("actionLinearEditor", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("actionToggleLinearEditor", () => {
    it("labels the action by element type", () => {
      const line = createLine("line");
      const arrow = API.createElement({ type: "arrow", id: "arrow" });
      API.setElements([line, arrow]);
      const label = actionToggleLinearEditor.label as (
        ...args: any[]
      ) => string;

      API.setSelectedElements([arrow]);
      expect(label(h.elements, h.state, h.app)).toBe(
        "labels.lineEditor.editArrow",
      );

      API.setSelectedElements([line]);
      expect(label(h.elements, h.state, h.app)).toBe("labels.lineEditor.edit");

      API.setSelectedElements([]);
      expect(label(h.elements, h.state, h.app)).toBe("labels.lineEditor.edit");
    });

    it("is enabled for a single non-elbow linear element not being edited", () => {
      const line = createLine("line");
      const arrow = API.createElement({ type: "arrow", id: "arrow" });
      const elbow = API.createElement({
        type: "arrow",
        id: "elbow",
        elbowed: true,
      });
      const rect = API.createElement({ id: "rect" });
      API.setElements([line, arrow, elbow, rect]);
      const enabled = () =>
        h.app.actionManager.isActionEnabled(actionToggleLinearEditor);

      API.setSelectedElements([line]);
      expect(enabled()).toBe(true);
      API.setSelectedElements([arrow]);
      expect(enabled()).toBe(true);
      API.setSelectedElements([elbow]);
      expect(enabled()).toBe(false);
      API.setSelectedElements([rect]);
      expect(enabled()).toBe(false);
      API.setSelectedElements([line, arrow]);
      expect(enabled()).toBe(false);

      API.setSelectedElements([line]);
      API.setAppState({
        selectedLinearElement: {
          ...new LinearElementEditor(line, arrayToMap(h.elements)),
          isEditing: true,
        },
      });
      expect(enabled()).toBe(false);
    });

    it("toggles isEditing on the selected linear element", () => {
      const line = createLine("line");
      API.setElements([line]);
      API.setSelectedElements([line]);
      API.setAppState({
        selectedLinearElement: new LinearElementEditor(
          line,
          arrayToMap(h.elements),
        ),
      });

      const result = actionToggleLinearEditor.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      ) as PerformResult;
      expect(result.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
      expect(result.appState?.selectedLinearElement).toMatchObject({
        elementId: line.id,
        isEditing: true,
      });

      API.executeAction(actionToggleLinearEditor);
      expect(h.state.selectedLinearElement?.isEditing).toBe(true);
      API.executeAction(actionToggleLinearEditor);
      expect(h.state.selectedLinearElement?.isEditing).toBe(false);
    });

    it("throws without a selected linear element", () => {
      API.setAppState({ selectedLinearElement: null });
      expect(() =>
        actionToggleLinearEditor.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        ),
      ).toThrow("No selected linear element found");
    });

    it("renders an edit button for the selected element only", () => {
      const arrow = API.createElement({ type: "arrow", id: "arrow" });
      API.setElements([arrow]);

      API.setSelectedElements([]);
      const empty = rtlRender(
        <>{h.app.actionManager.renderAction("toggleLinearEditor")}</>,
      );
      expect(empty.container.querySelector("button")).toBe(null);
      empty.unmount();

      API.setSelectedElements([arrow]);
      const { container, unmount } = rtlRender(
        <>{h.app.actionManager.renderAction("toggleLinearEditor")}</>,
      );
      const button = container.querySelector("button")!;
      expect(button.getAttribute("aria-label")).toBe(
        t("labels.lineEditor.editArrow"),
      );
      unmount();
    });
  });

  describe("actionTogglePolygon", () => {
    it("is enabled only when every selected element is a line with 4+ points", () => {
      const line = createLine("line");
      const short = createLine("short", {
        points: [pointFrom(0, 0), pointFrom(100, 0), pointFrom(100, 100)],
      });
      const arrow = API.createElement({ type: "arrow", id: "arrow" });
      API.setElements([line, short, arrow]);
      const enabled = () =>
        h.app.actionManager.isActionEnabled(actionTogglePolygon);

      API.setSelectedElements([]);
      expect(enabled()).toBe(false);
      API.setSelectedElements([line]);
      expect(enabled()).toBe(true);
      API.setSelectedElements([short]);
      expect(enabled()).toBe(false);
      API.setSelectedElements([line, arrow]);
      expect(enabled()).toBe(false);
    });

    it("labels convert vs break depending on whether all lines are polygons", () => {
      const open = createLine("open");
      const closed = createLine("closed", {
        polygon: true,
        points: [...square, pointFrom(0, 0)],
      });
      API.setElements([open, closed]);
      const label = actionTogglePolygon.label as (...args: any[]) => string;

      API.setSelectedElements([closed]);
      expect(label(h.elements, h.state, h.app)).toBe(
        "labels.polygon.breakPolygon",
      );
      API.setSelectedElements([open, closed]);
      expect(label(h.elements, h.state, h.app)).toBe(
        "labels.polygon.convertToPolygon",
      );
    });

    it("closes open lines into polygons, keeping the background", () => {
      const line = createLine("line", { backgroundColor: "#ffc9c9" });
      API.setElements([line]);
      API.setSelectedElements([line]);

      API.executeAction(actionTogglePolygon);

      const next = getLine("line");
      expect(next.polygon).toBe(true);
      expect(next.points).toHaveLength(5);
      expect(next.points[next.points.length - 1]).toEqual(next.points[0]);
      expect(next.backgroundColor).toBe("#ffc9c9");
    });

    it("converts all lines when the selection mixes polygons and open lines", () => {
      const open = createLine("open");
      const closed = createLine("closed", {
        polygon: true,
        points: [...square, pointFrom(0, 0)],
      });
      API.setElements([open, closed]);
      API.setSelectedElements([open, closed]);

      API.executeAction(actionTogglePolygon);

      expect(getLine("open").polygon).toBe(true);
      expect(getLine("closed").polygon).toBe(true);
    });

    it("breaks polygons and clears their background", () => {
      const closed = createLine("closed", {
        polygon: true,
        points: [...square, pointFrom(0, 0)],
        backgroundColor: "#ffc9c9",
      });
      const other = createLine("other");
      API.setElements([closed, other]);
      API.setSelectedElements([closed]);

      API.executeAction(actionTogglePolygon);

      expect(getLine("closed").polygon).toBe(false);
      expect(getLine("closed").backgroundColor).toBe("transparent");
      expect(getLine("other")).toBe(other);
    });

    it("returns false when a non-line is selected", () => {
      const line = createLine("line");
      const rect = API.createElement({ id: "rect" });
      API.setElements([line, rect]);
      API.setSelectedElements([line, rect]);

      expect(
        actionTogglePolygon.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        ),
      ).toBe(false);
    });

    it("is undoable as a single step", () => {
      const line = createLine("line");
      API.updateScene({
        elements: [line],
        appState: { selectedElementIds: { [line.id]: true } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      const undoStackSize = API.getUndoStack().length;

      API.executeAction(actionTogglePolygon);
      expect(API.getUndoStack().length).toBe(undoStackSize + 1);
      expect(getLine("line").polygon).toBe(true);

      Keyboard.undo();
      expect(getLine("line").polygon).toBe(false);
      expect(getLine("line").points).toHaveLength(4);

      Keyboard.redo();
      expect(getLine("line").polygon).toBe(true);
    });

    it("shows the polygon toggle only when every selected line is a polygon", () => {
      const open = createLine("open");
      const closed = createLine("closed", {
        polygon: true,
        points: [...square, pointFrom(0, 0)],
      });
      API.setElements([open, closed]);

      API.setSelectedElements([open, closed]);
      const hidden = rtlRender(
        <>{h.app.actionManager.renderAction("togglePolygon")}</>,
      );
      expect(hidden.container.querySelector("input, button")).toBe(null);
      hidden.unmount();

      API.setSelectedElements([closed]);
      const { container, unmount } = rtlRender(
        <>{h.app.actionManager.renderAction("togglePolygon")}</>,
      );
      const toggle = container.querySelector("button")!;
      expect(toggle.getAttribute("aria-label")).toBe(
        t("labels.polygon.breakPolygon"),
      );
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(toggle);
      unmount();

      expect(getLine("closed").polygon).toBe(false);
    });
  });
});
