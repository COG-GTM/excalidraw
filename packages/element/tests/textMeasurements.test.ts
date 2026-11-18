import { BOUND_TEXT_PADDING } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  charWidth,
  detectLineHeight,
  getApproxMinLineHeight,
  getApproxMinLineWidth,
  getLineHeightInPx,
  getMaxCharWidth,
  getMinCharWidth,
  getMinTextElementWidth,
  getTextHeight,
  getTextWidth,
  isMeasureTextSupported,
  measureText,
  normalizeText,
} from "../src/textMeasurements";

import type { ExcalidrawTextElement, FontString } from "../src/types";

const lineHeight = 1.25 as ExcalidrawTextElement["lineHeight"];

describe("textMeasurements", () => {
  it("normalizeText converts EOLs and tabs", () => {
    expect(normalizeText("a\r\nb\tc")).toBe("a\nb        c");
  });

  it("measures text width and height (10px per char in test env)", () => {
    const font = "20px Virgil" as FontString;

    expect(getTextWidth("abc\nlonger", font)).toBe(60);
    expect(getTextHeight("a\nb\nc", 20, lineHeight)).toBe(75);
    expect(measureText("abc\n\nde", font, lineHeight)).toEqual({
      width: 30,
      height: 75,
    });
    expect(isMeasureTextSupported()).toBe(true);
  });

  it("line height helpers", () => {
    expect(getLineHeightInPx(20, lineHeight)).toBe(25);
    expect(getApproxMinLineHeight(20, lineHeight)).toBe(
      25 + BOUND_TEXT_PADDING * 2,
    );

    const text = API.createElement({
      type: "text",
      text: "one\ntwo",
      fontSize: 20,
    }) as ExcalidrawTextElement;
    expect(detectLineHeight({ ...text, height: 60 })).toBe(1.5);
  });

  it("min text element width", () => {
    expect(
      getMinTextElementWidth("20px Virgil" as FontString, lineHeight),
    ).toBe(10 + BOUND_TEXT_PADDING * 2);
  });

  it("char width cache and min/max lookups", () => {
    const font = "13px __charWidthTest__" as FontString;

    expect(getMinCharWidth(font)).toBe(0);
    expect(getMaxCharWidth(font)).toBe(0);

    const fallback = getApproxMinLineWidth(font, lineHeight);
    expect(fallback).toBeGreaterThan(BOUND_TEXT_PADDING * 2);

    expect(charWidth.calculate("a", font)).toBe(10);
    // cached path
    expect(charWidth.calculate("a", font)).toBe(10);
    expect(charWidth.getCache(font)["a".charCodeAt(0)]).toBe(10);

    expect(getMinCharWidth(font)).toBe(10);
    expect(getMaxCharWidth(font)).toBe(10);
    expect(getApproxMinLineWidth(font, lineHeight)).toBe(
      10 + BOUND_TEXT_PADDING * 2,
    );

    charWidth.clearCache(font);
    expect(charWidth.getCache(font)).toEqual([]);
  });
});
