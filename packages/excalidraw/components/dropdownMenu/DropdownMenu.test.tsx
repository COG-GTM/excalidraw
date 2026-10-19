import React from "react";

import { it } from "vitest";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../../index";
import { Keyboard } from "../../tests/helpers/ui";
import {
  render,
  waitFor,
  getByTestId,
  fireEvent,
} from "../../tests/test-utils";

describe("Test <DropdownMenu/>", () => {
  it("should", async () => {
    const { container } = await render(<Excalidraw />);

    expect(window.h.state.openMenu).toBe(null);

    fireEvent.click(getByTestId(container, "main-menu-trigger"));
    expect(window.h.state.openMenu).toBe("canvas");

    await waitFor(() => {
      Keyboard.keyDown(KEYS.ESCAPE);
      expect(window.h.state.openMenu).toBe(null);
    });
  });

  // Known regression from #11974: useOutsideClick reads `ref.current` once on
  // mount, but DropdownMenu.Content mounts closed (no DOM node), so it never
  // subscribes. Flip to `it` once fixed.
  it.fails("closes the main menu on pointerdown outside of it", async () => {
    const { container } = await render(<Excalidraw />);

    fireEvent.click(getByTestId(container, "main-menu-trigger"));
    expect(window.h.state.openMenu).toBe("canvas");

    fireEvent.pointerDown(
      document.querySelector(".dropdown-menu-container")!.firstElementChild!,
    );
    expect(window.h.state.openMenu).toBe("canvas");

    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(window.h.state.openMenu).toBe(null);
    });
  });
});
