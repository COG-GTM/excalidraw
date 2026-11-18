import React from "react";

import { pointFrom } from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";
import {
  actionBringToFront,
  actionDeleteSelected,
  actionDuplicateSelection,
  actionFlipHorizontal,
  actionGroup,
  actionSendToBack,
  actionUngroup,
} from "@excalidraw/excalidraw/actions";
import { actionWrapTextInContainer } from "@excalidraw/excalidraw/actions/actionBoundText";
import { defaultLang, setLanguage } from "@excalidraw/excalidraw/i18n";
import {
  actionChangeOpacity,
  actionChangeStrokeColor,
} from "@excalidraw/excalidraw/actions/actionProperties";
import { actionWrapSelectionInFrame } from "@excalidraw/excalidraw/actions/actionFrame";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { act, render } from "@excalidraw/excalidraw/tests/test-utils";

import type { LocalPoint } from "@excalidraw/math";

import type { Action } from "@excalidraw/excalidraw/actions/types";

import { CaptureUpdateAction } from "../src/store";

import type { NonDeletedExcalidrawElement } from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

const exec = (action: Action, value?: unknown) =>
  act(() => {
    h.app.actionManager.executeAction(action, "api", value);
  });

const undoAll = () => {
  while (API.getUndoStack().length) {
    Keyboard.undo();
  }
};
const redoAll = () => {
  while (API.getRedoStack().length) {
    Keyboard.redo();
  }
};

const snapshot = () =>
  h.elements.map((el) => ({
    id: el.id,
    x: el.x,
    y: el.y,
    isDeleted: el.isDeleted,
    strokeColor: el.strokeColor,
    groupIds: el.groupIds,
    frameId: el.frameId,
  }));

describe("history (deltas + store) integration", () => {
  beforeEach(async () => {
    mouse.reset();
    await act(() => setLanguage(defaultLang));
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("undoes and redoes element creation, property changes and removal", () => {
    const rect = UI.createElement("rectangle", { x: 0, y: 0, size: 100 });
    const ellipse = UI.createElement("ellipse", { x: 200, y: 0, size: 100 });

    API.setSelectedElements([rect, ellipse] as NonDeletedExcalidrawElement[]);
    exec(actionChangeStrokeColor, { currentItemStrokeColor: "#e03131" });
    exec(actionChangeOpacity, 50);
    exec(actionFlipHorizontal);
    exec(actionSendToBack);
    exec(actionBringToFront);
    exec(actionGroup);
    exec(actionDuplicateSelection);
    exec(actionUngroup);
    exec(actionDeleteSelected);

    const after = snapshot();
    expect(after.some((el) => el.isDeleted)).toBe(true);

    undoAll();
    expect(h.elements.filter((el) => !el.isDeleted)).toHaveLength(0);

    redoAll();
    expect(snapshot()).toEqual(after);
  });

  it("restores arrow bindings and bound text across undo/redo", () => {
    const rect1 = UI.createElement("rectangle", { x: 0, y: 0, size: 100 });
    const rect2 = UI.createElement("rectangle", { x: 300, y: 0, size: 100 });

    UI.clickTool("arrow");
    mouse.reset();
    mouse.downAt(50, 50);
    mouse.moveTo(350, 50);
    mouse.up();

    const arrow = API.getSelectedElement();
    expect(arrow.type).toBe("arrow");

    API.setSelectedElements([rect1] as NonDeletedExcalidrawElement[]);
    exec(actionWrapTextInContainer);

    // move the bound shape so the arrow is updated
    mouse.reset();
    mouse.downAt(350, 50);
    mouse.moveTo(350, 250);
    mouse.up();

    API.setSelectedElements([rect2] as NonDeletedExcalidrawElement[]);
    exec(actionDeleteSelected);

    const after = snapshot();
    undoAll();
    redoAll();
    expect(snapshot()).toEqual(after);

    Keyboard.undo();
    expect(API.getElement(rect2).isDeleted).toBe(false);
  });

  it("wraps selection in a frame and reverts it", () => {
    const rect = UI.createElement("rectangle", { x: 0, y: 0, size: 50 });
    const diamond = UI.createElement("diamond", { x: 100, y: 0, size: 50 });

    API.setSelectedElements([rect, diamond] as NonDeletedExcalidrawElement[]);
    exec(actionWrapSelectionInFrame);

    const frame = h.elements.find((el) => el.type === "frame")!;
    expect(API.getElement(rect).frameId).toBe(frame.id);

    Keyboard.undo();
    expect(API.getElement(rect).frameId).toBe(null);
    Keyboard.redo();
    expect(API.getElement(rect).frameId).toBe(frame.id);
  });

  it("applies remote updates without breaking local history", () => {
    const rect = UI.createElement("rectangle", { x: 0, y: 0, size: 100 });
    const line = API.createElement({
      type: "line",
      x: 10,
      y: 10,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(50, 50)],
    });
    const text = API.createElement({ type: "text", text: "hello", x: 300 });

    // remote insertion (never captured)
    act(() => {
      API.updateScene({
        elements: [...h.elements, line, text],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    // remote modification of a locally created element
    act(() => {
      API.updateScene({
        elements: h.elements.map((el) =>
          el.id === rect.id
            ? { ...el, x: 500, version: el.version + 1, versionNonce: 1 }
            : el,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    // local captured change on top
    act(() => {
      API.updateScene({
        elements: h.elements.map((el) =>
          el.id === text.id
            ? { ...el, y: 200, version: el.version + 1, versionNonce: 2 }
            : el,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    Keyboard.undo();
    expect(API.getElement(text).y).toBe(text.y);
    expect(API.getElement(rect).x).toBe(500);
    Keyboard.undo();
    expect(API.getElement(rect).isDeleted).toBe(true);
    redoAll();
    expect(API.getElement(rect).isDeleted).toBe(false);
    expect(API.getElement(text).y).toBe(200);
  });

  it("records app state changes (selection, editing groups)", () => {
    const a = UI.createElement("rectangle", { x: 0, y: 0, size: 50 });
    const b = UI.createElement("rectangle", { x: 100, y: 0, size: 50 });

    API.setSelectedElements([a, b] as NonDeletedExcalidrawElement[]);
    exec(actionGroup);
    API.clearSelection();
    API.setSelectedElements([a] as NonDeletedExcalidrawElement[]);

    act(() => {
      API.updateScene({
        appState: { viewBackgroundColor: "#ffc9c9" },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    undoAll();
    expect(h.state.viewBackgroundColor).not.toBe("#ffc9c9");
    redoAll();
    expect(h.state.viewBackgroundColor).toBe("#ffc9c9");
  });
});
