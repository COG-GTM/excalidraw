import {
  DEFAULT_VERSION,
  FONT_FAMILY,
  addEventListener,
  arrayToList,
  arrayToMap,
  arrayToMapWithIndex,
  arrayToObject,
  assertNever,
  bytesToHexString,
  capitalizeString,
  castArray,
  chunk,
  cloneJSON,
  composeEventHandlers,
  debounce,
  distance,
  easeOut,
  escapeDoubleQuotes,
  exitFullScreen,
  allowFullScreen,
  findIndex,
  findLastIndex,
  focusNearestParent,
  getDateTime,
  getFeatureFlag,
  getFontFamilyString,
  getFontString,
  getFrame,
  getGlobalCSSVariable,
  getSvgPathFromStroke,
  getUpdatedTimestamp,
  getVersion,
  invariant,
  isAnyTrue,
  isDevEnv,
  isFullScreen,
  isInputLike,
  isInteractive,
  isMemberOf,
  isPrimitive,
  isProdEnv,
  isPromiseLike,
  isReadonlyArray,
  isRTL,
  isRunningInIframe,
  isSelectionLikeTool,
  isServerEnv,
  isShallowEqual,
  isTestEnv,
  isToolIcon,
  isWritableElement,
  memoize,
  muteFSAbortError,
  nextAnimationFrame,
  nFormatter,
  normalizeEOL,
  oneOf,
  preventUnload,
  promiseTry,
  queryFocusableElements,
  removeSelection,
  resolvablePromise,
  safelyParseJSON,
  sceneCoordsToViewportCoords,
  selectNode,
  setDateTimeForTests,
  setFeatureFlag,
  sizeOf,
  supportsEmoji,
  toArray,
  toBrandedType,
  toIterable,
  tupleToCoors,
  updateActiveTool,
  updateObject,
  updateStable,
  viewportCoordsToSceneCoords,
  wrapEvent,
  getNearestScrollableContainer,
} from "@excalidraw/common";

import type {
  AppState,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";

describe("string helpers", () => {
  it("capitalizeString", () => {
    expect(capitalizeString("hello")).toBe("Hello");
    expect(capitalizeString("")).toBe("");
  });

  it("escapeDoubleQuotes", () => {
    expect(escapeDoubleQuotes(`a "b" c`)).toBe("a &quot;b&quot; c");
  });

  it("normalizeEOL", () => {
    expect(normalizeEOL("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("isRTL", () => {
    expect(isRTL("שלום")).toBe(true);
    expect(isRTL("123 مرحبا")).toBe(true);
    expect(isRTL("hello שלום")).toBe(false);
    expect(isRTL("123")).toBe(false);
  });

  it("nFormatter", () => {
    expect(nFormatter(999, 2)).toBe("999b");
    expect(nFormatter(1000, 0)).toBe("1k");
    expect(nFormatter(1500, 1)).toBe("1.5k");
    expect(nFormatter(2_000_000, 2)).toBe("2M");
    expect(nFormatter(3_250_000_000, 2)).toBe("3.25G");
  });

  it("bytesToHexString", () => {
    expect(bytesToHexString(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
  });
});

describe("getDateTime", () => {
  afterEach(() => {
    setDateTimeForTests("");
    vi.useRealTimers();
  });

  it("formats the current local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 2, 3, 4));
    expect(getDateTime()).toBe("2024-01-02-0304");
  });

  it("returns the mocked date time when set", () => {
    setDateTimeForTests("mocked");
    expect(getDateTime()).toBe("mocked");
  });
});

describe("font strings", () => {
  it("getFontFamilyString includes fallbacks", () => {
    expect(getFontFamilyString({ fontFamily: FONT_FAMILY.Excalifont })).toBe(
      "Excalifont, Xiaolai, sans-serif, Segoe UI Emoji",
    );
    expect(getFontFamilyString({ fontFamily: FONT_FAMILY.Cascadia })).toBe(
      "Cascadia, monospace, Segoe UI Emoji",
    );
  });

  it("getFontFamilyString falls back to the emoji font for unknown ids", () => {
    expect(getFontFamilyString({ fontFamily: 4242 as any })).toBe(
      "Segoe UI Emoji",
    );
  });

  it("getFontString prefixes the font size", () => {
    expect(
      getFontString({ fontSize: 16, fontFamily: FONT_FAMILY.Nunito }),
    ).toBe("16px Nunito, sans-serif, Segoe UI Emoji");
  });
});

describe("timing helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("nextAnimationFrame runs the callback two frames later", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const cb = vi.fn();

    await nextAnimationFrame(cb);
    expect(cb).not.toHaveBeenCalled();
    frames.shift()!(0);
    expect(cb).not.toHaveBeenCalled();
    frames.shift()!(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("debounce calls with the latest args after the timeout", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced(1);
    debounced(2);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
  });

  it("debounce.flush runs pending calls immediately, once", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced.flush();
    expect(fn).not.toHaveBeenCalled();

    debounced("a");
    debounced.flush();
    expect(fn).toHaveBeenCalledWith("a");
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("debounce.cancel drops pending calls", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("a");
    debounced.cancel();
    vi.advanceTimersByTime(200);
    debounced.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("easeOut", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.9375);
  });

  it("getUpdatedTimestamp is stable in test env", () => {
    expect(getUpdatedTimestamp()).toBe(1);
  });
});

describe("array helpers", () => {
  it("chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
    expect(chunk([1], 0)).toEqual([]);
  });

  it("findIndex", () => {
    const arr = [1, 2, 3, 2, 1];
    expect(findIndex(arr, (x) => x === 2)).toBe(1);
    expect(findIndex(arr, (x) => x === 2, 2)).toBe(3);
    expect(findIndex(arr, (x) => x === 1, -2)).toBe(4);
    expect(findIndex(arr, (x) => x === 1, -100)).toBe(0);
    expect(findIndex(arr, (x) => x === 9)).toBe(-1);
  });

  it("findLastIndex", () => {
    const arr = [1, 2, 3, 2, 1];
    expect(findLastIndex(arr, (x) => x === 2)).toBe(3);
    expect(findLastIndex(arr, (x) => x === 2, 2)).toBe(1);
    expect(findLastIndex(arr, (x) => x === 1, -2)).toBe(0);
    expect(findLastIndex(arr, (x) => x === 1, 100)).toBe(4);
    expect(findLastIndex(arr, (x) => x === 9)).toBe(-1);
  });

  it("arrayToMap", () => {
    const map = new Map([["a", { id: "a" }]]);
    expect(arrayToMap(map)).toBe(map);
    expect(arrayToMap(["x", "y"])).toEqual(
      new Map([
        ["x", "x"],
        ["y", "y"],
      ]),
    );
    const a = { id: "a" };
    expect(arrayToMap([a]).get("a")).toBe(a);
  });

  it("arrayToMapWithIndex", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    expect(arrayToMapWithIndex([a, b])).toEqual(
      new Map([
        ["a", [a, 0]],
        ["b", [b, 1]],
      ]),
    );
  });

  it("arrayToObject", () => {
    expect(arrayToObject(["a", "b"])).toEqual({ 0: "a", 1: "b" });
    expect(
      arrayToObject([{ id: "x" }, { id: "y" }], (item) => item.id),
    ).toEqual({ x: { id: "x" }, y: { id: "y" } });
  });

  it("arrayToList builds a circular doubly linked list", () => {
    const [single] = arrayToList([{ v: 1 }]);
    expect(single.prev).toBeNull();
    expect(single.next).toBeNull();

    const [a, b, c] = arrayToList([{ v: 1 }, { v: 2 }, { v: 3 }]);
    expect(a.next).toBe(b);
    expect(b.next).toBe(c);
    expect(c.next).toBe(a);
    expect(a.prev).toBe(c);
    expect(c.prev).toBe(b);
    expect(b.prev).toBe(a);
  });

  it("toIterable / toArray", () => {
    const arr = [1, 2];
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    expect(toIterable(arr)).toBe(arr);
    expect([...toIterable(map)]).toEqual([1, 2]);
    expect(toArray(arr)).toBe(arr);
    expect(toArray(map)).toEqual([1, 2]);
  });

  it("castArray / isReadonlyArray / sizeOf", () => {
    const arr = [1];
    expect(castArray(arr)).toBe(arr);
    expect(castArray(1)).toEqual([1]);
    expect(isReadonlyArray([])).toBe(true);
    expect(isReadonlyArray({})).toBe(false);
    expect(sizeOf([1, 2])).toBe(2);
    expect(sizeOf(new Set([1]))).toBe(1);
    expect(sizeOf(new Map([["a", 1]]))).toBe(1);
    expect(sizeOf({ a: 1, b: 2, c: 3 })).toBe(3);
  });

  it("isMemberOf", () => {
    expect(isMemberOf(new Set(["a"]), "a")).toBe(true);
    expect(isMemberOf(new Map([["a", 1]]), "b")).toBe(false);
    expect(isMemberOf(["a", "b"] as const, "b")).toBe(true);
    expect(isMemberOf({ a: 1 }, "a")).toBe(true);
    expect(isMemberOf({ a: 1 }, "toString")).toBe(false);
  });

  it("oneOf", () => {
    expect(oneOf<string, string>("a", ["a", "b"])).toBe(true);
    expect(oneOf<string, string>("c", ["a", "b"])).toBe(false);
  });

  it("isAnyTrue", () => {
    expect(isAnyTrue(false, false)).toBe(false);
    expect(isAnyTrue(false, true)).toBe(true);
  });
});

describe("object helpers", () => {
  it("cloneJSON creates a deep copy", () => {
    const obj = { a: { b: [1] } };
    const clone = cloneJSON(obj);
    expect(clone).toEqual(obj);
    expect(clone.a).not.toBe(obj.a);
  });

  it("safelyParseJSON", () => {
    expect(safelyParseJSON('{"a":1}')).toEqual({ a: 1 });
    expect(safelyParseJSON("{nope")).toBeNull();
  });

  it("updateObject returns the same object when nothing changes", () => {
    const obj = { a: 1, b: "x", c: null as null | number };
    expect(updateObject(obj, { a: 1 })).toBe(obj);
    expect(updateObject(obj, { a: undefined })).toBe(obj);
    expect(updateObject(obj, { c: null })).toBe(obj);
    expect(updateObject(obj, { a: 2 })).toEqual({ a: 2, b: "x", c: null });
  });

  it("updateObject always updates object values", () => {
    const nested = { x: 1 };
    const obj = { nested };
    const next = updateObject(obj, { nested });
    expect(next).not.toBe(obj);
    expect(next.nested).toBe(nested);
  });

  it("isPrimitive", () => {
    expect(isPrimitive(null)).toBe(true);
    expect(isPrimitive(undefined)).toBe(true);
    expect(isPrimitive(1)).toBe(true);
    expect(isPrimitive("a")).toBe(true);
    expect(isPrimitive({})).toBe(false);
    expect(isPrimitive(() => {})).toBe(false);
  });

  it("isPromiseLike", () => {
    expect(isPromiseLike(Promise.resolve())).toBe(true);
    expect(isPromiseLike({ then() {} })).toBe(false);
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike(1)).toBe(false);
  });

  it("toBrandedType returns the value as-is", () => {
    const value = { a: 1 };
    expect(toBrandedType<typeof value>(value)).toBe(value);
  });

  describe("isShallowEqual", () => {
    it("compares top-level values", () => {
      const nested = { x: 1 };
      expect(isShallowEqual({ a: 1, b: nested }, { a: 1, b: nested })).toBe(
        true,
      );
      expect(isShallowEqual({ a: 1, b: { x: 1 } }, { a: 1, b: { x: 1 } })).toBe(
        false,
      );
      expect(isShallowEqual({ a: [] }, { a: [] })).toBe(true);
      expect(isShallowEqual({ a: 1 }, { a: 1, b: 2 } as any)).toBe(false);
    });

    it("supports per-key comparators", () => {
      expect(
        isShallowEqual(
          { a: { x: 1 }, b: 1 },
          { a: { x: 1 }, b: 1 },
          { a: (x, y) => x.x === y.x },
        ),
      ).toBe(true);
    });

    it("supports a list of keys to compare", () => {
      expect(
        isShallowEqual({ a: 1, b: [] }, { a: 1, b: [] }, ["a", "b"] as const),
      ).toBe(true);
      expect(
        isShallowEqual({ a: 1, b: 2 }, { a: 1, b: 3 }, ["a", "b"] as const),
      ).toBe(false);
    });

    it("warns about differences in debug mode", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      isShallowEqual({ a: 1 }, { a: 1, b: 2 } as any, undefined, true);
      isShallowEqual({ a: 1, b: 2 }, { a: 1, b: 3 }, ["a", "b"] as const, true);
      isShallowEqual({ a: 1 }, { a: 2 }, undefined, true);

      expect(warn).toHaveBeenCalledTimes(3);
      warn.mockRestore();
    });
  });

  it("updateStable keeps the previous reference when shallow equal", () => {
    const prev = { a: 1 };
    expect(updateStable(prev, { a: 1 })).toBe(prev);
    const next = { a: 2 };
    expect(updateStable(prev, next)).toBe(next);
  });

  it("memoize caches on shallow-equal options", () => {
    const fn = vi.fn(({ a, b }: { a: number; b: number }) => a + b);
    const memoized = memoize(fn);

    expect(memoized({ a: 1, b: 2 })).toBe(3);
    expect(memoized({ a: 1, b: 2 })).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);

    expect(memoized({ a: 2, b: 2 })).toBe(4);
    expect(fn).toHaveBeenCalledTimes(2);

    memoized.clear();
    expect(memoized({ a: 2, b: 2 })).toBe(4);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("assertions and errors", () => {
  it("assertNever", () => {
    expect(assertNever("x" as never, null)).toBe("x");
    expect(() => assertNever("x" as never, "bad")).toThrow("bad");

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(assertNever("x" as never, "soft", true)).toBe("x");
    expect(error).toHaveBeenCalledWith("soft");
    error.mockRestore();
  });

  it("invariant", () => {
    expect(() => invariant(true, "nope")).not.toThrow();
    expect(() => invariant(0, "nope")).toThrow("nope");
  });

  it("muteFSAbortError swallows only AbortErrors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const abort = new Error("aborted");
    abort.name = "AbortError";

    expect(() => muteFSAbortError(abort)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(abort);
    expect(() => muteFSAbortError(new Error("other"))).toThrow("other");
    warn.mockRestore();
  });
});

describe("promises", () => {
  it("resolvablePromise resolves and rejects externally", async () => {
    const resolved = resolvablePromise<number>();
    resolved.resolve(1);
    await expect(resolved).resolves.toBe(1);

    const rejected = resolvablePromise<number>();
    rejected.reject(new Error("nope"));
    await expect(rejected).rejects.toThrow("nope");
  });

  it("promiseTry wraps sync values, promises and throws", async () => {
    await expect(promiseTry((a: number) => a * 2, 2)).resolves.toBe(4);
    await expect(promiseTry(() => Promise.resolve("x"))).resolves.toBe("x");
    await expect(
      promiseTry(() => {
        throw new Error("sync");
      }),
    ).rejects.toThrow("sync");
  });
});

describe("coordinates and tools", () => {
  const viewport = {
    zoom: { value: 2 as NormalizedZoomValue },
    offsetLeft: 10,
    offsetTop: 20,
    scrollX: 5,
    scrollY: -5,
  };

  it("converts between viewport and scene coordinates", () => {
    const scene = viewportCoordsToSceneCoords(
      { clientX: 110, clientY: 120 },
      viewport,
    );
    expect(scene.x).toBeCloseTo(45);
    expect(scene.y).toBeCloseTo(55);

    const back = sceneCoordsToViewportCoords(
      { sceneX: scene.x, sceneY: scene.y },
      viewport,
    );
    expect(back.x).toBeCloseTo(110);
    expect(back.y).toBeCloseTo(120);
  });

  it("tupleToCoors / distance", () => {
    expect(tupleToCoors([1, 2])).toEqual({ x: 1, y: 2 });
    expect(distance(3, 10)).toBe(7);
    expect(distance(10, 3)).toBe(7);
  });

  it("isSelectionLikeTool", () => {
    expect(isSelectionLikeTool("selection")).toBe(true);
    expect(isSelectionLikeTool("lasso")).toBe(true);
    expect(isSelectionLikeTool("rectangle")).toBe(false);
  });

  it("updateActiveTool", () => {
    const appState = {
      activeTool: {
        type: "selection",
        customType: null,
        locked: true,
        fromSelection: false,
        lastActiveTool: null,
      },
    } as Pick<AppState, "activeTool">;

    expect(
      updateActiveTool(appState, { type: "custom", customType: "laser2" }),
    ).toEqual({
      ...appState.activeTool,
      type: "custom",
      customType: "laser2",
      locked: true,
    });

    expect(
      updateActiveTool(appState, {
        type: "rectangle",
        locked: false,
        fromSelection: true,
      }),
    ).toEqual({
      type: "rectangle",
      customType: null,
      locked: false,
      fromSelection: true,
      lastActiveTool: null,
    });

    const lastActiveTool = { ...appState.activeTool };
    expect(
      updateActiveTool(appState, { type: "hand", lastActiveTool }),
    ).toEqual({
      type: "hand",
      customType: null,
      locked: true,
      fromSelection: false,
      lastActiveTool,
    });
  });

  it("getSvgPathFromStroke", () => {
    expect(
      getSvgPathFromStroke([
        [0, 0],
        [1, 1],
      ]),
    ).toBe("");

    const points = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(getSvgPathFromStroke(points)).toBe(
      "M0.00,0.00 Q2.00,0.00 2.00,1.00 T1.00,2.00 Z",
    );
    expect(getSvgPathFromStroke(points, false)).toBe(
      "M0.00,0.00 Q2.00,0.00 2.00,1.00 T1.00,2.00 ",
    );
  });
});

describe("environment", () => {
  it("detects the test environment", () => {
    expect(isTestEnv()).toBe(true);
    expect(isDevEnv()).toBe(false);
    expect(isProdEnv()).toBe(false);
    expect(isServerEnv()).toBe(true);
  });

  it("detects whether running in an iframe", () => {
    expect(getFrame()).toBe("top");
    expect(isRunningInIframe()).toBe(false);
  });

  it("getFrame treats cross-origin access errors as iframe", () => {
    const spy = vi.spyOn(window, "top", "get").mockImplementation(() => {
      throw new Error("cross-origin");
    });
    try {
      expect(getFrame()).toBe("iframe");
    } finally {
      spy.mockRestore();
    }
  });

  it("getVersion reads the version meta tag", () => {
    expect(getVersion()).toBe(DEFAULT_VERSION);

    const meta = document.createElement("meta");
    meta.name = "version";
    meta.content = "1.2.3";
    document.head.append(meta);
    try {
      expect(getVersion()).toBe("1.2.3");
    } finally {
      meta.remove();
    }
  });

  it("supportsEmoji is false without a 2d context", () => {
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null);
    try {
      expect(supportsEmoji()).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("supportsEmoji checks the rendered pixel", () => {
    expect(typeof supportsEmoji()).toBe("boolean");
  });

  it("getGlobalCSSVariable reads root custom properties", () => {
    document.documentElement.style.setProperty("--test-var", "12px");
    try {
      expect(getGlobalCSSVariable("test-var").trim()).toBe("12px");
    } finally {
      document.documentElement.style.removeProperty("--test-var");
    }
  });
});

describe("feature flags", () => {
  const STORAGE_KEY = "excalidraw-feature-flags";

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  // flags are cached in module state after the first successful read/write,
  // so these tests run in order: malformed storage, stored flags, updates
  it("ignores malformed stored flags", () => {
    localStorage.setItem(STORAGE_KEY, "{nope");
    expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(false);
  });

  it("loads flags from storage on first read", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ COMPLEX_BINDINGS: true }),
    );
    expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(true);
  });

  it("persists updates", () => {
    setFeatureFlag("COMPLEX_BINDINGS", false);
    expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      COMPLEX_BINDINGS: false,
    });

    setFeatureFlag("COMPLEX_BINDINGS", true);
    expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(true);
    setFeatureFlag("COMPLEX_BINDINGS", false);
  });

  it("logs when flags cannot be persisted", () => {
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      setFeatureFlag("COMPLEX_BINDINGS", true);
      expect(error).toHaveBeenCalledWith(
        "unable to set feature flag",
        expect.any(Error),
      );
    } finally {
      setItem.mockRestore();
      error.mockRestore();
      setFeatureFlag("COMPLEX_BINDINGS", false);
    }
  });
});

describe("DOM helpers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("element guards handle null and non-matching targets", () => {
    expect(isToolIcon(null)).toBe(false);
    expect(isInputLike(null)).toBe(false);
    expect(isInteractive(document.createElement("span"))).toBe(false);

    const label = document.createElement("label");
    const span = document.createElement("span");
    label.append(span);
    expect(isInteractive(span)).toBe(true);
  });

  it("isWritableElement only accepts text-like inputs", () => {
    const input = (type: string) => {
      const el = document.createElement("input");
      el.type = type;
      return el;
    };
    expect(isWritableElement(input("text"))).toBe(true);
    expect(isWritableElement(input("number"))).toBe(true);
    expect(isWritableElement(input("password"))).toBe(true);
    expect(isWritableElement(input("search"))).toBe(true);
    expect(isWritableElement(input("checkbox"))).toBe(false);

    const wysiwyg = document.createElement("div");
    wysiwyg.dataset.type = "wysiwyg";
    expect(isWritableElement(wysiwyg)).toBe(true);
    expect(isWritableElement(document.createElement("br"))).toBe(true);

    const editor = document.createElement("div");
    editor.className = "cm-editor";
    const inner = document.createElement("span");
    editor.append(inner);
    expect(isWritableElement(inner)).toBe(true);
    expect(isWritableElement(document.createElement("div"))).toBe(false);
  });

  it("selectNode / removeSelection", () => {
    const div = document.createElement("div");
    div.textContent = "hello";
    document.body.append(div);

    selectNode(div);
    expect(window.getSelection()!.toString()).toBe("hello");

    removeSelection();
    expect(window.getSelection()!.rangeCount).toBe(0);
  });

  it("focusNearestParent focuses the closest focusable ancestor", () => {
    const outer = document.createElement("div");
    outer.tabIndex = 0;
    const middle = document.createElement("div");
    const input = document.createElement("input");
    middle.append(input);
    outer.append(middle);
    document.body.append(outer);

    focusNearestParent(input);
    expect(document.activeElement).toBe(outer);

    // no focusable parent: no-op
    const lonely = document.createElement("input");
    expect(() => focusNearestParent(lonely)).not.toThrow();
  });

  it("queryFocusableElements filters disabled and negative tabindex", () => {
    expect(queryFocusableElements(null)).toEqual([]);

    const container = document.createElement("div");
    container.innerHTML = `
      <button id="ok">ok</button>
      <button id="disabled" disabled>no</button>
      <input id="hidden" tabindex="-1" />
      <div id="div" tabindex="0"></div>
      <span>skip</span>
    `;
    expect(queryFocusableElements(container).map((el) => el.id)).toEqual([
      "ok",
      "div",
    ]);
  });

  it("getNearestScrollableContainer finds scrollable ancestors", () => {
    const scrollable = document.createElement("div");
    scrollable.style.overflowY = "auto";
    Object.defineProperty(scrollable, "scrollHeight", { value: 200 });
    Object.defineProperty(scrollable, "clientHeight", { value: 100 });
    const child = document.createElement("div");
    scrollable.append(child);
    document.body.append(scrollable);

    expect(getNearestScrollableContainer(child)).toBe(scrollable);

    const detached = document.createElement("div");
    detached.append(document.createElement("span"));
    expect(
      getNearestScrollableContainer(detached.firstElementChild as HTMLElement),
    ).toBe(document);
  });

  it("preventUnload", () => {
    const event = { preventDefault: vi.fn(), returnValue: "x" };
    preventUnload(event as unknown as BeforeUnloadEvent);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
  });

  it("wrapEvent wraps the native event in a cancelable CustomEvent", () => {
    const native = new Event("paste");
    const wrapped = wrapEvent("excalidraw-paste" as any, native);
    expect(wrapped.type).toBe("excalidraw-paste");
    expect(wrapped.cancelable).toBe(true);
    expect(wrapped.detail.nativeEvent).toBe(native);
  });

  it("composeEventHandlers respects defaultPrevented", () => {
    const ours = vi.fn();
    const handler = composeEventHandlers<Event>((event) => {
      event.preventDefault();
    }, ours);

    handler(new Event("click", { cancelable: true }));
    expect(ours).not.toHaveBeenCalled();

    const forced = composeEventHandlers<Event>(
      (event) => event.preventDefault(),
      ours,
      { checkForDefaultPrevented: false },
    );
    forced(new Event("click", { cancelable: true }));
    expect(ours).toHaveBeenCalledTimes(1);

    composeEventHandlers<Event>(undefined, ours)(new Event("click"));
    expect(ours).toHaveBeenCalledTimes(2);
  });

  it("addEventListener returns an unsubscribe callback", () => {
    const listener = vi.fn();
    const div = document.createElement("div");

    const unsubscribe = addEventListener(div, "click", listener);
    div.dispatchEvent(new Event("click"));
    unsubscribe();
    div.dispatchEvent(new Event("click"));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(() => addEventListener(null, "click", listener)()).not.toThrow();
  });

  it("fullscreen helpers", async () => {
    expect(isFullScreen()).toBe(false);

    const request = vi.fn(() => Promise.resolve());
    const exit = vi.fn(() => Promise.resolve());
    (document.documentElement as any).requestFullscreen = request;
    (document as any).exitFullscreen = exit;
    try {
      await allowFullScreen();
      await exitFullScreen();
      expect(request).toHaveBeenCalled();
      expect(exit).toHaveBeenCalled();
    } finally {
      delete (document.documentElement as any).requestFullscreen;
      delete (document as any).exitFullscreen;
    }
  });
});
