import React from "react";
import { vi } from "vitest";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_SIDEBAR,
  FRAME_STYLE,
  KEYS,
} from "@excalidraw/common";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import {
  escapeSpecialCharacters,
  getMatchedLines,
  getMatchInFrame,
  getMatchPreview,
  normalizeWrappedText,
} from "../components/SearchMenu";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, waitFor } from "./test-utils";

import type { SearchQuery } from "../components/SearchMenu";

const { h } = window;

const querySearchInput = async () => {
  const input =
    h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
      `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
    )!;
  await waitFor(() => expect(input).not.toBeNull());
  return input;
};

const openSearch = async () => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.F);
  });
  return querySearchInput();
};

const getSearchCountText = () =>
  h.app.excalidrawContainerValue.container
    ?.querySelector(".layer-ui__search-count")
    ?.textContent?.trim() ?? "";

const getResultItems = () =>
  Array.from(
    h.app.excalidrawContainerValue.container?.querySelectorAll<HTMLElement>(
      ".layer-ui__result-item",
    ) ?? [],
  );

const q = (query: string) => query as SearchQuery;

describe("search", () => {
  let originalScrollIntoView: HTMLElement["scrollIntoView"];

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({
      openSidebar: null,
    });
    // result rows call scrollIntoView, which jsdom doesn't implement
    const { prototype } = h.app.ownerWindow.HTMLElement;
    originalScrollIntoView = prototype.scrollIntoView;
    prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    h.app.ownerWindow.HTMLElement.prototype.scrollIntoView =
      originalScrollIntoView;
  });

  it("should toggle search on cmd+f", async () => {
    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();
    expect(searchInput.matches(":focus")).toBe(true);
  });

  it("should refocus search input with cmd+f when search sidebar is still open", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      );

    act(() => {
      searchInput?.blur();
    });

    expect(h.app.state.openSidebar).not.toBeNull();
    expect(searchInput?.matches(":focus")).toBe(false);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(searchInput?.matches(":focus")).toBe(true);
  });

  it("should match text and cycle through matches on Enter", async () => {
    const scrollIntoViewMock = jest.fn();
    h.app.ownerWindow.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({ type: "text", text: "test one" }),
      API.createElement({ type: "text", text: "test two" }),
    ]);

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "test");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(2);
      expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
    });

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(false);
    expect(h.app.state.searchMatches?.matches[1].focus).toBe(true);

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
    expect(h.app.state.searchMatches?.matches[1].focus).toBe(false);
  });

  it("should match text split across multiple lines", async () => {
    const scrollIntoViewMock = jest.fn();
    h.app.ownerWindow.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({
        type: "text",
        text: "",
      }),
    ]);

    API.updateElement(h.elements[0] as ExcalidrawTextElement, {
      text: "t\ne\ns\nt \nt\ne\nx\nt \ns\np\nli\nt \ni\nn\nt\no\nm\nu\nlt\ni\np\nl\ne \nli\nn\ne\ns",
      originalText: "test text split into multiple lines",
    });

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "test");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
      expect(h.app.state.searchMatches?.matches[0]?.matchedLines?.length).toBe(
        4,
      );
    });

    updateTextEditor(searchInput, "ext spli");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
      expect(h.app.state.searchMatches?.matches[0]?.matchedLines?.length).toBe(
        6,
      );
    });
  });

  it("should match frame names", async () => {
    const scrollIntoViewMock = jest.fn();
    h.app.ownerWindow.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({
        type: "frame",
      }),
    ]);

    API.updateElement(h.elements[0] as ExcalidrawFrameLikeElement, {
      name: "Frame: name test for frame, yes, frame!",
    });

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "frame");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(3);
    });
  });

  it("should treat regex metacharacters in the query literally", async () => {
    const target = API.createElement({ type: "text", text: "call a(b) now" });
    API.setElements([
      target,
      API.createElement({ type: "text", text: "no special chars ab" }),
      API.createElement({ type: "text", text: "dots... [x] 1+1 c:\\dir" }),
    ]);

    const searchInput = await openSearch();

    updateTextEditor(searchInput, "a(b");
    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.map((m) => m.id)).toEqual([
        target.id,
      ]);
    });

    updateTextEditor(searchInput, "[x] 1+1");
    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
    });

    updateTextEditor(searchInput, "\\");
    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
    });

    // "." must not act as a wildcard: only the three literal dots match
    updateTextEditor(searchInput, ".");
    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(3);
    });
  });

  it("should match case-insensitively and every occurrence in an element", async () => {
    const text = API.createElement({ type: "text", text: "Foo foo FOO" });
    API.setElements([text]);

    const searchInput = await openSearch();
    updateTextEditor(searchInput, "fOo");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.map((m) => m.id)).toEqual([
        text.id,
        text.id,
        text.id,
      ]);
    });

    // each occurrence gets its own highlight rectangle, offset by its index
    const offsets = h.app.state.searchMatches!.matches.map(
      (m) => m.matchedLines[0].offsetX,
    );
    expect(offsets).toEqual([0, 40, 80]);
    expect(getSearchCountText()).toContain("3 results");
  });

  it("should list frame matches first, each group sorted by y", async () => {
    const textLow = API.createElement({ type: "text", text: "alpha", y: 300 });
    const textHigh = API.createElement({
      type: "text",
      text: "alpha",
      y: -100,
    });
    const frameLow = API.createElement({ type: "frame", y: 500 });
    const frameHigh = API.createElement({ type: "frame", y: 0 });
    const unrelated = API.createElement({ type: "text", text: "beta" });

    API.setElements([textLow, frameLow, unrelated, textHigh, frameHigh]);
    API.updateElement(h.elements[1] as ExcalidrawFrameLikeElement, {
      name: "alpha low",
    });
    API.updateElement(h.elements[4] as ExcalidrawFrameLikeElement, {
      name: "alpha high",
    });

    const searchInput = await openSearch();
    updateTextEditor(searchInput, "alpha");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.map((m) => m.id)).toEqual([
        frameHigh.id,
        frameLow.id,
        textHigh.id,
        textLow.id,
      ]);
    });

    expect(getSearchCountText()).toContain("4 results");
    expect(
      getResultItems().map((item) => item.textContent?.replace(/\s+/g, " ")),
    ).toEqual(["alpha high", "alpha low", "alpha", "alpha"]);
  });

  it("should show singular count and a no-match message", async () => {
    API.setElements([API.createElement({ type: "text", text: "unique" })]);

    const searchInput = await openSearch();

    updateTextEditor(searchInput, "uniq");
    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
    });
    expect(getSearchCountText()).toContain("1 result");
    expect(getSearchCountText()).not.toContain("results");

    updateTextEditor(searchInput, "missing");
    await waitFor(() => {
      expect(h.app.state.searchMatches).toBeNull();
      expect(getSearchCountText()).toBe("No matches found...");
    });
    expect(getResultItems()).toHaveLength(0);

    updateTextEditor(searchInput, "   ");
    await waitFor(() => {
      expect(getSearchCountText()).toBe("");
    });
    expect(h.app.state.searchMatches).toBeNull();
  });

  it("should cycle focus with ArrowDown/ArrowUp and wrap around", async () => {
    const first = API.createElement({ type: "text", text: "item", y: 0 });
    const second = API.createElement({ type: "text", text: "item", y: 50 });
    const third = API.createElement({ type: "text", text: "item", y: 100 });
    API.setElements([third, first, second]);

    const searchInput = await openSearch();
    updateTextEditor(searchInput, "item");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.focusedId).toBe(first.id);
    });
    expect(getSearchCountText()).toContain("1 / 3 results");

    Keyboard.keyPress(KEYS.ARROW_UP, searchInput);
    expect(h.app.state.searchMatches?.focusedId).toBe(third.id);
    expect(
      h.app.state.searchMatches?.matches.map((match) => match.focus),
    ).toEqual([false, false, true]);
    expect(getSearchCountText()).toContain("3 / 3 results");

    Keyboard.keyPress(KEYS.ARROW_UP, searchInput);
    expect(h.app.state.searchMatches?.focusedId).toBe(second.id);

    Keyboard.keyPress(KEYS.ARROW_DOWN, searchInput);
    expect(h.app.state.searchMatches?.focusedId).toBe(third.id);

    Keyboard.keyPress(KEYS.ARROW_DOWN, searchInput);
    expect(h.app.state.searchMatches?.focusedId).toBe(first.id);

    // the highlighted list row follows the focused match
    const items = getResultItems();
    expect(items[0].classList.contains("active")).toBe(true);
    expect(items[1].classList.contains("active")).toBe(false);
  });

  it("should focus a match when its result row is clicked", async () => {
    const frame = API.createElement({ type: "frame", y: 0 });
    const text = API.createElement({ type: "text", text: "zeta", y: 0 });
    API.setElements([text, frame]);
    API.updateElement(h.elements[1] as ExcalidrawFrameLikeElement, {
      name: "zeta frame",
    });

    const searchInput = await openSearch();
    updateTextEditor(searchInput, "zeta");

    await waitFor(() => {
      expect(getResultItems()).toHaveLength(2);
    });

    // text rows are offset by the number of frame rows above them
    fireEvent.click(getResultItems()[1]);
    expect(h.app.state.searchMatches?.focusedId).toBe(text.id);
    expect(getResultItems()[1].classList.contains("active")).toBe(true);

    fireEvent.click(getResultItems()[0]);
    expect(h.app.state.searchMatches?.focusedId).toBe(frame.id);
    expect(getResultItems()[0].classList.contains("active")).toBe(true);
  });

  it("should close the sidebar on Escape unless a dialog is open", async () => {
    await openSearch();
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    API.setAppState({ openDialog: { name: "help" } });
    Keyboard.keyPress(KEYS.ESCAPE);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    API.setAppState({ openDialog: null });
    Keyboard.keyPress(KEYS.ESCAPE);
    expect(h.app.state.openSidebar).toBeNull();
    expect(h.app.state.searchMatches).toBeNull();
  });

  it("should re-run the search when the scene changes", async () => {
    const original = API.createElement({ type: "text", text: "gamma" });
    API.setElements([original]);

    const searchInput = await openSearch();
    updateTextEditor(searchInput, "gamma");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
    });

    const added = API.createElement({
      type: "text",
      text: "more gamma",
      y: 200,
    });
    API.setElements([original, added]);

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.map((m) => m.id)).toEqual([
        original.id,
        added.id,
      ]);
    });

    API.setElements([added]);

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.map((m) => m.id)).toEqual([
        added.id,
      ]);
    });
  });

  it("should scroll the viewport to an off-screen focused match", async () => {
    const near = API.createElement({
      type: "text",
      text: "delta",
      x: 100,
      y: 100,
      fontSize: 20,
    });
    const far = API.createElement({
      type: "text",
      text: "delta",
      x: 50000,
      y: 50000,
      fontSize: 20,
    });
    const tiny = API.createElement({
      type: "text",
      text: "delta",
      x: 100,
      y: 200,
      fontSize: 8,
    });
    API.setElements([near, tiny, far]);

    // jsdom has no layout, so give the canvas a real viewport size
    API.setAppState({ width: 1000, height: 800 });
    h.app.canvas.width = 1000 * h.app.ownerWindow.devicePixelRatio;
    h.app.canvas.height = 800 * h.app.ownerWindow.devicePixelRatio;

    const searchInput = await openSearch();
    const setViewportSpy = vi
      .spyOn(h.app.viewport, "setViewport")
      .mockImplementation(() => {});

    updateTextEditor(searchInput, "delta");
    await waitFor(() => {
      expect(h.app.state.searchMatches?.focusedId).toBe(near.id);
    });
    // visible, legible match: viewport is left untouched
    expect(setViewportSpy).not.toHaveBeenCalled();

    // tiny text is zoomed until legible
    Keyboard.keyPress(KEYS.ARROW_DOWN, searchInput);
    expect(h.app.state.searchMatches?.focusedId).toBe(tiny.id);
    await waitFor(() => {
      expect(setViewportSpy).toHaveBeenCalledTimes(1);
    });
    expect(setViewportSpy.mock.lastCall?.[0]).toMatchObject({
      fit: "contain",
    });

    // off-screen legible text is scrolled into view without zooming in
    Keyboard.keyPress(KEYS.ARROW_DOWN, searchInput);
    expect(h.app.state.searchMatches?.focusedId).toBe(far.id);
    await waitFor(() => {
      expect(setViewportSpy).toHaveBeenCalledTimes(2);
    });
    expect(setViewportSpy.mock.lastCall?.[0]).toMatchObject({
      target: [50000, 50000, 50050, 50025],
      fit: "scale-down",
    });

    setViewportSpy.mockRestore();
  });
});

describe("search helpers", () => {
  describe("escapeSpecialCharacters", () => {
    it("escapes every regex metacharacter so the query matches literally", () => {
      const raw = ".*+?^${}()|[]\\-";
      const escaped = escapeSpecialCharacters(raw);
      expect(() => new RegExp(escaped)).not.toThrow();
      expect(new RegExp(escaped).test(`prefix ${raw} suffix`)).toBe(true);
      expect(new RegExp(escapeSpecialCharacters("a.c")).test("abc")).toBe(
        false,
      );
    });
  });

  describe("getMatchPreview", () => {
    const preview = (text: string, query: string) =>
      getMatchPreview(text, text.indexOf(query), q(query));

    it("keeps the query at indexInSearchQuery", () => {
      for (const [text, query] of [
        ["the quick brown fox jumps over the lazy dog", "fox"],
        ["small", "mall"],
        ["small", "smal"],
        ["one two three four five six seven eight nine ten eleven", "one"],
        ["start middle end", "end"],
      ]) {
        const result = preview(text, query);
        expect(
          result.previewText.slice(
            result.indexInSearchQuery,
            result.indexInSearchQuery + query.length,
          ),
        ).toBe(query);
      }
    });

    it("returns the whole text when it is short", () => {
      expect(preview("small", "mall")).toEqual({
        indexInSearchQuery: 1,
        previewText: "small",
        moreBefore: false,
        moreAfter: false,
      });
      expect(preview("small", "smal")).toEqual({
        indexInSearchQuery: 0,
        previewText: "small",
        moreBefore: false,
        moreAfter: false,
      });
    });

    it("trims words before/after a match in the middle of long text", () => {
      const result = preview(
        "one two three four five six seven eight nine ten",
        "five",
      );
      expect(result.moreBefore).toBe(true);
      expect(result.moreAfter).toBe(true);
      expect(result.previewText.replace(/\s+/g, " ")).toBe(
        "three four five six seven eight nine",
      );
    });

    it("flags only moreAfter for a match at the start of long text", () => {
      const result = preview(
        "one two three four five six seven eight nine ten eleven",
        "one",
      );
      expect(result.indexInSearchQuery).toBe(0);
      expect(result.moreBefore).toBe(false);
      expect(result.moreAfter).toBe(true);
      expect(result.previewText.replace(/\s+/g, " ")).toBe(
        "one two three four five",
      );
    });

    it("flags only moreBefore for a match at the end of long text", () => {
      const result = preview("one two three four five six", "six");
      expect(result.moreBefore).toBe(true);
      expect(result.moreAfter).toBe(false);
      expect(result.previewText.replace(/\s+/g, " ")).toBe("four five six");
    });

    it("caps the context before the match at 20 characters", () => {
      const result = preview(
        "averyveryveryverylongwordthatexceedslimit target",
        "target",
      );
      expect(result.indexInSearchQuery).toBe(20);
      expect(result.previewText.endsWith("target")).toBe(true);
      expect(result.previewText.length).toBe(20 + "target".length);
    });
  });

  describe("normalizeWrappedText", () => {
    it("restores whitespace dropped at soft-wrap boundaries", () => {
      expect(normalizeWrappedText("hello\nworld foo", "hello world foo")).toBe(
        "hello \nworld foo",
      );
    });

    it("leaves lines untouched when no whitespace was dropped", () => {
      expect(normalizeWrappedText("hello   \nworld", "hello   world")).toBe(
        "hello   \nworld",
      );
      expect(normalizeWrappedText("single line", "single line")).toBe(
        "single line",
      );
    });
  });

  describe("getMatchedLines", () => {
    // in the test env every character measures 10px wide
    const createText = (
      overrides: Partial<ExcalidrawTextElement> = {},
    ): ExcalidrawTextElement => ({
      ...(API.createElement({
        type: "text",
        text: "hello world",
        fontSize: 20,
        width: 200,
      }) as ExcalidrawTextElement),
      ...overrides,
    });

    it("computes offsets for a left-aligned single-line match", () => {
      const el = createText({ textAlign: "left" });
      expect(getMatchedLines(el, q("world"), 6)).toEqual([
        { offsetX: 60, offsetY: 0, width: 50, height: 25, showOnCanvas: true },
      ]);
      expect(getMatchedLines(el, q("hello"), 0)[0].offsetX).toBe(0);
    });

    it("adds the alignment gap for center and right aligned text", () => {
      // line "hello world" is 110px wide inside a 200px element
      expect(
        getMatchedLines(createText({ textAlign: "center" }), q("world"), 6)[0]
          .offsetX,
      ).toBe(60 + 45);
      expect(
        getMatchedLines(createText({ textAlign: "right" }), q("world"), 6)[0]
          .offsetX,
      ).toBe(60 + 90);
    });

    it("splits a match spanning a soft-wrap boundary across lines", () => {
      const el = createText({
        text: "hello\nworld",
        originalText: "hello world",
      });
      expect(getMatchedLines(el, q("lo wo"), 3)).toEqual([
        { offsetX: 30, offsetY: 0, width: 30, height: 25, showOnCanvas: true },
        { offsetX: 0, offsetY: 25, width: 20, height: 25, showOnCanvas: true },
      ]);
    });

    it("places a match on a later line at that line's vertical offset", () => {
      const el = createText({
        text: "first\nsecond\nthird",
        originalText: "first\nsecond\nthird",
      });
      expect(getMatchedLines(el, q("third"), 13)).toEqual([
        { offsetX: 0, offsetY: 50, width: 50, height: 25, showOnCanvas: true },
      ]);
    });
  });

  describe("getMatchInFrame", () => {
    const createFrame = (name: string | null, width = 100) =>
      ({
        ...API.createElement({ type: "frame", width }),
        name,
      } as ExcalidrawFrameLikeElement);

    // frame names render at FRAME_STYLE.nameFontSize (14px) * 1.25 line height
    const nameHeight = FRAME_STYLE.nameFontSize * 1.25;

    it("positions the match above the frame, offset by the preceding text", () => {
      expect(
        getMatchInFrame(createFrame("my frame"), q("frame"), 3, 1),
      ).toEqual([
        {
          offsetX: 30,
          offsetY: -nameHeight - FRAME_STYLE.strokeWidth,
          width: 50,
          height: nameHeight,
          showOnCanvas: true,
        },
      ]);
      expect(
        getMatchInFrame(createFrame("my frame"), q("my"), 0, 1)[0].offsetX,
      ).toBe(0);
    });

    it("hides the highlight when the name is truncated at the current zoom", () => {
      const frame = createFrame("my frame", 100);
      expect(getMatchInFrame(frame, q("frame"), 3, 1)[0].showOnCanvas).toBe(
        true,
      );
      // 80px of name doesn't fit in a 100px frame rendered at 50%
      expect(getMatchInFrame(frame, q("frame"), 3, 0.5)[0].showOnCanvas).toBe(
        false,
      );
    });

    it("falls back to the default frame name when unnamed", () => {
      const [match] = getMatchInFrame(createFrame(null), q("Frame"), 0, 1);
      expect(match.offsetX).toBe(0);
      expect(match.width).toBe(50);
    });
  });
});
