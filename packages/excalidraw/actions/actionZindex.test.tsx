import React from "react";
import { it, vi } from "vitest";

import { CODES } from "@excalidraw/common";

import type { NonDeleted } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render, unmountComponent } from "../tests/test-utils";

import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actionZindex";

import type { KeyboardModifiers } from "../tests/helpers/ui";

const platform = vi.hoisted(() => ({ isDarwin: false }));

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  return {
    __esmodule: true,
    ...module,
    get isDarwin() {
      return platform.isDarwin;
    },
    KEYS: {
      ...module.KEYS,
      // the Keyboard test helper only emits `ctrlKey`
      CTRL_OR_CMD: "ctrlKey",
    },
  };
});

const { h } = window;

const press = (modifiers: KeyboardModifiers, code: string) => {
  Keyboard.withModifierKeys(modifiers, () => {
    Keyboard.codePress(code);
  });
};

const order = () => h.elements.map((element) => element.id);

const select = (id: string) =>
  API.setSelectedElements(
    h.elements.filter((element) => element.id === id) as NonDeleted<
      typeof h.elements[number]
    >[],
  );

const setup = async (selectedId: string) => {
  const elements = ["A", "B", "C", "D"].map((id, index) =>
    API.createElement({
      type: "rectangle",
      id,
      x: index * 10,
      y: index * 10,
      width: 100,
      height: 100,
    }),
  );
  await render(
    <Excalidraw handleKeyboardGlobally={true} initialData={{ elements }} />,
  );
  select(selectedId);
  expect(order()).toEqual(["A", "B", "C", "D"]);
};

describe("z-index keyboard shortcuts", () => {
  afterEach(() => {
    unmountComponent();
    platform.isDarwin = false;
  });

  describe.each([
    { name: "non-darwin", isDarwin: false },
    { name: "darwin", isDarwin: true },
  ])("on $name", ({ isDarwin }) => {
    beforeEach(() => {
      platform.isDarwin = isDarwin;
    });

    it("CtrlOrCmd+[ sends the selected element backward one step", async () => {
      await setup("C");
      press({ ctrl: true }, CODES.BRACKET_LEFT);
      expect(order()).toEqual(["A", "C", "B", "D"]);
      press({ ctrl: true }, CODES.BRACKET_LEFT);
      expect(order()).toEqual(["C", "A", "B", "D"]);
    });

    it("CtrlOrCmd+] brings the selected element forward one step", async () => {
      await setup("B");
      press({ ctrl: true }, CODES.BRACKET_RIGHT);
      expect(order()).toEqual(["A", "C", "B", "D"]);
      press({ ctrl: true }, CODES.BRACKET_RIGHT);
      expect(order()).toEqual(["A", "C", "D", "B"]);
    });

    it("does nothing without the CtrlOrCmd modifier", async () => {
      await setup("B");
      press({}, CODES.BRACKET_LEFT);
      press({}, CODES.BRACKET_RIGHT);
      press({ shift: true }, CODES.BRACKET_LEFT);
      press({ alt: true }, CODES.BRACKET_RIGHT);
      expect(order()).toEqual(["A", "B", "C", "D"]);
    });

    it("sendBackward/bringForward shortcuts are undoable", async () => {
      await setup("C");
      press({ ctrl: true }, CODES.BRACKET_LEFT);
      expect(order()).toEqual(["A", "C", "B", "D"]);
      Keyboard.undo();
      expect(order()).toEqual(["A", "B", "C", "D"]);
      select("C");
      press({ ctrl: true }, CODES.BRACKET_RIGHT);
      expect(order()).toEqual(["A", "B", "D", "C"]);
      Keyboard.undo();
      expect(order()).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("on non-darwin (Shift variants)", () => {
    it("CtrlOrCmd+Shift+[ sends the selected element to back", async () => {
      await setup("C");
      press({ ctrl: true, shift: true }, CODES.BRACKET_LEFT);
      expect(order()).toEqual(["C", "A", "B", "D"]);
    });

    it("CtrlOrCmd+Shift+] brings the selected element to front", async () => {
      await setup("B");
      press({ ctrl: true, shift: true }, CODES.BRACKET_RIGHT);
      expect(order()).toEqual(["A", "C", "D", "B"]);
    });

    it("CtrlOrCmd+Alt+[/] only moves one step (Alt is not the to-back/front modifier)", async () => {
      await setup("C");
      press({ ctrl: true, alt: true }, CODES.BRACKET_LEFT);
      expect(order()).toEqual(["A", "C", "B", "D"]);
      press({ ctrl: true, alt: true }, CODES.BRACKET_RIGHT);
      expect(order()).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("on darwin (Alt variants)", () => {
    beforeEach(() => {
      platform.isDarwin = true;
    });

    const event = (
      modifiers: { alt?: boolean; shift?: boolean },
      code: string,
    ) =>
      new KeyboardEvent("keydown", {
        code,
        ctrlKey: true,
        altKey: !!modifiers.alt,
        shiftKey: !!modifiers.shift,
      });

    it("sendToBack/bringToFront keyTest matches CtrlOrCmd+Alt, not CtrlOrCmd+Shift", () => {
      expect(
        actionSendToBack.keyTest!(event({ alt: true }, CODES.BRACKET_LEFT)),
      ).toBe(true);
      expect(
        actionBringToFront.keyTest!(event({ alt: true }, CODES.BRACKET_RIGHT)),
      ).toBe(true);
      expect(
        actionSendToBack.keyTest!(event({ shift: true }, CODES.BRACKET_LEFT)),
      ).toBe(false);
      expect(
        actionBringToFront.keyTest!(
          event({ shift: true }, CODES.BRACKET_RIGHT),
        ),
      ).toBe(false);
    });

    it("CtrlOrCmd+Alt+[/] also satisfies the sendBackward/bringForward keyTest", () => {
      // sendBackward/bringForward only reject Shift, so on darwin the Alt
      // variant matches two actions and ActionManager cancels the shortcut.
      expect(
        actionSendBackward.keyTest!(event({ alt: true }, CODES.BRACKET_LEFT)),
      ).toBe(true);
      expect(
        actionBringForward.keyTest!(event({ alt: true }, CODES.BRACKET_RIGHT)),
      ).toBe(true);
    });

    // Known bug: see the keyTest overlap above. Remove `.fails` once fixed.
    it.fails("CtrlOrCmd+Alt+[ sends the selected element to back", async () => {
      await setup("C");
      press({ ctrl: true, alt: true }, CODES.BRACKET_LEFT);
      expect(order()).toEqual(["C", "A", "B", "D"]);
    });

    it.fails(
      "CtrlOrCmd+Alt+] brings the selected element to front",
      async () => {
        await setup("B");
        press({ ctrl: true, alt: true }, CODES.BRACKET_RIGHT);
        expect(order()).toEqual(["A", "C", "D", "B"]);
      },
    );

    it("CtrlOrCmd+Shift+[/] does not reorder (Shift is not the darwin modifier)", async () => {
      await setup("B");
      press({ ctrl: true, shift: true }, CODES.BRACKET_LEFT);
      press({ ctrl: true, shift: true }, CODES.BRACKET_RIGHT);
      expect(order()).toEqual(["A", "B", "C", "D"]);
    });
  });
});
