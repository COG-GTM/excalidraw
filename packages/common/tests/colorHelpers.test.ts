import {
  COLOR_PALETTE,
  colorToHex,
  getAllColorsSpecificShade,
  isColorDark,
  isOpaqueColor,
  isTransparent,
  normalizeInputColor,
} from "@excalidraw/common";

describe("colorToHex", () => {
  it("converts valid colors to hex", () => {
    expect(colorToHex("red")).toBe("#ff0000");
    expect(colorToHex("rgb(0, 128, 255)")).toBe("#0080ff");
    expect(colorToHex("rgba(0, 0, 0, 0.5)")).toBe("#00000080");
  });

  it("returns null for invalid colors", () => {
    expect(colorToHex("not-a-color")).toBeNull();
  });
});

describe("isTransparent / isOpaqueColor", () => {
  it.each([
    ["transparent", true, false],
    ["#00000000", true, false],
    ["#ff000080", false, false],
    ["rgba(0, 0, 0, 0.5)", false, false],
    ["#ff0000", false, true],
    ["black", false, true],
  ])("%s", (color, transparent, opaque) => {
    expect(isTransparent(color)).toBe(transparent);
    expect(isOpaqueColor(color)).toBe(opaque);
  });
});

describe("isColorDark", () => {
  it("treats empty and invalid colors as dark", () => {
    expect(isColorDark("")).toBe(true);
    expect(isColorDark("not-a-color")).toBe(true);
  });

  it("treats transparent as not dark", () => {
    expect(isColorDark("transparent")).toBe(false);
  });

  it("uses the YIQ contrast threshold", () => {
    expect(isColorDark("#000000")).toBe(true);
    expect(isColorDark("#ffffff")).toBe(false);
    expect(isColorDark("#1e1e1e")).toBe(true);
    // yiq of #808080 = 128
    expect(isColorDark("#808080")).toBe(true);
    expect(isColorDark("#808080", 100)).toBe(false);
  });
});

describe("normalizeInputColor", () => {
  it("trims and keeps valid colors", () => {
    expect(normalizeInputColor("  red ")).toBe("red");
    expect(normalizeInputColor("#abcdef")).toBe("#abcdef");
    expect(normalizeInputColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });

  it("prefixes bare hex colors with #", () => {
    expect(normalizeInputColor("abcdef")).toBe("#abcdef");
    expect(normalizeInputColor("abcdef80")).toBe("#abcdef80");
  });

  it("keeps transparent values", () => {
    expect(normalizeInputColor("transparent")).toBe("transparent");
  });

  it("returns null for invalid colors", () => {
    expect(normalizeInputColor("nope")).toBeNull();
  });
});

describe("getAllColorsSpecificShade", () => {
  it("returns one color per hue for the given shade, without grays", () => {
    const shades = getAllColorsSpecificShade(2);

    expect(shades).toHaveLength(10);
    expect(shades[0]).toBe(COLOR_PALETTE.cyan[2]);
    expect(shades[9]).toBe(COLOR_PALETTE.red[2]);
    expect(shades).not.toContain(COLOR_PALETTE.gray[2]);
  });
});
