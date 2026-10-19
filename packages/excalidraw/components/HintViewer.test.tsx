import React from "react";
import { render } from "@testing-library/react";

import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";

import type { EditorInterface } from "@excalidraw/common";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import {
  act,
  render as renderExcalidraw,
  unmountComponent,
} from "../tests/test-utils";

import { HintViewer } from "./HintViewer";

import type { AppClassProperties, UIAppState } from "../types";

const desktopEditorInterface = {
  formFactor: "desktop",
  desktopUIMode: "full",
  userAgent: {
    isMobileDevice: false,
    platform: "other",
  },
  isTouchScreen: false,
  canFitSidebar: true,
  isLandscape: true,
} as EditorInterface;

const createApp = ({
  selectedElements = [],
  sceneElements = selectedElements,
  gridModeEnabled = false,
}: {
  selectedElements?: NonDeletedExcalidrawElement[];
  sceneElements?: NonDeletedExcalidrawElement[];
  gridModeEnabled?: boolean;
} = {}) =>
  ({
    scene: {
      getSelectedElements: () => selectedElements,
      getNonDeletedElementsMap: () =>
        new Map(sceneElements.map((element) => [element.id, element])),
    },
    props: {},
    state: { gridModeEnabled },
  } as unknown as AppClassProperties);

const createAppState = (overrides: Record<string, unknown> = {}) =>
  ({
    ...getDefaultAppState(),
    width: 1000,
    height: 1000,
    offsetLeft: 0,
    offsetTop: 0,
    ...overrides,
  } as unknown as UIAppState);

const activeTool = (type: string) => ({
  ...getDefaultAppState().activeTool,
  type,
});

const renderHint = ({
  appState = {},
  selectedElements,
  sceneElements,
  gridModeEnabled,
  isMobile = false,
  editorInterface = desktopEditorInterface,
}: {
  appState?: Record<string, unknown>;
  selectedElements?: NonDeletedExcalidrawElement[];
  sceneElements?: NonDeletedExcalidrawElement[];
  gridModeEnabled?: boolean;
  isMobile?: boolean;
  editorInterface?: EditorInterface;
} = {}) => {
  const { container } = render(
    <HintViewer
      appState={createAppState(appState)}
      isMobile={isMobile}
      editorInterface={editorInterface}
      app={createApp({ selectedElements, sceneElements, gridModeEnabled })}
    />,
  );
  const hintViewer = container.querySelector(".HintViewer");
  return {
    hintViewer,
    text: hintViewer?.textContent ?? null,
    kbds: Array.from(container.querySelectorAll(".HintViewer kbd")).map(
      (kbd) => kbd.textContent,
    ),
  };
};

describe("<HintViewer/>", () => {
  describe("priority branches", () => {
    it("shows the dismiss-search hint when canvas search has matches", () => {
      const { text, kbds } = renderHint({
        appState: {
          openSidebar: { name: DEFAULT_SIDEBAR.name, tab: CANVAS_SEARCH_TAB },
          searchMatches: { focusedId: null, matches: [{ id: "a" }] },
          // lower-priority branch must not win
          activeTool: activeTool("eraser"),
        },
      });
      expect(text).toBe("Esc to dismiss search");
      expect(kbds).toEqual(["Esc"]);
    });

    it("does not show the dismiss-search hint when search has no matches", () => {
      const { text } = renderHint({
        appState: {
          openSidebar: { name: DEFAULT_SIDEBAR.name, tab: CANVAS_SEARCH_TAB },
          searchMatches: { focusedId: null, matches: [] },
          activeTool: activeTool("eraser"),
        },
      });
      expect(text).toBe("Hold Alt to revert the elements marked for deletion");
    });

    it("renders nothing when a sidebar is open and cannot fit", () => {
      const { hintViewer } = renderHint({
        appState: {
          openSidebar: { name: DEFAULT_SIDEBAR.name },
          activeTool: activeTool("eraser"),
        },
        editorInterface: { ...desktopEditorInterface, canFitSidebar: false },
      });
      expect(hintViewer).toBeNull();
    });

    it("still shows hints when the open sidebar can fit", () => {
      const { text } = renderHint({
        appState: {
          openSidebar: { name: DEFAULT_SIDEBAR.name },
          activeTool: activeTool("freedraw"),
        },
      });
      expect(text).toBe("Click and drag, release when you're finished");
    });

    it("shows the eraser revert hint", () => {
      const { text, kbds } = renderHint({
        appState: { activeTool: activeTool("eraser") },
      });
      expect(text).toBe("Hold Alt to revert the elements marked for deletion");
      expect(kbds).toEqual(["Alt"]);
    });

    it("shows arrow bind modifiers while dragging an arrow point", () => {
      const arrow = API.createElement({ type: "arrow" });
      const { text, kbds } = renderHint({
        appState: {
          activeTool: activeTool("arrow"),
          selectedLinearElement: { elementId: arrow.id, isDragging: true },
        },
        selectedElements: [arrow],
      });
      expect(text).toBe(
        "Hold Ctrl to disable binding, or Alt to bind at a fixed point",
      );
      expect(kbds).toEqual(["Ctrl", "Alt"]);
    });

    it("does not show arrow bind modifiers when dragging a line point", () => {
      const line = API.createElement({ type: "line" });
      const { text } = renderHint({
        appState: {
          activeTool: activeTool("line"),
          selectedLinearElement: { elementId: line.id, isDragging: true },
        },
        selectedElements: [line],
      });
      expect(text).toBe("Click to start multiple points, drag for single line");
    });
  });

  describe("tool hints", () => {
    it("shows the multi-point hint for arrow and line tools in multi mode", () => {
      for (const tool of ["arrow", "line"]) {
        const { text, kbds } = renderHint({
          appState: {
            activeTool: activeTool(tool),
            multiElement: API.createElement({ type: "arrow" }),
          },
        });
        expect(text).toBe(
          "Click on last point or press Esc or Enter to finish",
        );
        expect(kbds).toEqual(["Esc", "Enter"]);
        unmountComponent();
      }
    });

    it("shows the arrow tool hint", () => {
      const { text, kbds } = renderHint({
        appState: { activeTool: activeTool("arrow") },
      });
      expect(text).toBe(
        "Click to start multiple points, drag for single line. Press A again to change arrow type.",
      );
      expect(kbds).toEqual(["A"]);
    });

    it("shows the line tool hint", () => {
      const { text, kbds } = renderHint({
        appState: { activeTool: activeTool("line") },
      });
      expect(text).toBe("Click to start multiple points, drag for single line");
      expect(kbds).toEqual([]);
    });

    it.each([
      ["freedraw", "Click and drag, release when you're finished"],
      [
        "text",
        "Tip: you can also add text by double-clicking anywhere with the selection tool",
      ],
      ["embeddable", "Click-drag to create a website embed"],
      ["autoshape", "Draw rectangles, circles, diamonds, lines and arrows"],
    ])("shows the %s tool hint", (tool, expected) => {
      const { text, kbds } = renderHint({
        appState: { activeTool: activeTool(tool) },
      });
      expect(text).toBe(expected);
      expect(kbds).toEqual([]);
    });

    it("shows no hint for tools without a hint and nothing selected", () => {
      const { hintViewer } = renderHint({
        appState: { activeTool: activeTool("rectangle") },
      });
      expect(hintViewer).toBeNull();
    });
  });

  describe("resize and rotate", () => {
    it("shows the lock-angle hint when resizing a two-point linear element", () => {
      const { text, kbds } = renderHint({
        appState: { isResizing: true, lastPointerDownWith: "mouse" },
        selectedElements: [API.createElement({ type: "line" })],
      });
      expect(text).toBe("You can constrain angle by holding Shift");
      expect(kbds).toEqual(["Shift"]);
    });

    it("shows the generic resize hint for multi-point linear elements", () => {
      const { text } = renderHint({
        appState: { isResizing: true, lastPointerDownWith: "mouse" },
        selectedElements: [
          API.createElement({
            type: "line",
            points: [
              [0, 0],
              [10, 10],
              [20, 0],
            ] as any,
          }),
        ],
      });
      expect(text).toBe(
        "You can constrain proportions by holding Shift while resizing,\nhold Alt to resize from the center",
      );
    });

    it("shows the image resize hint when resizing an image", () => {
      const { text, kbds } = renderHint({
        appState: { isResizing: true, lastPointerDownWith: "mouse" },
        selectedElements: [API.createElement({ type: "image" })],
      });
      expect(text).toBe(
        "You can resize freely by holding Shift,\nhold Alt to resize from the center",
      );
      expect(kbds).toEqual(["Shift", "Alt"]);
    });

    it("shows the resize hint when resizing a shape", () => {
      const { text, kbds } = renderHint({
        appState: { isResizing: true, lastPointerDownWith: "mouse" },
        selectedElements: [API.createElement({ type: "rectangle" })],
      });
      expect(text).toBe(
        "You can constrain proportions by holding Shift while resizing,\nhold Alt to resize from the center",
      );
      expect(kbds).toEqual(["Shift", "Alt"]);
    });

    it("does not show the resize hint for touch resizing or multi-selection", () => {
      const rect = API.createElement({ type: "rectangle" });
      expect(
        renderHint({
          appState: { isResizing: true, lastPointerDownWith: "touch" },
          selectedElements: [rect],
        }).text,
      ).toBe("Enter to add text, Ctrl + ↑↓ to create a flowchart");
      unmountComponent();
      expect(
        renderHint({
          appState: { isResizing: true, lastPointerDownWith: "mouse" },
          selectedElements: [rect, API.createElement({ type: "ellipse" })],
        }).hintViewer,
      ).toBeNull();
    });

    it("shows the rotate hint when rotating with the mouse", () => {
      const { text, kbds } = renderHint({
        appState: { isRotating: true, lastPointerDownWith: "mouse" },
        selectedElements: [API.createElement({ type: "rectangle" })],
      });
      expect(text).toBe(
        "You can constrain angles by holding Shift while rotating",
      );
      expect(kbds).toEqual(["Shift"]);
    });
  });

  describe("text, crop and image", () => {
    it("shows the edit-text hint when a single text element is selected", () => {
      const { text, kbds } = renderHint({
        selectedElements: [API.createElement({ type: "text", text: "hi" })],
      });
      expect(text).toBe("Double-click or press Enter to edit text");
      expect(kbds).toEqual(["Enter"]);
    });

    it("shows the finish-editing hint while editing text", () => {
      const { text, kbds } = renderHint({
        appState: {
          editingTextElement: API.createElement({ type: "text", text: "hi" }),
        },
      });
      expect(text).toBe("Press Esc or Ctrl + Enter to finish editing");
      expect(kbds).toEqual(["Esc", "Ctrl + Enter"]);
    });

    it("shows the leave-crop-editor hint while cropping", () => {
      const image = API.createElement({ type: "image" });
      const { text, kbds } = renderHint({
        appState: { croppingElementId: image.id },
        selectedElements: [image],
      });
      expect(text).toBe(
        "Click outside the image or press Enter or Esc to finish cropping",
      );
      expect(kbds).toEqual(["Enter", "Esc"]);
    });

    it("shows the enter-crop-editor hint when a single image is selected", () => {
      const { text, kbds } = renderHint({
        selectedElements: [API.createElement({ type: "image" })],
      });
      expect(text).toBe(
        "Double click the image or press Enter to crop the image",
      );
      expect(kbds).toEqual(["Enter"]);
    });
  });

  describe("selection tool", () => {
    it("shows the deep box select hint while box selecting", () => {
      const { text, kbds } = renderHint({
        appState: {
          selectionElement: API.createElement({ type: "rectangle" }),
        },
      });
      expect(text).toBe("Hold Ctrl to deep select, and to prevent dragging");
      expect(kbds).toEqual(["Ctrl"]);
    });

    it("shows the disable-snapping hint when dragging in grid mode", () => {
      const rect = API.createElement({ type: "rectangle" });
      const { text, kbds } = renderHint({
        appState: { selectedElementsAreBeingDragged: true },
        selectedElements: [rect],
        gridModeEnabled: true,
      });
      expect(text).toBe("Hold Ctrl to disable snapping");
      expect(kbds).toEqual(["Ctrl"]);
    });

    it("shows the canvas panning hint when nothing is selected on desktop", () => {
      const { text, kbds } = renderHint();
      expect(text).toBe(
        "To move canvas, hold Scroll wheel or Space while dragging, or use the hand tool",
      );
      expect(kbds).toEqual(["Scroll wheel", "Space"]);
    });

    it("shows no canvas panning hint on mobile", () => {
      const { hintViewer } = renderHint({ isMobile: true });
      expect(hintViewer).toBeNull();
    });

    it("shows the toggle arrowhead hint when hovering an arrow endpoint", () => {
      const arrow = API.createElement({ type: "arrow" });
      for (const hoverPointIndex of [0, arrow.points.length - 1]) {
        const { text } = renderHint({
          appState: {
            selectedLinearElement: { elementId: arrow.id, hoverPointIndex },
          },
          selectedElements: [arrow],
        });
        expect(text).toBe("Double-click to toggle the arrowhead");
        unmountComponent();
      }
    });

    it("shows the line editor point-selected hint", () => {
      const line = API.createElement({ type: "line" });
      const { text, kbds } = renderHint({
        appState: {
          selectedLinearElement: {
            elementId: line.id,
            isEditing: true,
            hoverPointIndex: -1,
            selectedPointsIndices: [0],
          },
        },
        selectedElements: [line],
      });
      expect(text).toBe(
        "Press Delete to remove point(s),\nCtrl + D to duplicate, or drag to move",
      );
      expect(kbds).toEqual(["Delete", "Ctrl + D"]);
    });

    it("shows the line editor nothing-selected hint", () => {
      const line = API.createElement({ type: "line" });
      const { text, kbds } = renderHint({
        appState: {
          selectedLinearElement: {
            elementId: line.id,
            isEditing: true,
            hoverPointIndex: -1,
            selectedPointsIndices: null,
          },
        },
        selectedElements: [line],
      });
      expect(text).toBe(
        "Select a point to edit (hold Shift to select multiple),\nor hold Alt and click to add new points",
      );
      expect(kbds).toEqual(["Shift", "Alt"]);
    });

    it("shows the line info hint for a selected line", () => {
      const { text, kbds } = renderHint({
        selectedElements: [API.createElement({ type: "line" })],
      });
      expect(text).toBe("Double-click or press Enter to edit points");
      expect(kbds).toEqual(["Enter"]);
    });

    it("shows the arrow info hint for a selected arrow", () => {
      const { text, kbds } = renderHint({
        selectedElements: [API.createElement({ type: "arrow" })],
      });
      expect(text).toBe(
        "Hold Ctrl and Double-click or press Ctrl + Enter to edit points",
      );
      expect(kbds).toEqual(["Ctrl", "Ctrl + Enter"]);
    });

    it("joins bind-text and flowchart hints for flowchart node containers", () => {
      for (const type of ["rectangle", "ellipse", "diamond"] as const) {
        const { text, kbds } = renderHint({
          selectedElements: [API.createElement({ type })],
        });
        expect(text).toBe("Enter to add text, Ctrl + ↑↓ to create a flowchart");
        expect(kbds).toEqual(["Enter", "Ctrl + ↑↓"]);
        unmountComponent();
      }
    });

    it("shows bind-text and flowchart hints for a node already in a flowchart", () => {
      const rect = API.createElement({ type: "rectangle" });
      const arrow = API.createElement({
        type: "arrow",
        startBinding: {
          elementId: rect.id,
          fixedPoint: [1, 0.5],
          mode: "orbit",
        } as any,
      });
      const { text, kbds } = renderHint({
        selectedElements: [rect],
        sceneElements: [rect, arrow],
      });
      expect(text).toBe("Enter to add text, Ctrl + ↑↓ to create a flowchart");
      expect(kbds).toEqual(["Enter", "Ctrl + ↑↓"]);
    });

    it("does not show container hints while dragging or creating", () => {
      const rect = API.createElement({ type: "rectangle" });
      expect(
        renderHint({
          appState: { newElement: rect },
          selectedElements: [rect],
        }).hintViewer,
      ).toBeNull();
      unmountComponent();
      expect(
        renderHint({
          appState: { selectedElementsAreBeingDragged: true },
          selectedElements: [rect],
        }).hintViewer,
      ).toBeNull();
    });

    it("shows no hint for a single non-container element", () => {
      const { hintViewer } = renderHint({
        selectedElements: [API.createElement({ type: "freedraw" })],
      });
      expect(hintViewer).toBeNull();
    });
  });

  describe("in the editor", () => {
    beforeEach(async () => {
      await renderExcalidraw(<Excalidraw />);
    });

    it("updates the hint bar as the active tool changes", () => {
      const hintText = () =>
        document.querySelector(".HintViewer")?.textContent ?? null;

      expect(hintText()).toBe(
        "To move canvas, hold Scroll wheel or Space while dragging, or use the hand tool",
      );

      UI.clickTool("freedraw");
      expect(hintText()).toBe("Click and drag, release when you're finished");

      UI.clickTool("arrow");
      expect(hintText()).toBe(
        "Click to start multiple points, drag for single line. Press A again to change arrow type.",
      );

      UI.clickTool("eraser");
      expect(hintText()).toBe(
        "Hold Alt to revert the elements marked for deletion",
      );

      UI.clickTool("selection");
      const rect = API.createElement({ type: "rectangle" });
      act(() => {
        API.setElements([rect]);
        API.setSelectedElements([rect]);
      });
      expect(hintText()).toBe(
        "Enter to add text, Ctrl + ↑↓ to create a flowchart",
      );
    });
  });
});
