import { fireEvent, waitFor } from "@testing-library/react";

import { FONT_FAMILY, KEYS } from "@excalidraw/common";

import type {
  ExcalidrawTextElement,
  FontFamilyValues,
} from "@excalidraw/element/types";

import { Excalidraw } from "../..";
import { API } from "../../tests/helpers/api";
import { Keyboard, UI } from "../../tests/helpers/ui";
import { getTextEditor } from "../../tests/queries/dom";
import { act, render } from "../../tests/test-utils";

const { h } = window;

const getFontList = () =>
  document.querySelector<HTMLElement>(".dropdown-menu.fonts");

const getFontPopover = () =>
  document.querySelector<HTMLElement>(".properties-content")!;

const getSearchInput = () =>
  getFontPopover().querySelector<HTMLInputElement>(".QuickSearch__input")!;

const getFontGroups = () =>
  Array.from(
    getFontList()!.querySelectorAll<HTMLElement>(".dropdown-menu-group"),
  ).map((group) => ({
    title: group.querySelector(".dropdown-menu-group-title")?.textContent,
    fonts: Array.from(group.querySelectorAll("button")).map(
      (button) => button.title,
    ),
  }));

const getFontButton = (title: string) =>
  getFontList()!.querySelector<HTMLButtonElement>(`button[title="${title}"]`)!;

const openFontPicker = () => {
  act(() => {
    UI.clickOnTestId("font-family-show-fonts");
  });
  expect(h.state.openPopup).toBe("fontFamily");
  expect(getFontList()).not.toBeNull();
};

const search = async (term: string) => {
  fireEvent.change(getSearchInput(), { target: { value: term } });
  // QuickSearch onChange is debounced
  await waitFor(() => {
    expect(getSearchInput().value).toBe(term);
  });
};

const pressKey = (key: string, opts: KeyboardEventInit = {}) => {
  fireEvent.keyDown(getFontPopover(), { key, ...opts });
};

const setupSceneWithText = (
  fontFamily: FontFamilyValues = FONT_FAMILY.Virgil,
) => {
  const text = API.createElement({
    type: "text",
    text: "hello",
    fontFamily,
  });
  API.setElements([text]);
  API.setSelectedElements([text]);
  return text;
};

const getTextFontFamily = (id: string) =>
  (h.elements.find((el) => el.id === id) as ExcalidrawTextElement).fontFamily;

describe("FontPicker", () => {
  beforeAll(() => {
    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  });

  it("should be able to open font picker", async () => {
    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    Keyboard.keyPress(KEYS.T);

    const fontPickerTrigger = queryByTestId("font-family-show-fonts");

    expect(fontPickerTrigger).not.toBeNull();

    act(() => {
      fontPickerTrigger!.click();
    });

    expect(getFontList()).not.toBeNull();
  });

  describe("font list", () => {
    it("groups scene fonts separately, sorts fonts and hides private, fallback & deprecated fonts", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      expect(getFontGroups()).toEqual([
        // deprecated fonts used in the scene are still listed
        { title: "In this scene", fonts: ["Virgil"] },
        {
          title: "Available fonts",
          fonts: ["Comic Shanns", "Excalifont", "Lilita One", "Nunito"],
        },
      ]);

      // deprecated scene fonts are badged
      expect(getFontButton("Virgil").textContent).toContain("old");
      expect(getFontButton("Excalifont").textContent).not.toContain("old");

      // currently selected font is marked as such & focusable
      expect(getFontButton("Virgil")).toHaveClass(
        "dropdown-menu-item--selected",
      );
      expect(getFontButton("Virgil").tabIndex).toBe(0);
      expect(getFontButton("Nunito").tabIndex).toBe(-1);
    });

    it("lists deprecated fonts with a badge when showDeprecatedFonts is enabled", async () => {
      await render(
        <Excalidraw handleKeyboardGlobally={true} showDeprecatedFonts={true} />,
      );
      setupSceneWithText(FONT_FAMILY.Excalifont);
      openFontPicker();

      expect(getFontGroups()).toEqual([
        { title: "In this scene", fonts: ["Excalifont"] },
        {
          title: "Available fonts",
          fonts: [
            "Cascadia",
            "Comic Shanns",
            "Helvetica",
            "Lilita One",
            "Nunito",
            "Virgil",
          ],
        },
      ]);

      for (const deprecated of ["Cascadia", "Helvetica", "Virgil"]) {
        expect(getFontButton(deprecated).textContent).toContain("old");
      }
      expect(getFontButton("Nunito").textContent).not.toContain("old");
    });
  });

  describe("search", () => {
    it("filters fonts case-insensitively across groups and hovers the first match", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      await search("NUN");

      await waitFor(() => {
        expect(getFontGroups()).toEqual([
          { title: "Available fonts", fonts: ["Nunito"] },
        ]);
        expect(h.state.currentHoveredFontFamily).toBe(FONT_FAMILY.Nunito);
        expect(getFontButton("Nunito")).toHaveClass(
          "dropdown-menu-item--hovered",
        );
      });

      await search("i");

      await waitFor(() => {
        expect(getFontGroups()).toEqual([
          { title: "In this scene", fonts: ["Virgil"] },
          {
            title: "Available fonts",
            fonts: ["Comic Shanns", "Excalifont", "Lilita One", "Nunito"],
          },
        ]);
      });
    });

    it("shows the empty placeholder and clears hover when nothing matches", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      await search("lil");
      await waitFor(() => {
        expect(h.state.currentHoveredFontFamily).toBe(
          FONT_FAMILY["Lilita One"],
        );
      });

      await search("nonexistent font");

      await waitFor(() => {
        expect(getFontGroups()).toEqual([]);
        expect(getFontList()!.textContent).toContain("No fonts found");
        expect(h.state.currentHoveredFontFamily).toBe(null);
      });
    });
  });

  describe("keyboard navigation", () => {
    it("moves hover with arrow keys, wrapping around the list", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      // list order: Virgil, Comic Shanns, Excalifont, Lilita One, Nunito
      pressKey(KEYS.ARROW_DOWN);
      expect(h.state.currentHoveredFontFamily).toBe(
        FONT_FAMILY["Comic Shanns"],
      );

      pressKey(KEYS.ARROW_DOWN);
      expect(h.state.currentHoveredFontFamily).toBe(FONT_FAMILY.Excalifont);

      pressKey(KEYS.ARROW_UP);
      pressKey(KEYS.ARROW_UP);
      expect(h.state.currentHoveredFontFamily).toBe(FONT_FAMILY.Virgil);

      // wraps from the first to the last item
      pressKey(KEYS.ARROW_UP);
      expect(h.state.currentHoveredFontFamily).toBe(FONT_FAMILY.Nunito);

      // and from the last back to the first
      pressKey(KEYS.ARROW_DOWN);
      expect(h.state.currentHoveredFontFamily).toBe(FONT_FAMILY.Virgil);
    });

    it("selects the hovered font on Enter", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const text = setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      pressKey(KEYS.ARROW_DOWN);
      pressKey(KEYS.ARROW_DOWN);
      expect(h.state.currentHoveredFontFamily).toBe(FONT_FAMILY.Excalifont);

      pressKey(KEYS.ENTER);

      expect(getTextFontFamily(text.id)).toBe(FONT_FAMILY.Excalifont);
      expect(h.state.currentItemFontFamily).toBe(FONT_FAMILY.Excalifont);
      expect(h.state.openPopup).toBe(null);
      expect(h.state.currentHoveredFontFamily).toBe(null);
    });

    it("selects the first search match on Enter", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const text = setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      await search("comic");
      await waitFor(() => {
        expect(h.state.currentHoveredFontFamily).toBe(
          FONT_FAMILY["Comic Shanns"],
        );
      });

      pressKey(KEYS.ENTER);

      expect(getTextFontFamily(text.id)).toBe(FONT_FAMILY["Comic Shanns"]);
      expect(h.state.openPopup).toBe(null);
    });

    it("clears the hover on Escape", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const text = setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      pressKey(KEYS.ARROW_DOWN);
      expect(h.state.currentHoveredFontFamily).toBe(
        FONT_FAMILY["Comic Shanns"],
      );
      // hovering previews the font on the selected element
      expect(getTextFontFamily(text.id)).toBe(FONT_FAMILY["Comic Shanns"]);

      pressKey(KEYS.ESCAPE);

      expect(h.state.currentHoveredFontFamily).toBe(null);
      // escape doesn't commit the hovered font as the current item font
      expect(h.state.currentItemFontFamily).not.toBe(
        FONT_FAMILY["Comic Shanns"],
      );
    });

    it("refocuses the search input on Shift+F", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      act(() => {
        getFontButton("Virgil").focus();
      });
      expect(document.activeElement).not.toBe(getSearchInput());

      pressKey("F", { shiftKey: true });

      expect(document.activeElement).toBe(getSearchInput());
      expect(h.state.openPopup).toBe("fontFamily");
    });
  });

  describe("mouse interaction", () => {
    it("hovers on mouse move and selects on click", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const text = setupSceneWithText(FONT_FAMILY.Virgil);
      openFontPicker();

      fireEvent.mouseMove(getFontButton("Lilita One"));
      expect(h.state.currentHoveredFontFamily).toBe(FONT_FAMILY["Lilita One"]);

      fireEvent.click(getFontButton("Nunito"));

      expect(getTextFontFamily(text.id)).toBe(FONT_FAMILY.Nunito);
      expect(h.state.openPopup).toBe(null);
    });
  });

  describe("while editing text", () => {
    it("restores the text editor caret position after selecting a font", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const text = setupSceneWithText(FONT_FAMILY.Virgil);

      Keyboard.keyPress(KEYS.ENTER);
      const editor = await getTextEditor();
      expect(h.state.editingTextElement?.id).toBe(text.id);
      expect(editor).toHaveClass("excalidraw-wysiwyg");
      expect(editor.value).toBe("hello");
      // the wysiwyg binds its "don't submit on properties interaction"
      // pointerdown listener in the next animation frame
      await act(
        () => new Promise((resolve) => window.requestAnimationFrame(resolve)),
      );

      // interacting with the properties menu must not submit the editor
      const trigger = document.querySelector<HTMLElement>(
        '[data-testid="font-family-show-fonts"]',
      )!;
      fireEvent.pointerDown(trigger);
      openFontPicker();
      fireEvent.pointerUp(trigger);

      editor.selectionStart = 1;
      editor.selectionEnd = 3;
      const focusSpy = vi.spyOn(editor, "focus");

      const nunito = getFontButton("Nunito");
      fireEvent.pointerDown(nunito);
      fireEvent.pointerUp(nunito);
      fireEvent.click(nunito);

      // simulate the caret being lost as a result of the font change
      editor.selectionStart = 5;
      editor.selectionEnd = 5;

      await waitFor(() => {
        expect(editor.isConnected).toBe(true);
        expect(focusSpy).toHaveBeenCalled();
        expect(editor.selectionStart).toBe(1);
        expect(editor.selectionEnd).toBe(3);
      });

      expect(h.state.editingTextElement?.id).toBe(text.id);
      expect(getTextFontFamily(text.id)).toBe(FONT_FAMILY.Nunito);
    });
  });
});
