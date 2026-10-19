import React, { useState } from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { editorJotaiStore } from "../editor-jotai";
import { act, fireEvent, render, screen, waitFor } from "../tests/test-utils";

import { Dialog } from "./Dialog";
import { isLibraryMenuOpenAtom } from "./LibraryMenu";

const DialogHarness = ({
  buttons,
  autofocus,
  onCloseRequest,
}: {
  buttons: string[];
  autofocus?: boolean;
  onCloseRequest?: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        open dialog
      </button>
      {isOpen && (
        <Dialog
          title="Test dialog"
          autofocus={autofocus}
          onCloseRequest={() => {
            onCloseRequest?.();
            setIsOpen(false);
          }}
        >
          {buttons.map((label) => (
            <button key={label} type="button">
              {label}
            </button>
          ))}
        </Dialog>
      )}
    </>
  );
};

const renderAndOpenDialog = async (
  props: React.ComponentProps<typeof DialogHarness>,
) => {
  await render(
    <Excalidraw>
      <DialogHarness {...props} />
    </Excalidraw>,
  );

  const opener = screen.getByRole("button", { name: "open dialog" });
  // Dialog captures `document.activeElement` on mount to restore it on close
  act(() => opener.focus());
  fireEvent.click(opener);

  await waitFor(() => {
    expect(document.querySelector(".Dialog")).not.toBeNull();
  });

  return { opener };
};

const getDialogButton = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

describe("Dialog", () => {
  afterEach(() => {
    editorJotaiStore.set(isLibraryMenuOpenAtom, false);
  });

  describe("autofocus", () => {
    it("focuses the second focusable element when there is more than one", async () => {
      await renderAndOpenDialog({ buttons: ["first", "second", "third"] });

      await waitFor(() => {
        expect(document.activeElement).toBe(getDialogButton("second"));
      });
    });

    it("focuses the only focusable element when there is just one", async () => {
      await renderAndOpenDialog({ buttons: ["only"] });

      await waitFor(() => {
        expect(document.activeElement).toBe(getDialogButton("only"));
      });
    });

    it("does not move focus when autofocus is false", async () => {
      const { opener } = await renderAndOpenDialog({
        buttons: ["first", "second"],
        autofocus: false,
      });

      // let the deferred autofocus timeout run
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

      expect(document.activeElement).toBe(opener);
      expect(document.activeElement).not.toBe(getDialogButton("first"));
      expect(document.activeElement).not.toBe(getDialogButton("second"));
    });
  });

  describe("focus trap", () => {
    it("wraps Tab from the last focusable element to the first", async () => {
      await renderAndOpenDialog({ buttons: ["first", "second", "third"] });

      const first = getDialogButton("first");
      const third = getDialogButton("third");

      act(() => third.focus());
      const notPrevented = fireEvent.keyDown(third, { key: KEYS.TAB });

      expect(notPrevented).toBe(false);
      expect(document.activeElement).toBe(first);
    });

    it("wraps Shift+Tab from the first focusable element to the last", async () => {
      await renderAndOpenDialog({ buttons: ["first", "second", "third"] });

      const first = getDialogButton("first");
      const third = getDialogButton("third");

      act(() => first.focus());
      const notPrevented = fireEvent.keyDown(first, {
        key: KEYS.TAB,
        shiftKey: true,
      });

      expect(notPrevented).toBe(false);
      expect(document.activeElement).toBe(third);
    });

    it("does not intercept Tab / Shift+Tab away from the boundaries", async () => {
      await renderAndOpenDialog({ buttons: ["first", "second", "third"] });

      const second = getDialogButton("second");

      act(() => second.focus());

      expect(fireEvent.keyDown(second, { key: KEYS.TAB })).toBe(true);
      expect(document.activeElement).toBe(second);

      expect(fireEvent.keyDown(second, { key: KEYS.TAB, shiftKey: true })).toBe(
        true,
      );
      expect(document.activeElement).toBe(second);
    });

    it("does not intercept Shift+Tab on the last or Tab on the first element", async () => {
      await renderAndOpenDialog({ buttons: ["first", "second", "third"] });

      const first = getDialogButton("first");
      const third = getDialogButton("third");

      act(() => third.focus());
      expect(fireEvent.keyDown(third, { key: KEYS.TAB, shiftKey: true })).toBe(
        true,
      );
      expect(document.activeElement).toBe(third);

      act(() => first.focus());
      expect(fireEvent.keyDown(first, { key: KEYS.TAB })).toBe(true);
      expect(document.activeElement).toBe(first);
    });

    it("ignores non-Tab keys at the boundaries", async () => {
      await renderAndOpenDialog({ buttons: ["first", "second", "third"] });

      const third = getDialogButton("third");

      act(() => third.focus());
      fireEvent.keyDown(third, { key: KEYS.ARROW_DOWN });
      expect(document.activeElement).toBe(third);
    });
  });

  describe("closing", () => {
    it("restores focus to the previously active element and resets menu state", async () => {
      const onCloseRequest = vi.fn();
      const { opener } = await renderAndOpenDialog({
        buttons: ["first", "second"],
        onCloseRequest,
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(getDialogButton("second"));
      });

      act(() => {
        window.h.setState({ openMenu: "canvas" });
        editorJotaiStore.set(isLibraryMenuOpenAtom, true);
      });
      expect(window.h.state.openMenu).toBe("canvas");

      fireEvent.click(document.querySelector(".Modal__background")!);

      await waitFor(() => {
        expect(document.querySelector(".Dialog")).toBeNull();
      });
      expect(onCloseRequest).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(opener);
      expect(window.h.state.openMenu).toBeNull();
      expect(editorJotaiStore.get(isLibraryMenuOpenAtom)).toBe(false);
    });

    it("restores focus to the previously active element when closed via Escape", async () => {
      const onCloseRequest = vi.fn();
      const { opener } = await renderAndOpenDialog({
        buttons: ["first", "second"],
        onCloseRequest,
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(getDialogButton("second"));
      });

      fireEvent.keyDown(getDialogButton("second"), { key: KEYS.ESCAPE });

      await waitFor(() => {
        expect(document.querySelector(".Dialog")).toBeNull();
      });
      expect(onCloseRequest).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(opener);
    });
  });
});
