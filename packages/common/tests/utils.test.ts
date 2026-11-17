import { vi } from "vitest";

import {
  DEFAULT_VERSION,
  FONT_FAMILY,
  WINDOWS_EMOJI_FALLBACK_FONT,
  addEventListener,
  arrayToList,
  arrayToMapWithIndex,
  arrayToObject,
  assertNever,
  bytesToHexString,
  chunk,
  composeEventHandlers,
  easeOut,
  findIndex,
  findLastIndex,
  focusNearestParent,
  getFontFamilyString,
  getSvgPathFromStroke,
  getVersion,
  isFullScreen,
  isInputLike,
  isMemberOf,
  isServerEnv,
  isWritableElement,
  isShallowEqual,
  muteFSAbortError,
  nFormatter,
  preventUnload,
  queryFocusableElements,
  removeSelection,
  safelyParseJSON,
  selectNode,
  sizeOf,
  toArray,
  toIterable,
  updateStable,
} from "@excalidraw/common";

describe("utils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("isInputLike()", () => {
    it("accepts any input, select, textarea, br and wysiwyg element", () => {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      expect(isInputLike(checkbox)).toBe(true);
      expect(isInputLike(document.createElement("select"))).toBe(true);
      expect(isInputLike(document.createElement("br"))).toBe(true);
      const wysiwyg = document.createElement("div");
      wysiwyg.dataset.type = "wysiwyg";
      expect(isInputLike(wysiwyg)).toBe(true);
      expect(isInputLike(document.createElement("span"))).toBe(false);
    });
  });

  describe("isWritableElement()", () => {
    it("accepts text-like inputs and rejects other input types", () => {
      for (const type of ["text", "number", "password", "search"]) {
        const input = document.createElement("input");
        input.type = type;
        expect(isWritableElement(input)).toBe(true);
      }
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      expect(isWritableElement(checkbox)).toBe(false);
      expect(isWritableElement(document.createElement("select"))).toBe(false);
    });

    it("accepts wysiwyg elements and elements inside a code editor", () => {
      const wysiwyg = document.createElement("div");
      wysiwyg.dataset.type = "wysiwyg";
      expect(isWritableElement(wysiwyg)).toBe(true);
      expect(isWritableElement(document.createElement("br"))).toBe(true);

      const editor = document.createElement("div");
      editor.className = "cm-editor";
      const line = document.createElement("span");
      editor.append(line);
      expect(isWritableElement(line)).toBe(true);
      expect(isWritableElement(document.createElement("span"))).toBe(false);
    });
  });

  describe("getFontFamilyString()", () => {
    it("returns the font name with its fallbacks for known families", () => {
      const result = getFontFamilyString({ fontFamily: FONT_FAMILY.Virgil });
      expect(result.startsWith("Virgil, ")).toBe(true);
    });

    it("falls back to the emoji font for unknown families", () => {
      expect(getFontFamilyString({ fontFamily: 9999 as any })).toBe(
        WINDOWS_EMOJI_FALLBACK_FONT,
      );
    });
  });

  describe("easeOut()", () => {
    it("maps 0 to 0, 1 to 1 and eases out in between", () => {
      expect(easeOut(0)).toBe(0);
      expect(easeOut(1)).toBe(1);
      expect(easeOut(0.5)).toBeCloseTo(0.9375);
    });
  });

  describe("chunk()", () => {
    it("splits arrays into chunks of the given size", () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it("returns an empty array for empty input or invalid size", () => {
      expect(chunk([], 2)).toEqual([]);
      expect(chunk([1, 2], 0)).toEqual([]);
    });
  });

  describe("selectNode() / removeSelection()", () => {
    it("selects the node contents and clears the selection", () => {
      const node = document.createElement("p");
      node.textContent = "hello";
      document.body.append(node);

      selectNode(node);
      expect(window.getSelection()!.toString()).toBe("hello");

      removeSelection();
      expect(window.getSelection()!.rangeCount).toBe(0);
    });
  });

  describe("isFullScreen()", () => {
    it("is true only when the document element is fullscreen", () => {
      const setFullscreenElement = (value: Element | null) =>
        Object.defineProperty(document, "fullscreenElement", {
          value,
          configurable: true,
        });

      setFullscreenElement(null);
      expect(isFullScreen()).toBe(false);
      setFullscreenElement(document.body);
      expect(isFullScreen()).toBe(false);
      setFullscreenElement(document.documentElement);
      expect(isFullScreen()).toBe(true);
      delete (document as any).fullscreenElement;
    });
  });

  describe("muteFSAbortError()", () => {
    it("swallows AbortError and rethrows anything else", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const abort = new Error("aborted");
      abort.name = "AbortError";
      expect(muteFSAbortError(abort)).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(abort);

      const other = new Error("boom");
      expect(() => muteFSAbortError(other)).toThrow(other);
    });
  });

  describe("findIndex() / findLastIndex()", () => {
    const items = [1, 2, 3, 2, 1];

    it("searches forward from fromIndex, supporting negative offsets", () => {
      expect(findIndex(items, (x) => x === 2)).toBe(1);
      expect(findIndex(items, (x) => x === 2, 2)).toBe(3);
      expect(findIndex(items, (x) => x === 2, -2)).toBe(3);
      expect(findIndex(items, (x) => x === 9)).toBe(-1);
    });

    it("searches backward from fromIndex, supporting negative offsets", () => {
      expect(findLastIndex(items, (x) => x === 2)).toBe(3);
      expect(findLastIndex(items, (x) => x === 2, 2)).toBe(1);
      expect(findLastIndex(items, (x) => x === 2, -3)).toBe(1);
      expect(findLastIndex(items, (x) => x === 9)).toBe(-1);
    });
  });

  describe("nFormatter()", () => {
    it("formats numbers with SI-like suffixes", () => {
      expect(nFormatter(512, 1)).toBe("512b");
      expect(nFormatter(1500, 1)).toBe("1.5k");
      expect(nFormatter(2000000, 2)).toBe("2M");
      expect(nFormatter(3.25e9, 2)).toBe("3.25G");
    });
  });

  describe("getVersion()", () => {
    it("reads the version meta tag, defaulting when absent", () => {
      expect(getVersion()).toBe(DEFAULT_VERSION);

      const meta = document.createElement("meta");
      meta.name = "version";
      meta.content = "1.2.3";
      document.head.append(meta);
      expect(getVersion()).toBe("1.2.3");
      meta.remove();
    });
  });

  describe("focusNearestParent()", () => {
    it("focuses the closest focusable ancestor", () => {
      const outer = document.createElement("div");
      outer.tabIndex = 0;
      const middle = document.createElement("div");
      const input = document.createElement("input");
      middle.append(input);
      outer.append(middle);
      document.body.append(outer);

      focusNearestParent(input);
      expect(document.activeElement).toBe(outer);
    });
  });

  describe("preventUnload()", () => {
    it("prevents default and sets an empty returnValue", () => {
      const event = {
        preventDefault: vi.fn(),
        returnValue: "x",
      } as unknown as BeforeUnloadEvent;
      preventUnload(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.returnValue).toBe("");
    });
  });

  describe("bytesToHexString()", () => {
    it("converts bytes to zero-padded hex", () => {
      expect(bytesToHexString(new Uint8Array([0, 15, 16, 255]))).toBe(
        "000f10ff",
      );
    });
  });

  describe("array helpers", () => {
    it("arrayToMapWithIndex() maps ids to [element, index]", () => {
      const a = { id: "a" };
      const b = { id: "b" };
      const map = arrayToMapWithIndex([a, b]);
      expect(map.get("a")).toEqual([a, 0]);
      expect(map.get("b")).toEqual([b, 1]);
    });

    it("arrayToObject() keys by index or groupBy result", () => {
      expect(arrayToObject(["x", "y"])).toEqual({ 0: "x", 1: "y" });
      expect(arrayToObject([{ k: "a" }, { k: "b" }], (v) => v.k)).toEqual({
        a: { k: "a" },
        b: { k: "b" },
      });
    });

    it("arrayToList() builds a circular doubly linked list", () => {
      const [first, second, third] = arrayToList([
        { v: 1 },
        { v: 2 },
        { v: 3 },
      ]);
      expect(first.next).toBe(second);
      expect(second.next).toBe(third);
      expect(third.next).toBe(first);
      expect(first.prev).toBe(third);
      expect(third.prev).toBe(second);
    });

    it("arrayToList() leaves a single node unlinked", () => {
      const [only] = arrayToList([{ v: 1 }]);
      expect(only.prev).toBeNull();
      expect(only.next).toBeNull();
    });

    it("toIterable() / toArray() accept arrays and maps", () => {
      const arr = [1, 2];
      expect(toIterable(arr)).toBe(arr);
      expect(toArray(arr)).toBe(arr);

      const map = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      expect([...toIterable(map)]).toEqual([1, 2]);
      expect(toArray(map)).toEqual([1, 2]);
    });
  });

  describe("isServerEnv()", () => {
    it("is true when process.env.NODE_ENV is set", () => {
      expect(isServerEnv()).toBe(!!process.env.NODE_ENV);
    });
  });

  describe("queryFocusableElements()", () => {
    it("returns enabled focusable elements only", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <button id="ok"></button>
        <button id="disabled" disabled></button>
        <input id="hidden" tabindex="-1" />
        <div id="div" tabindex="0"></div>
        <span tabindex="0"></span>
      `;
      expect(queryFocusableElements(container).map((el) => el.id)).toEqual([
        "ok",
        "div",
      ]);
      expect(queryFocusableElements(null)).toEqual([]);
    });
  });

  describe("isShallowEqual()", () => {
    it("compares top-level values, treating empty arrays as equal", () => {
      expect(isShallowEqual({ a: 1, b: [] }, { a: 1, b: [] })).toBe(true);
      expect(isShallowEqual({ a: 1, b: [1] }, { a: 1, b: [1] })).toBe(false);
      expect(isShallowEqual({ a: 1 } as any, { a: 1, b: 2 })).toBe(false);
    });

    it("compares only the listed keys when given an array", () => {
      const a = { x: 1, y: 2 };
      const b = { x: 1, y: 3 };
      expect(isShallowEqual(a, b, ["x", "y"] as const)).toBe(false);
      expect(isShallowEqual(a, { x: 1, y: 2 }, ["x", "y"] as const)).toBe(true);
    });

    it("uses per-key comparators when given an object", () => {
      const a = { x: { v: 1 }, y: 2 };
      const b = { x: { v: 1 }, y: 2 };
      expect(isShallowEqual(a, b)).toBe(false);
      expect(isShallowEqual(a, b, { x: (p, n) => p.v === n.v })).toBe(true);
    });

    it("logs a warning for mismatches in debug mode", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      isShallowEqual({ a: 1 } as any, { a: 1, b: 2 }, undefined, true);
      isShallowEqual({ x: 1 }, { x: 2 }, ["x"] as const, true);
      isShallowEqual({ x: 1 }, { x: 2 }, undefined, true);
      expect(warn).toHaveBeenCalledTimes(3);
    });
  });

  describe("composeEventHandlers()", () => {
    it("calls both handlers unless the event was default-prevented", () => {
      const original = vi.fn();
      const ours = vi.fn(() => "ours");
      const handler = composeEventHandlers(original, ours);

      expect(handler({ defaultPrevented: false })).toBe("ours");
      expect(original).toHaveBeenCalledTimes(1);
      expect(ours).toHaveBeenCalledTimes(1);

      handler({ defaultPrevented: true });
      expect(original).toHaveBeenCalledTimes(2);
      expect(ours).toHaveBeenCalledTimes(1);
    });

    it("ignores defaultPrevented when checkForDefaultPrevented is false", () => {
      const ours = vi.fn();
      const handler = composeEventHandlers(undefined, ours, {
        checkForDefaultPrevented: false,
      });
      handler({ defaultPrevented: true });
      expect(ours).toHaveBeenCalledTimes(1);
    });
  });

  describe("assertNever()", () => {
    it("returns the value when message is null", () => {
      expect(assertNever("x" as never, null)).toBe("x");
    });

    it("logs instead of throwing when softAssert is set", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(assertNever("x" as never, "bad", true)).toBe("x");
      expect(error).toHaveBeenCalledWith("bad");
    });

    it("throws with the message otherwise", () => {
      expect(() => assertNever("x" as never, "bad")).toThrow("bad");
    });
  });

  describe("isMemberOf()", () => {
    it("works with sets, maps, arrays and objects", () => {
      expect(isMemberOf(new Set(["a"]), "a")).toBe(true);
      expect(isMemberOf(new Map([["a", 1]]), "b")).toBe(false);
      expect(isMemberOf(["a", "b"], "b")).toBe(true);
      expect(isMemberOf({ a: 1 }, "a")).toBe(true);
      expect(isMemberOf({ a: 1 }, "toString")).toBe(false);
    });
  });

  describe("updateStable()", () => {
    it("returns the previous reference when shallow equal", () => {
      const prev = { a: 1 };
      expect(updateStable(prev, { a: 1 })).toBe(prev);
      const next = { a: 2 };
      expect(updateStable(prev, next)).toBe(next);
    });
  });

  describe("addEventListener()", () => {
    it("returns a no-op unsubscribe for a missing target", () => {
      const unsubscribe = addEventListener(null, "click", () => {});
      expect(() => unsubscribe()).not.toThrow();
    });

    it("attaches and detaches the listener", () => {
      const target = document.createElement("div");
      const listener = vi.fn();
      const unsubscribe = addEventListener(target, "click", listener);
      target.dispatchEvent(new Event("click"));
      unsubscribe();
      target.dispatchEvent(new Event("click"));
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("getSvgPathFromStroke()", () => {
    it("returns an empty path for fewer than 4 points", () => {
      expect(
        getSvgPathFromStroke([
          [0, 0],
          [1, 1],
          [2, 2],
        ]),
      ).toBe("");
    });

    it("closes the path only when closed is true", () => {
      const points = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      const closed = getSvgPathFromStroke(points);
      const open = getSvgPathFromStroke(points, false);
      expect(closed.startsWith("M0.00,0.00")).toBe(true);
      expect(closed.endsWith("Z")).toBe(true);
      expect(open.endsWith("Z")).toBe(false);
    });
  });

  describe("safelyParseJSON()", () => {
    it("parses valid JSON and returns null on invalid input", () => {
      expect(safelyParseJSON('{"a":1}')).toEqual({ a: 1 });
      expect(safelyParseJSON("{not json")).toBeNull();
    });
  });

  describe("sizeOf()", () => {
    it("measures arrays, maps, sets and objects", () => {
      expect(sizeOf([1, 2])).toBe(2);
      expect(sizeOf(new Map([["a", 1]]))).toBe(1);
      expect(sizeOf(new Set([1, 2, 3]))).toBe(3);
      expect(sizeOf({ a: 1, b: 2 })).toBe(2);
    });
  });

  describe("feature flags", () => {
    const STORAGE_KEY = "excalidraw-feature-flags";

    beforeEach(() => {
      localStorage.removeItem(STORAGE_KEY);
      vi.resetModules();
    });

    afterEach(() => {
      localStorage.removeItem(STORAGE_KEY);
    });

    it("defaults to false when nothing is stored", async () => {
      const { getFeatureFlag } = await import("../src/utils");
      expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(false);
    });

    it("reads stored flags from localStorage", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ COMPLEX_BINDINGS: true }),
      );
      const { getFeatureFlag } = await import("../src/utils");
      expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(true);
    });

    it("ignores malformed stored flags", async () => {
      localStorage.setItem(STORAGE_KEY, "{bad");
      const { getFeatureFlag } = await import("../src/utils");
      expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(false);
    });

    it("setFeatureFlag() updates the value and persists it", async () => {
      const { getFeatureFlag, setFeatureFlag } = await import("../src/utils");
      setFeatureFlag("COMPLEX_BINDINGS", true);
      expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(true);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
        COMPLEX_BINDINGS: true,
      });
    });

    it("setFeatureFlag() logs when storage is unavailable", async () => {
      const { setFeatureFlag } = await import("../src/utils");
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      setFeatureFlag("COMPLEX_BINDINGS", true);
      expect(error).toHaveBeenCalledWith(
        "unable to set feature flag",
        expect.any(Error),
      );
    });
  });
});
