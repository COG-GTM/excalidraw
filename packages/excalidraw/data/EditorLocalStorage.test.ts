import { EditorLocalStorage } from "./EditorLocalStorage";

const KEY = "excalidraw-test-key" as any;

describe("EditorLocalStorage", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets, gets, checks and deletes JSON values", () => {
    expect(EditorLocalStorage.has(KEY)).toBe(false);
    expect(EditorLocalStorage.get(KEY)).toBeNull();

    expect(EditorLocalStorage.set(KEY, { a: 1, b: [true, "x"] })).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('{"a":1,"b":[true,"x"]}');
    expect(EditorLocalStorage.has(KEY)).toBe(true);
    expect(EditorLocalStorage.get(KEY)).toEqual({ a: 1, b: [true, "x"] });

    EditorLocalStorage.delete(KEY);
    expect(EditorLocalStorage.has(KEY)).toBe(false);
    expect(EditorLocalStorage.get(KEY)).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns null and warns for invalid JSON", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(EditorLocalStorage.get(KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("localStorage.getItem error"),
    );
  });

  it("handles storage errors gracefully", () => {
    const throwError = () => {
      throw new Error("denied");
    };
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: throwError,
        setItem: throwError,
        removeItem: throwError,
      },
    });
    onTestFinished(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    });

    expect(EditorLocalStorage.has(KEY)).toBe(false);
    expect(EditorLocalStorage.get(KEY)).toBeNull();
    expect(EditorLocalStorage.set(KEY, 1)).toBe(false);
    expect(() => EditorLocalStorage.delete(KEY)).not.toThrow();

    expect(warnSpy.mock.calls.map(([msg]) => msg)).toEqual([
      "localStorage.getItem error: denied",
      "localStorage.getItem error: denied",
      "localStorage.setItem error: denied",
      "localStorage.removeItem error: denied",
    ]);
  });
});
