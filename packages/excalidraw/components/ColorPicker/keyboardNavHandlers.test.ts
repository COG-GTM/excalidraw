import { COLOR_PALETTE } from "@excalidraw/common";

import type { ColorPaletteCustom } from "@excalidraw/common";

import { colorPickerKeyNavHandler } from "./keyboardNavHandlers";

import type { ActiveColorPickerSectionAtomType } from "./colorPickerUtils";

const palette = COLOR_PALETTE as unknown as ColorPaletteCustom;

const keyEvent = (
  key: string,
  extra: Partial<{
    code: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  }> = {},
) =>
  ({
    key,
    code: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...extra,
  } as unknown as React.KeyboardEvent);

const setup = (
  event: React.KeyboardEvent,
  overrides: Partial<{
    activeColorPickerSection: ActiveColorPickerSectionAtomType;
    color: string | null;
    customColors: string[];
    activeShade: number;
    excludedColors: readonly string[];
    palette: ColorPaletteCustom;
  }> = {},
) => {
  const onChange = vi.fn();
  const setActiveColorPickerSection = vi.fn();
  const onEyeDropperToggle = vi.fn();
  const onEscape = vi.fn();

  const handled = colorPickerKeyNavHandler({
    event,
    activeColorPickerSection: null,
    palette,
    color: null,
    onChange,
    customColors: [],
    setActiveColorPickerSection,
    updateData: () => {},
    activeShade: 2,
    onEyeDropperToggle,
    onEscape,
    ...overrides,
  });

  return {
    handled,
    onChange,
    setActiveColorPickerSection,
    onEyeDropperToggle,
    onEscape,
  };
};

describe("colorPickerKeyNavHandler", () => {
  it("ignores events with the ctrl/cmd modifier", () => {
    const { handled, onChange } = setup(keyEvent("q", { ctrlKey: true }));
    expect(handled).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onEscape on Escape", () => {
    const event = keyEvent("Escape");
    const { handled, onEscape } = setup(event);
    expect(handled).toBe(true);
    expect(onEscape).toHaveBeenCalledWith(event);
  });

  it("forces the eye dropper on with Alt and toggles it with i", () => {
    const alt = setup(keyEvent("Alt"));
    expect(alt.handled).toBe(true);
    expect(alt.onEyeDropperToggle).toHaveBeenCalledWith(true);

    const i = setup(keyEvent("i"));
    expect(i.handled).toBe(true);
    expect(i.onEyeDropperToggle).toHaveBeenCalledWith();
  });

  it("returns false for keys it does not handle", () => {
    const { handled, onChange } = setup(keyEvent("ArrowLeft"), {
      activeColorPickerSection: "hex",
      color: "#123456",
    });
    expect(handled).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  describe("Tab", () => {
    it("cycles to the next available section and stops the event", () => {
      const event = keyEvent("Tab");
      const { handled, setActiveColorPickerSection } = setup(event, {
        activeColorPickerSection: "baseColors",
        color: COLOR_PALETTE.red[2],
      });

      expect(handled).toBe(true);
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("shades");
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("skips the shades section when the color has no shade", () => {
      const { setActiveColorPickerSection } = setup(keyEvent("Tab"), {
        activeColorPickerSection: "baseColors",
        color: COLOR_PALETTE.black,
      });
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("hex");
    });

    it("wraps from the last section to custom colors and picks the first", () => {
      const { setActiveColorPickerSection, onChange } = setup(keyEvent("Tab"), {
        activeColorPickerSection: "hex",
        color: COLOR_PALETTE.black,
        customColors: ["#abcdef", "#123456"],
      });
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("custom");
      expect(onChange).toHaveBeenCalledWith("#abcdef");
    });

    it("moves backwards with Shift and wraps to the last section", () => {
      const { setActiveColorPickerSection } = setup(
        keyEvent("Tab", { shiftKey: true }),
        {
          activeColorPickerSection: "baseColors",
          color: COLOR_PALETTE.black,
        },
      );
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("hex");
    });

    it("resets a non-palette color to black when entering base colors", () => {
      const { setActiveColorPickerSection, onChange } = setup(
        keyEvent("Tab", { shiftKey: true }),
        {
          activeColorPickerSection: "hex",
          color: "#123456",
        },
      );
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("baseColors");
      expect(onChange).toHaveBeenCalledWith(COLOR_PALETTE.black);
    });

    it("keeps a palette color when entering base colors", () => {
      const { setActiveColorPickerSection, onChange } = setup(
        keyEvent("Tab", { shiftKey: true }),
        {
          activeColorPickerSection: "shades",
          color: COLOR_PALETTE.blue[1],
        },
      );
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("baseColors");
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("hotkeys", () => {
    it("Shift+Digit picks a shade of the current color", () => {
      const { handled, onChange, setActiveColorPickerSection } = setup(
        keyEvent("!", { code: "Digit1", shiftKey: true }),
        { color: COLOR_PALETTE.red[3] },
      );
      expect(handled).toBe(true);
      expect(onChange).toHaveBeenCalledWith(COLOR_PALETTE.red[0]);
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("shades");
    });

    it("digits pick custom colors by position", () => {
      const { handled, onChange, setActiveColorPickerSection } = setup(
        keyEvent("2"),
        { customColors: ["#111111", "#222222"] },
      );
      expect(handled).toBe(true);
      expect(onChange).toHaveBeenCalledWith("#222222");
      expect(setActiveColorPickerSection).toHaveBeenCalledWith("custom");
    });

    it("a digit without a matching custom color is not handled", () => {
      const { handled, onChange } = setup(keyEvent("3"), {
        customColors: ["#111111"],
      });
      expect(handled).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("letter hotkeys pick base colors using the active shade", () => {
      // "r" is the 4th binding -> gray
      const shaded = setup(keyEvent("r"), { activeShade: 3 });
      expect(shaded.handled).toBe(true);
      expect(shaded.onChange).toHaveBeenCalledWith(COLOR_PALETTE.gray[3]);
      expect(shaded.setActiveColorPickerSection).toHaveBeenCalledWith(
        "baseColors",
      );

      // "w" is the 2nd binding -> black (no shades)
      const plain = setup(keyEvent("w"));
      expect(plain.onChange).toHaveBeenCalledWith(COLOR_PALETTE.black);
    });
  });

  describe("arrow navigation", () => {
    it("moves between shades and wraps around", () => {
      const right = setup(keyEvent("ArrowRight"), {
        activeColorPickerSection: "shades",
        color: COLOR_PALETTE.blue[4],
      });
      expect(right.handled).toBe(true);
      expect(right.onChange).toHaveBeenCalledWith(COLOR_PALETTE.blue[0]);

      const left = setup(keyEvent("ArrowLeft"), {
        activeColorPickerSection: "shades",
        color: COLOR_PALETTE.blue[0],
      });
      expect(left.onChange).toHaveBeenCalledWith(COLOR_PALETTE.blue[4]);
    });

    it("vertical arrows in a single shade row stay on the same shade", () => {
      const down = setup(keyEvent("ArrowDown"), {
        activeColorPickerSection: "shades",
        color: COLOR_PALETTE.blue[2],
      });
      expect(down.onChange).toHaveBeenCalledWith(COLOR_PALETTE.blue[2]);

      const up = setup(keyEvent("ArrowUp"), {
        activeColorPickerSection: "shades",
        color: COLOR_PALETTE.blue[2],
      });
      expect(up.onChange).toHaveBeenCalledWith(COLOR_PALETTE.blue[2]);
    });

    it("moves through base colors by row and column", () => {
      // palette order: transparent, black, white, gray, red | pink, ...
      const right = setup(keyEvent("ArrowRight"), {
        activeColorPickerSection: "baseColors",
        color: COLOR_PALETTE.black,
      });
      expect(right.onChange).toHaveBeenCalledWith(COLOR_PALETTE.white);

      const down = setup(keyEvent("ArrowDown"), {
        activeColorPickerSection: "baseColors",
        color: COLOR_PALETTE.black,
      });
      // index 1 + 5 -> grape, at the active shade
      expect(down.onChange).toHaveBeenCalledWith(COLOR_PALETTE.grape[2]);

      const up = setup(keyEvent("ArrowUp"), {
        activeColorPickerSection: "baseColors",
        color: COLOR_PALETTE.black,
      });
      // 15 colors / 5 per row -> wraps to index 11 (green)
      expect(up.onChange).toHaveBeenCalledWith(COLOR_PALETTE.green[2]);
    });

    it("wraps down from the last row to the first", () => {
      const { onChange } = setup(keyEvent("ArrowDown"), {
        activeColorPickerSection: "baseColors",
        color: COLOR_PALETTE.bronze[2],
      });
      // bronze is index 14 -> column 4 -> red
      expect(onChange).toHaveBeenCalledWith(COLOR_PALETTE.red[2]);
    });

    it("ArrowUp into a missing cell of a partial last row is not handled", () => {
      const shortPalette = {
        a: "#000001",
        b: "#000002",
        c: "#000003",
        d: "#000004",
        e: "#000005",
        f: "#000006",
      } as unknown as ColorPaletteCustom;

      const { handled, onChange } = setup(keyEvent("ArrowUp"), {
        activeColorPickerSection: "baseColors",
        palette: shortPalette,
        color: "#000002",
      });
      expect(handled).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("steps over excluded base colors in the arrow's direction", () => {
      const { onChange } = setup(keyEvent("ArrowRight"), {
        activeColorPickerSection: "baseColors",
        color: COLOR_PALETTE.black,
        excludedColors: [COLOR_PALETTE.white, COLOR_PALETTE.gray[2]],
      });
      expect(onChange).toHaveBeenCalledWith(COLOR_PALETTE.red[2]);
    });

    it("moves through custom colors and wraps around", () => {
      const customColors = ["#111111", "#222222", "#333333"];

      const right = setup(keyEvent("ArrowRight"), {
        activeColorPickerSection: "custom",
        color: "#333333",
        customColors,
      });
      expect(right.handled).toBe(true);
      expect(right.onChange).toHaveBeenCalledWith("#111111");

      const left = setup(keyEvent("ArrowLeft"), {
        activeColorPickerSection: "custom",
        color: null,
        customColors,
      });
      // a null color starts from the first custom color
      expect(left.onChange).toHaveBeenCalledWith("#333333");
    });
  });
});
