import {
  FONT_FAMILY,
  FONT_METADATA,
  FREEDRAW_STROKE_WIDTH,
  KEYS,
  STROKE_WIDTH,
  getExportSource,
  getFontFamilyFallbacks,
  getGenericFontFamilyFallback,
  getLineHeight,
  getStrokeWidthByKey,
  getVerticalOffset,
  isArrowKey,
  isBounds,
  isLatinChar,
  randomId,
  randomInteger,
  reseed,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  shouldRotateWithDiscreteAngle,
} from "@excalidraw/common";

describe("isBounds", () => {
  it("accepts 4-tuples of numbers", () => {
    expect(isBounds([0, 1, 2, 3])).toBe(true);
  });

  it.each([
    [null],
    [{}],
    [[0, 1, 2]],
    [[0, 1, 2, 3, 4]],
    [["0", 1, 2, 3]],
    [[0, "1", 2, 3]],
    [[0, 1, "2", 3]],
    [[0, 1, 2, "3"]],
  ])("rejects %j", (value) => {
    expect(isBounds(value)).toBe(false);
  });
});

describe("constants helpers", () => {
  it("getStrokeWidthByKey uses freedraw widths for freedraw", () => {
    expect(getStrokeWidthByKey("freedraw", "bold")).toBe(
      FREEDRAW_STROKE_WIDTH.bold,
    );
    expect(getStrokeWidthByKey("rectangle", "bold")).toBe(STROKE_WIDTH.bold);
    expect(getStrokeWidthByKey("freedraw", "thin")).not.toBe(
      getStrokeWidthByKey("arrow", "thin"),
    );
  });

  it("getGenericFontFamilyFallback returns monospace for code fonts", () => {
    expect(getGenericFontFamilyFallback(FONT_FAMILY.Cascadia)).toBe(
      "monospace",
    );
    expect(getGenericFontFamilyFallback(FONT_FAMILY["Comic Shanns"])).toBe(
      "monospace",
    );
    expect(getGenericFontFamilyFallback(FONT_FAMILY.Nunito)).toBe("sans-serif");
  });

  it("getFontFamilyFallbacks adds the CJK fallback for Excalifont", () => {
    expect(getFontFamilyFallbacks(FONT_FAMILY.Excalifont)).toEqual([
      "Xiaolai",
      "sans-serif",
      "Segoe UI Emoji",
    ]);
    expect(getFontFamilyFallbacks(FONT_FAMILY.Cascadia)).toEqual([
      "monospace",
      "Segoe UI Emoji",
    ]);
  });

  it("getExportSource prefers window.EXCALIDRAW_EXPORT_SOURCE", () => {
    expect(getExportSource()).toBe(window.location.origin);

    window.EXCALIDRAW_EXPORT_SOURCE = "https://custom.source";
    try {
      expect(getExportSource()).toBe("https://custom.source");
    } finally {
      delete (window as any).EXCALIDRAW_EXPORT_SOURCE;
    }
  });
});

describe("font metadata helpers", () => {
  it("getVerticalOffset computes the alphabetic baseline offset", () => {
    // Excalifont: unitsPerEm 1000, ascender 886, descender -374
    expect(getVerticalOffset(FONT_FAMILY.Excalifont, 20, 25)).toBeCloseTo(
      17.62,
    );
  });

  it("getVerticalOffset falls back to Excalifont metrics", () => {
    expect(getVerticalOffset(4242 as any, 20, 25)).toBeCloseTo(
      getVerticalOffset(FONT_FAMILY.Excalifont, 20, 25),
    );
  });

  it("getLineHeight returns the family line height with fallback", () => {
    expect(getLineHeight(FONT_FAMILY.Excalifont)).toBe(
      FONT_METADATA[FONT_FAMILY.Excalifont].metrics.lineHeight,
    );
    expect(getLineHeight(FONT_FAMILY.Cascadia)).toBe(
      FONT_METADATA[FONT_FAMILY.Cascadia].metrics.lineHeight,
    );
    expect(getLineHeight(4242 as any)).toBe(
      FONT_METADATA[FONT_FAMILY.Excalifont].metrics.lineHeight,
    );
  });
});

describe("key helpers", () => {
  it("isLatinChar", () => {
    expect(isLatinChar("a")).toBe(true);
    expect(isLatinChar("Z")).toBe(true);
    expect(isLatinChar("ж")).toBe(false);
    expect(isLatinChar("ab")).toBe(false);
  });

  it("isArrowKey", () => {
    expect(isArrowKey(KEYS.ARROW_LEFT)).toBe(true);
    expect(isArrowKey(KEYS.ARROW_RIGHT)).toBe(true);
    expect(isArrowKey(KEYS.ARROW_UP)).toBe(true);
    expect(isArrowKey(KEYS.ARROW_DOWN)).toBe(true);
    expect(isArrowKey(KEYS.ENTER)).toBe(false);
  });

  it("modifier-based helpers", () => {
    const alt = new KeyboardEvent("keydown", { altKey: true });
    const shift = new KeyboardEvent("keydown", { shiftKey: true });

    expect(shouldResizeFromCenter(alt)).toBe(true);
    expect(shouldResizeFromCenter(shift)).toBe(false);
    expect(shouldMaintainAspectRatio(shift)).toBe(true);
    expect(shouldMaintainAspectRatio(alt)).toBe(false);
    expect(shouldRotateWithDiscreteAngle(shift)).toBe(true);
    expect(shouldRotateWithDiscreteAngle(alt)).toBe(false);
  });
});

describe("random", () => {
  it("randomInteger is deterministic after reseed", () => {
    reseed(42);
    const first = [randomInteger(), randomInteger(), randomInteger()];
    reseed(42);
    const second = [randomInteger(), randomInteger(), randomInteger()];

    expect(second).toEqual(first);
    for (const value of first) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 31);
    }
  });

  it("randomId returns sequential ids in test env, reset by reseed", () => {
    reseed(1);
    expect(randomId()).toBe("id0");
    expect(randomId()).toBe("id1");
    reseed(1);
    expect(randomId()).toBe("id0");
  });
});
