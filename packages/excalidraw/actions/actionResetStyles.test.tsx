import { fireEvent, queryByTestId } from "@testing-library/react";
import React from "react";

import { DEFAULT_ELEMENT_PROPS, FONT_FAMILY } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { CommandPalette, Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { actionResetStyles } from "./actionResetStyles";

const { h } = window;
const mouse = new Pointer("mouse");

const customStyles = {
  strokeColor: "#e03131",
  backgroundColor: "#ffc9c9",
  fillStyle: "cross-hatch",
  strokeWidth: 4,
  strokeStyle: "dashed",
  roughness: 2,
  opacity: 40,
} as const;

const defaultStyles = {
  strokeColor: DEFAULT_ELEMENT_PROPS.strokeColor,
  backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
  fillStyle: DEFAULT_ELEMENT_PROPS.fillStyle,
  strokeWidth: DEFAULT_ELEMENT_PROPS.strokeWidth,
  strokeStyle: DEFAULT_ELEMENT_PROPS.strokeStyle,
  roughness: DEFAULT_ELEMENT_PROPS.roughness,
  opacity: DEFAULT_ELEMENT_PROPS.opacity,
};

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const pickStyles = (element: ExcalidrawElement) => ({
  strokeColor: element.strokeColor,
  backgroundColor: element.backgroundColor,
  fillStyle: element.fillStyle,
  strokeWidth: element.strokeWidth,
  strokeStyle: element.strokeStyle,
  roughness: element.roughness,
  opacity: element.opacity,
});

const isPredicateTrue = () =>
  actionResetStyles.predicate!(h.elements, h.state, h.app.props, h.app);

describe("actionResetStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("resets styles of selected elements to DEFAULT_ELEMENT_PROPS", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      ...customStyles,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse",
      ...customStyles,
    });
    const untouched = API.createElement({
      type: "diamond",
      id: "untouched",
      ...customStyles,
    });
    API.setElements([rect, ellipse, untouched]);
    API.setSelectedElements([rect, ellipse]);

    API.executeAction(actionResetStyles);

    expect(pickStyles(getElement("rect"))).toEqual(defaultStyles);
    expect(pickStyles(getElement("ellipse"))).toEqual(defaultStyles);
    expect(pickStyles(getElement("untouched"))).toEqual(customStyles);
  });

  it("does not change position, size, roundness, text or font", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      x: 10,
      y: 20,
      width: 300,
      height: 150,
      angle: 1,
      roundness: { type: 3 },
      boundElements: [{ type: "text", id: "label" }],
      ...customStyles,
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "hello",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
      containerId: "container",
      ...customStyles,
    });
    API.setElements([container, label]);
    API.setSelectedElements([container]);

    const geometry = (el: ExcalidrawElement) => ({
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
      roundness: el.roundness,
    });
    const containerBefore = geometry(getElement("container"));
    const labelBefore = geometry(getElement("label"));

    API.executeAction(actionResetStyles);

    const nextContainer = getElement("container");
    const nextLabel = getElement("label");
    expect(geometry(nextContainer)).toEqual(containerBefore);
    expect(geometry(nextLabel)).toEqual(labelBefore);
    expect(nextLabel).toMatchObject({
      text: "hello",
      fontSize: 36,
      fontFamily: FONT_FAMILY.Nunito,
    });
    // bound text is reset together with its selected container
    expect(pickStyles(nextContainer)).toEqual(defaultStyles);
    expect(pickStyles(nextLabel)).toEqual(defaultStyles);
  });

  it("skips locked elements (and text bound to locked containers)", () => {
    const unlocked = API.createElement({
      type: "rectangle",
      id: "unlocked",
      ...customStyles,
    });
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      locked: true,
      boundElements: [{ type: "text", id: "lockedLabel" }],
      ...customStyles,
    });
    const lockedLabel = API.createElement({
      type: "text",
      id: "lockedLabel",
      containerId: "locked",
      ...customStyles,
    });
    API.setElements([unlocked, locked, lockedLabel]);
    API.setSelectedElements([unlocked, locked]);

    API.executeAction(actionResetStyles);

    expect(pickStyles(getElement("unlocked"))).toEqual(defaultStyles);
    expect(pickStyles(getElement("locked"))).toEqual(customStyles);
    expect(pickStyles(getElement("lockedLabel"))).toEqual(customStyles);
  });

  it("predicate requires at least one selected unlocked element", () => {
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      locked: true,
    });
    API.setElements([rect, locked]);

    API.setSelectedElements([]);
    expect(isPredicateTrue()).toBe(false);

    API.setSelectedElements([locked]);
    expect(isPredicateTrue()).toBe(false);

    API.setSelectedElements([rect]);
    expect(isPredicateTrue()).toBe(true);

    API.setSelectedElements([rect, locked]);
    expect(isPredicateTrue()).toBe(true);
  });

  it("is shown in the element context menu but not on an empty canvas", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);

    mouse.rightClickAt(500, 500);
    expect(
      queryByTestId(UI.queryContextMenu()!, actionResetStyles.name),
    ).toBeNull();

    API.setSelectedElements([rect]);
    mouse.rightClickAt(50, 50);
    expect(
      queryByTestId(UI.queryContextMenu()!, actionResetStyles.name),
    ).not.toBeNull();
  });

  it("is undoable in a single step", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      ...customStyles,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      id: "ellipse",
      ...customStyles,
    });
    act(() => {
      API.updateScene({
        elements: [rect, ellipse],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
    API.setSelectedElements([rect, ellipse]);

    API.executeAction(actionResetStyles);
    expect(pickStyles(getElement("rect"))).toEqual(defaultStyles);
    expect(pickStyles(getElement("ellipse"))).toEqual(defaultStyles);

    act(() => {
      Keyboard.undo();
    });

    expect(pickStyles(getElement("rect"))).toEqual(customStyles);
    expect(pickStyles(getElement("ellipse"))).toEqual(customStyles);
  });
});

describe("actionResetStyles in the command palette", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw handleKeyboardGlobally={true}>
        <CommandPalette />
      </Excalidraw>,
    );
  });

  const openPaletteAndSearch = (query: string) => {
    act(() => {
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyDown("/");
      });
    });
    const input = document.querySelector(
      ".command-palette-dialog input",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: query } });
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        ".command-palette-dialog .command-item",
      ),
    ).find((item) => item.textContent?.includes("Reset styles"));
  };

  it("resets styles the same as the context menu", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      ...customStyles,
    });
    const text = API.createElement({
      type: "text",
      id: "text",
      text: "label",
      containerId: "rect",
      ...customStyles,
    });
    API.setElements([
      { ...rect, boundElements: [{ type: "text", id: "text" }] },
      text,
    ]);
    API.setSelectedElements([rect]);
    const { x, y, width, height } = getElement("rect");

    const item = openPaletteAndSearch("Reset styles");
    expect(item).toBeDefined();
    expect(item!.classList.contains("item-disabled")).toBe(false);
    fireEvent.click(item!);

    expect(pickStyles(getElement("rect"))).toEqual(defaultStyles);
    expect(pickStyles(getElement("text"))).toEqual(defaultStyles);
    expect(getElement("rect")).toMatchObject({ x, y, width, height });
    expect(h.state.openDialog).toBeNull();
  });

  it("is not available when nothing is selected", () => {
    API.setElements([
      API.createElement({ type: "rectangle", id: "rect", ...customStyles }),
    ]);

    const item = openPaletteAndSearch("Reset styles");

    expect(item === undefined || item.classList.contains("item-disabled")).toBe(
      true,
    );
    expect(pickStyles(getElement("rect"))).toEqual(customStyles);
  });
});
