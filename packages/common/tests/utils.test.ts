import {
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
  findIndex,
  findLastIndex,
  focusNearestParent,
  getDateTime,
  getFeatureFlag,
  getFontFamilyString,
  getFontString,
  getFrame,
  getSvgPathFromStroke,
  getUpdatedTimestamp,
  getVersion,
  invariant,
  isAnyTrue,
  isDevEnv,
  isMemberOf,
  isPrimitive,
  isProdEnv,
  isPromiseLike,
  isRTL,
  isReadonlyArray,
  isRunningInIframe,
  isSelectionLikeTool,
  isServerEnv,
  isShallowEqual,
  isTestEnv,
  isWritableElement,
  memoize,
  muteFSAbortError,
  nFormatter,
  nextAnimationFrame,
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
  toArray,
  toBrandedType,
  toIterable,
  tupleToCoors,
  updateActiveTool,
  updateObject,
  updateStable,
  viewportCoordsToSceneCoords,
  wrapEvent,
} from "@excalidraw/common";

import type { AppState, Zoom } from "@excalidraw/excalidraw/types";
import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("feature flags", () => {
  // feature flags are cached at module level, so these run in order
  it("reads flags from localStorage on first access", () => {
    localStorage.setItem(
      "excalidraw-feature-flags",
      JSON.stringify({ COMPLEX_BINDINGS: true }),
    );
    expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(true);
  });

  it("persists updated flags", () => {
    setFeatureFlag("COMPLEX_BINDINGS", false);
    expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("excalidraw-feature-flags")!),
    ).toEqual({ COMPLEX_BINDINGS: false });
  });

  it("logs when flags cannot be persisted", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setFeatureFlag("COMPLEX_BINDINGS", true);
    expect(error).toHaveBeenCalledWith(
      "unable to set feature flag",
      expect.any(Error),
    );
    // in-memory value is still updated
    expect(getFeatureFlag("COMPLEX_BINDINGS")).toBe(true);
    localStorage.clear();
  });
});

describe("getDateTime", () => {
  it("formats the current local date as YYYY-MM-DD-HHmm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 5, 7, 3));
    expect(getDateTime()).toBe("2024-01-05-0703");
  });

  it("returns the mocked date time when set, until cleared", () => {
    setDateTimeForTests("2000-01-01-0000");
    expect(getDateTime()).toBe("2000-01-01-0000");
    setDateTimeForTests("");
    expect(getDateTime()).not.toBe("2000-01-01-0000");
  });
});

describe("string helpers", () => {
  it("capitalizeString uppercases only the first character", () => {
    expect(capitalizeString("hello world")).toBe("Hello world");
    expect(capitalizeString("")).toBe("");
  });

  it("isRTL detects strings whose first directional char is RTL", () => {
    expect(isRTL("שלום")).toBe(true);
    expect(isRTL("123 مرحبا")).toBe(true);
    expect(isRTL("hello שלום")).toBe(false);
    expect(isRTL("123")).toBe(false);
  });

  it("normalizeEOL converts CRLF and CR to LF", () => {
    expect(normalizeEOL("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("escapeDoubleQuotes escapes every double quote", () => {
    expect(escapeDoubleQuotes(`say "hi" "there"`)).toBe(
      "say &quot;hi&quot; &quot;there&quot;",
    );
  });

  it("nFormatter abbreviates numbers with SI suffixes", () => {
    expect(nFormatter(512, 1)).toBe("512b");
    expect(nFormatter(1500, 1)).toBe("1.5k");
    expect(nFormatter(2000, 2)).toBe("2k");
    expect(nFormatter(3_250_000, 2)).toBe("3.25M");
    expect(nFormatter(7e9, 0)).toBe("7G");
  });

  it("bytesToHexString zero-pads each byte", () => {
    expect(bytesToHexString(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
  });
});

describe("fonts", () => {
  it("builds a font family string with fallbacks", () => {
    expect(getFontFamilyString({ fontFamily: FONT_FAMILY.Excalifont })).toBe(
      "Excalifont, Xiaolai, sans-serif, Segoe UI Emoji",
    );
    expect(getFontFamilyString({ fontFamily: FONT_FAMILY.Cascadia })).toBe(
      "Cascadia, monospace, Segoe UI Emoji",
    );
  });

  it("falls back to the emoji font for unknown families", () => {
    expect(getFontFamilyString({ fontFamily: 4 as any })).toBe(
      "Segoe UI Emoji",
    );
  });

  it("prefixes the font size", () => {
    expect(
      getFontString({ fontSize: 20, fontFamily: FONT_FAMILY.Nunito }),
    ).toBe("20px Nunito, sans-serif, Segoe UI Emoji");
  });
});

describe("isWritableElement", () => {
  it("accepts text-like inputs only", () => {
    for (const type of ["text", "number", "password", "search"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isWritableElement(input)).toBe(true);
    }
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isWritableElement(checkbox)).toBe(false);
  });

  it("accepts textareas, wysiwyg, br and code editor descendants", () => {
    expect(isWritableElement(document.createElement("textarea"))).toBe(true);
    expect(isWritableElement(document.createElement("br"))).toBe(true);

    const wysiwyg = document.createElement("div");
    wysiwyg.dataset.type = "wysiwyg";
    expect(isWritableElement(wysiwyg)).toBe(true);

    const editor = document.createElement("div");
    editor.className = "cm-editor";
    const line = document.createElement("span");
    editor.append(line);
    expect(isWritableElement(line)).toBe(true);
  });

  it("rejects other elements and non-elements", () => {
    expect(isWritableElement(document.createElement("div"))).toBe(false);
    expect(isWritableElement(null)).toBe(false);
  });
});

describe("timing helpers", () => {
  it("debounce calls the function once with the latest args", () => {
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

  it("debounce.flush runs pending call immediately, and only once", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced("a");
    debounced.flush();
    expect(fn).toHaveBeenCalledWith("a");
    debounced.flush();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("debounce.cancel drops the pending call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced("a");
    debounced.cancel();
    vi.advanceTimersByTime(200);
    debounced.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("nextAnimationFrame runs the callback two frames later", async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    const cb = vi.fn();
    await nextAnimationFrame(cb);
    expect(callbacks).toHaveLength(1);
    callbacks[0](0);
    expect(cb).not.toHaveBeenCalled();
    callbacks[1](0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("easeOut eases from 0 to 1", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.9375);
  });
});

describe("array helpers", () => {
  it("chunk splits arrays into fixed-size groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
    expect(chunk([1, 2], 0)).toEqual([]);
  });

  it("findIndex supports positive and negative fromIndex", () => {
    const arr = [1, 2, 3, 2, 1];
    expect(findIndex(arr, (x) => x === 2)).toBe(1);
    expect(findIndex(arr, (x) => x === 2, 2)).toBe(3);
    expect(findIndex(arr, (x) => x === 1, -2)).toBe(4);
    expect(findIndex(arr, (x) => x === 2, -100)).toBe(1);
    expect(findIndex(arr, (x) => x === 9)).toBe(-1);
  });

  it("findLastIndex searches backwards from fromIndex", () => {
    const arr = [1, 2, 3, 2, 1];
    expect(findLastIndex(arr, (x) => x === 2)).toBe(3);
    expect(findLastIndex(arr, (x) => x === 2, 2)).toBe(1);
    expect(findLastIndex(arr, (x) => x === 1, -2)).toBe(0);
    expect(findLastIndex(arr, (x) => x === 1, 100)).toBe(4);
    expect(findLastIndex(arr, (x) => x === 9)).toBe(-1);
  });

  it("arrayToMap keys items by id or string value and passes maps through", () => {
    const a = { id: "a", v: 1 };
    const b = { id: "b", v: 2 };
    const map = arrayToMap([a, b]);
    expect([...map.entries()]).toEqual([
      ["a", a],
      ["b", b],
    ]);
    expect([...arrayToMap(["x", "y"]).keys()]).toEqual(["x", "y"]);
    expect(arrayToMap(map)).toBe(map);
  });

  it("arrayToMapWithIndex stores element and index", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    expect(arrayToMapWithIndex([a, b]).get("b")).toEqual([b, 1]);
  });

  it("arrayToObject keys by index or groupBy result", () => {
    expect(arrayToObject(["a", "b"])).toEqual({ 0: "a", 1: "b" });
    expect(arrayToObject([{ k: "x" }, { k: "y" }], (item) => item.k)).toEqual({
      x: { k: "x" },
      y: { k: "y" },
    });
  });

  it("arrayToList builds a circular doubly linked list", () => {
    const [first, second, third] = arrayToList([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    expect(first.next).toBe(second);
    expect(second.next).toBe(third);
    expect(third.next).toBe(first);
    expect(first.prev).toBe(third);
    expect(third.prev).toBe(second);
  });

  it("arrayToList keeps a single node unlinked", () => {
    const [only] = arrayToList([{ id: 1 }]);
    expect(only.prev).toBe(null);
    expect(only.next).toBe(null);
  });

  it("toIterable and toArray handle arrays and maps", () => {
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

  it("castArray, isReadonlyArray and sizeOf", () => {
    expect(castArray(1)).toEqual([1]);
    const arr = [1];
    expect(castArray(arr)).toBe(arr);
    expect(isReadonlyArray([])).toBe(true);
    expect(isReadonlyArray({})).toBe(false);
    expect(sizeOf([1, 2])).toBe(2);
    expect(sizeOf(new Map([["a", 1]]))).toBe(1);
    expect(sizeOf(new Set([1, 2, 3]))).toBe(3);
    expect(sizeOf({ a: 1, b: 2 })).toBe(2);
  });

  it("oneOf and isMemberOf check membership", () => {
    const haystack = ["a", "b"] as const;
    expect(oneOf<string, string>("a", haystack)).toBe(true);
    expect(oneOf<string, string>("c", haystack)).toBe(false);
    expect(isMemberOf(new Set(["a"]), "a")).toBe(true);
    expect(isMemberOf(new Map([["a", 1]]), "b")).toBe(false);
    expect(isMemberOf(["a", "b"], "b")).toBe(true);
    expect(isMemberOf({ a: 1 }, "a")).toBe(true);
    expect(isMemberOf({ a: 1 }, "toString")).toBe(false);
  });

  it("isAnyTrue returns whether any argument is true", () => {
    expect(isAnyTrue(false, false, true)).toBe(true);
    expect(isAnyTrue(false, false)).toBe(false);
  });
});

describe("selection and DOM helpers", () => {
  it("selectNode selects node contents and removeSelection clears them", () => {
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
    const inner = document.createElement("div");
    const input = document.createElement("input");
    inner.append(input);
    outer.append(inner);
    document.body.append(outer);

    focusNearestParent(input);
    expect(document.activeElement).toBe(outer);
  });

  it("focusNearestParent does nothing without a focusable ancestor", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const before = document.activeElement;
    focusNearestParent(input);
    expect(document.activeElement).toBe(before);
  });

  it("queryFocusableElements returns enabled, tabbable elements", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <button id="ok">a</button>
      <button id="disabled" disabled>b</button>
      <a id="link" href="#">c</a>
      <div id="untabbable" tabindex="-1"></div>
      <div id="tabbable" tabindex="0"></div>
      <span>ignored</span>
    `;
    expect(queryFocusableElements(container).map((el) => el.id)).toEqual([
      "ok",
      "link",
      "tabbable",
    ]);
    expect(queryFocusableElements(null)).toEqual([]);
  });

  it("getVersion reads the version meta tag or falls back", () => {
    expect(getVersion()).toBe("{version}");
    const meta = document.createElement("meta");
    meta.name = "version";
    meta.content = "1.2.3";
    document.head.append(meta);
    expect(getVersion()).toBe("1.2.3");
    meta.remove();
  });

  it("getFrame reports top when not embedded", () => {
    expect(getFrame()).toBe("top");
    expect(isRunningInIframe()).toBe(false);
  });

  it("getFrame reports iframe when window.top differs or throws", () => {
    vi.spyOn(window, "top", "get").mockReturnValue({} as Window);
    expect(getFrame()).toBe("iframe");
    vi.spyOn(window, "top", "get").mockImplementation(() => {
      throw new Error("cross-origin");
    });
    expect(isRunningInIframe()).toBe(true);
  });

  it("preventUnload prevents default and clears returnValue", () => {
    const event = {
      preventDefault: vi.fn(),
      returnValue: "leave?",
    } as unknown as BeforeUnloadEvent;
    preventUnload(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
  });

  it("wrapEvent creates a cancelable CustomEvent with the native event", () => {
    const native = new Event("paste");
    const wrapped = wrapEvent("excalidraw-paste" as any, native);
    expect(wrapped.type).toBe("excalidraw-paste");
    expect(wrapped.cancelable).toBe(true);
    expect(wrapped.detail.nativeEvent).toBe(native);
  });

  it("addEventListener attaches and returns an unsubscribe", () => {
    const button = document.createElement("button");
    const listener = vi.fn();
    const unsubscribe = addEventListener(button, "click", listener);
    button.click();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    button.click();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("addEventListener accepts falsy targets", () => {
    const unsubscribe = addEventListener(null, "click", vi.fn());
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("coordinates", () => {
  const state = {
    zoom: { value: 2 as NormalizedZoomValue } as Zoom,
    offsetLeft: 10,
    offsetTop: 20,
    scrollX: 5,
    scrollY: -5,
  };

  it("converts viewport to scene coords and back", () => {
    const scene = viewportCoordsToSceneCoords(
      { clientX: 110, clientY: 220 },
      state,
    );
    expect(scene).toEqual({ x: 45, y: 105 });
    expect(
      sceneCoordsToViewportCoords({ sceneX: scene.x, sceneY: scene.y }, state),
    ).toEqual({ x: 110, y: 220 });
  });

  it("tupleToCoors and distance", () => {
    expect(tupleToCoors([3, 4])).toEqual({ x: 3, y: 4 });
    expect(distance(3, 10)).toBe(7);
    expect(distance(10, 3)).toBe(7);
  });
});

describe("tools", () => {
  const baseActiveTool: AppState["activeTool"] = {
    type: "rectangle",
    customType: null,
    locked: true,
    lastActiveTool: null,
    fromSelection: true,
  };

  it("isSelectionLikeTool accepts selection and lasso", () => {
    expect(isSelectionLikeTool("selection")).toBe(true);
    expect(isSelectionLikeTool("lasso")).toBe(true);
    expect(isSelectionLikeTool("rectangle")).toBe(false);
  });

  it("switches to a custom tool keeping the lock state", () => {
    expect(
      updateActiveTool(
        { activeTool: baseActiveTool },
        { type: "custom", customType: "magic" },
      ),
    ).toEqual({ ...baseActiveTool, type: "custom", customType: "magic" });
  });

  it("switches to a builtin tool and resets fromSelection", () => {
    expect(
      updateActiveTool(
        { activeTool: baseActiveTool },
        { type: "ellipse", locked: false },
      ),
    ).toEqual({
      ...baseActiveTool,
      type: "ellipse",
      customType: null,
      locked: false,
      fromSelection: false,
    });
  });

  it("updates lastActiveTool only when provided", () => {
    const last = { ...baseActiveTool, type: "arrow" as const };
    const next = updateActiveTool(
      { activeTool: baseActiveTool },
      { type: "selection", lastActiveTool: last, fromSelection: true },
    );
    expect(next.lastActiveTool).toBe(last);
    expect(next.fromSelection).toBe(true);

    expect(
      updateActiveTool({ activeTool: next }, { type: "text" }).lastActiveTool,
    ).toBe(last);
    expect(
      updateActiveTool(
        { activeTool: next },
        { type: "text", lastActiveTool: null },
      ).lastActiveTool,
    ).toBe(null);
  });
});

describe("environment", () => {
  it("reports the test environment", () => {
    expect(isTestEnv()).toBe(true);
    expect(isDevEnv()).toBe(false);
    expect(isProdEnv()).toBe(false);
    expect(isServerEnv()).toBe(true);
    expect(getUpdatedTimestamp()).toBe(1);
  });
});

describe("object helpers", () => {
  it("updateObject returns the same object when nothing changes", () => {
    const obj = { a: 1, b: "x", c: null as null | number };
    expect(updateObject(obj, { a: 1 })).toBe(obj);
    expect(updateObject(obj, { a: undefined })).toBe(obj);
    expect(updateObject(obj, { c: null })).toBe(obj);
  });

  it("updateObject returns a new object on change or object values", () => {
    const nested = { x: 1 };
    const obj = { a: 1, nested };
    expect(updateObject(obj, { a: 2 })).toEqual({ a: 2, nested });
    const sameRef = updateObject(obj, { nested });
    expect(sameRef).not.toBe(obj);
    expect(sameRef).toEqual(obj);
  });

  it("isPrimitive", () => {
    for (const value of [null, undefined, 1, "a", true, Symbol("s")]) {
      expect(isPrimitive(value)).toBe(true);
    }
    expect(isPrimitive({})).toBe(false);
    expect(isPrimitive(() => {})).toBe(false);
  });

  it("isPromiseLike requires then, catch and finally", () => {
    expect(isPromiseLike(Promise.resolve())).toBe(true);
    expect(isPromiseLike({ then() {} })).toBe(false);
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike("then")).toBe(false);
  });

  it("cloneJSON deep clones plain data", () => {
    const original = { a: [1, { b: 2 }] };
    const clone = cloneJSON(original);
    expect(clone).toEqual(original);
    expect(clone.a).not.toBe(original.a);
  });

  it("safelyParseJSON returns null on invalid JSON", () => {
    expect(safelyParseJSON('{"a":1}')).toEqual({ a: 1 });
    expect(safelyParseJSON("{nope")).toBe(null);
  });

  it("toBrandedType returns the value unchanged", () => {
    const value = { a: 1 };
    expect(toBrandedType<typeof value>(value)).toBe(value);
  });
});

describe("isShallowEqual", () => {
  it("compares top-level values and treats empty arrays as equal", () => {
    expect(isShallowEqual({ a: 1, b: [] }, { a: 1, b: [] })).toBe(true);
    expect(isShallowEqual({ a: 1, b: [1] }, { a: 1, b: [1] })).toBe(false);
    expect(isShallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("returns false for different key counts and warns in debug mode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      isShallowEqual<Record<string, number>, []>(
        { a: 1 },
        { a: 1, b: 2 },
        undefined,
        true,
      ),
    ).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("uses per-key comparators", () => {
    const objA = { a: [1, 2], b: 1 };
    const objB = { a: [1, 2], b: 1 };
    expect(isShallowEqual(objA, objB)).toBe(false);
    expect(
      isShallowEqual(objA, objB, {
        a: (x, y) => x.join() === y.join(),
      }),
    ).toBe(true);
  });

  it("compares the listed keys when comparators is an array", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const keys = ["a", "b"] as const;
    expect(isShallowEqual({ a: 1, b: [] }, { a: 1, b: [] }, keys)).toBe(true);
    expect(isShallowEqual({ a: 1, b: [] }, { a: 2, b: [] }, keys, true)).toBe(
      false,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns on mismatched values in debug mode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      isShallowEqual<{ a: number }, []>({ a: 1 }, { a: 2 }, undefined, true),
    ).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("updateStable keeps the previous reference when shallow equal", () => {
    const prev = { a: 1 };
    expect(updateStable(prev, { a: 1 })).toBe(prev);
    const next = { a: 2 };
    expect(updateStable(prev, next)).toBe(next);
  });
});

describe("function helpers", () => {
  it("composeEventHandlers calls ours unless default was prevented", () => {
    const calls: string[] = [];
    const handler = composeEventHandlers<Event>(
      (event) => {
        calls.push("original");
        if ((event as any).stop) {
          event.preventDefault();
        }
      },
      () => calls.push("ours"),
    );

    handler(new Event("click", { cancelable: true }));
    expect(calls).toEqual(["original", "ours"]);

    calls.length = 0;
    const prevented = Object.assign(new Event("click", { cancelable: true }), {
      stop: true,
    });
    handler(prevented);
    expect(calls).toEqual(["original"]);
  });

  it("composeEventHandlers ignores defaultPrevented when disabled", () => {
    const ours = vi.fn();
    const event = new Event("click", { cancelable: true });
    event.preventDefault();
    composeEventHandlers<Event>(undefined, ours, {
      checkForDefaultPrevented: false,
    })(event);
    expect(ours).toHaveBeenCalledWith(event);
  });

  it("assertNever throws, soft-asserts or passes through", () => {
    expect(() => assertNever("x" as never, "bad value")).toThrow("bad value");

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(assertNever("x" as never, "soft", true)).toBe("x");
    expect(error).toHaveBeenCalledWith("soft");

    expect(assertNever("y" as never, null)).toBe("y");
  });

  it("invariant throws on falsy conditions", () => {
    expect(() => invariant(0, "nope")).toThrow("nope");
    expect(() => invariant(1, "nope")).not.toThrow();
  });

  it("memoize caches on strictly equal option values", () => {
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

  it("muteFSAbortError swallows AbortError and rethrows others", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const abort = new DOMException("aborted", "AbortError");
    expect(() => muteFSAbortError(abort)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(abort);

    const other = new Error("other");
    expect(() => muteFSAbortError(other)).toThrow(other);
  });

  it("resolvablePromise resolves and rejects externally", async () => {
    const ok = resolvablePromise<number>();
    ok.resolve(5);
    await expect(ok).resolves.toBe(5);

    const bad = resolvablePromise<number>();
    bad.reject(new Error("fail"));
    await expect(bad).rejects.toThrow("fail");
  });

  it("promiseTry wraps sync results, async results and sync throws", async () => {
    await expect(
      promiseTry((a: number, b: number) => a + b, 1, 2),
    ).resolves.toBe(3);
    await expect(promiseTry(async () => "async")).resolves.toBe("async");
    await expect(
      promiseTry(() => {
        throw new Error("sync");
      }),
    ).rejects.toThrow("sync");
  });
});

describe("getSvgPathFromStroke", () => {
  it("returns an empty path for fewer than 4 points", () => {
    expect(
      getSvgPathFromStroke([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBe("");
  });

  it("builds a closed quadratic path by default", () => {
    expect(
      getSvgPathFromStroke([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).toBe("M0.00,0.00 Q10.00,0.00 10.00,5.00 T5.00,10.00 Z");
  });

  it("omits the closing command for open paths", () => {
    expect(
      getSvgPathFromStroke(
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        false,
      ),
    ).toBe("M0.00,0.00 Q10.00,0.00 10.00,5.00 T5.00,10.00 ");
  });
});
