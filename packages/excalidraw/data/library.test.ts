import { vi } from "vitest";

import {
  DEFAULT_SIDEBAR,
  LIBRARY_SIDEBAR_TAB,
  MIME_TYPES,
  URL_HASH_KEYS,
  URL_QUERY_KEYS,
} from "@excalidraw/common";

import { API } from "../tests/helpers/api";
import { editorJotaiStore } from "../editor-jotai";
import { AbortError } from "../errors";

import { serializeLibraryAsJSON } from "./json";
import Library, {
  getLibraryItemsHash,
  libraryItemsAtom,
  mergeLibraryItems,
  parseLibraryTokensFromUrl,
  validateLibraryUrl,
} from "./library";

import type App from "../components/App";
import type { LibraryItem, LibraryItems } from "../types";

describe("validateLibraryUrl", () => {
  it("should validate hostname & pathname", () => {
    // valid hostnames
    // -------------------------------------------------------------------------
    expect(
      validateLibraryUrl("https://www.excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://library.excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://library.excalidraw.com", [
        "library.excalidraw.com",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/", ["excalidraw.com/"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com", ["excalidraw.com/"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/", ["excalidraw.com"]),
    ).toBe(true);

    // valid pathnames
    // -------------------------------------------------------------------------
    expect(
      validateLibraryUrl("https://excalidraw.com/path", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/path/", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path/", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path", [
        "excalidraw.com/specific/path/",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path/other", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);

    // invalid hostnames
    // -------------------------------------------------------------------------
    expect(() =>
      validateLibraryUrl("https://xexcalidraw.com", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://x-excalidraw.com", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.comx", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.comx", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com.mx", ["excalidraw.com"]),
    ).toThrow();
    // protocol must be https
    expect(() =>
      validateLibraryUrl("http://excalidraw.com.mx", ["excalidraw.com"]),
    ).toThrow();

    // invalid pathnames
    // -------------------------------------------------------------------------
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/other/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/paths", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/path-s", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/some/specific/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
  });
});

describe("validateLibraryUrl (custom validator)", () => {
  it("uses a validator function when supplied", () => {
    const validator = vi.fn((url: string) => url.startsWith("https://ok"));
    expect(validateLibraryUrl("https://ok.com/lib", validator)).toBe(true);
    expect(validator).toHaveBeenCalledWith("https://ok.com/lib");
    expect(() => validateLibraryUrl("https://bad.com/lib", validator)).toThrow(
      'Invalid or disallowed library URL: "https://bad.com/lib"',
    );
  });

  it("defaults to the excalidraw.com allow-list", () => {
    expect(validateLibraryUrl("https://libraries.excalidraw.com/x")).toBe(true);
    expect(() => validateLibraryUrl("https://example.com/x")).toThrow();
  });
});

const createItem = (
  id: string,
  elements = [API.createElement({ type: "rectangle" })],
  extra: Partial<LibraryItem> = {},
): LibraryItem => ({
  id,
  status: "unpublished",
  created: 1,
  elements,
  ...extra,
});

describe("mergeLibraryItems", () => {
  it("prepends unique items from the other library", () => {
    const local = [createItem("a"), createItem("b")];
    const other = [createItem("c")];
    expect(mergeLibraryItems(local, other).map((item) => item.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("skips items whose elements match an existing item", () => {
    const elements = [API.createElement({ type: "rectangle" })];
    const local = [createItem("a", elements)];
    // same element ids & versionNonces, different item id
    const duplicate = createItem("dup", elements);
    expect(mergeLibraryItems(local, [duplicate]).map((i) => i.id)).toEqual([
      "a",
    ]);
  });

  it("treats items with different element counts or order as unique", () => {
    const el1 = API.createElement({ type: "rectangle" });
    const el2 = API.createElement({ type: "ellipse" });
    const local = [createItem("a", [el1, el2])];
    const reordered = createItem("b", [el2, el1]);
    const subset = createItem("c", [el1]);
    expect(
      mergeLibraryItems(local, [reordered, subset]).map((i) => i.id),
    ).toEqual(["b", "c", "a"]);
  });
});

describe("getLibraryItemsHash", () => {
  it("is order-independent and changes with item id, name or element versionNonce", () => {
    const el = API.createElement({ type: "rectangle" });
    const a = createItem("a", [el]);
    const b = createItem("b");
    const hash = getLibraryItemsHash([a, b]);
    expect(getLibraryItemsHash([b, a])).toBe(hash);
    expect(getLibraryItemsHash([{ ...a, name: "renamed" }, b])).not.toBe(hash);
    expect(getLibraryItemsHash([{ ...a, id: "a2" }, b])).not.toBe(hash);
    expect(
      getLibraryItemsHash([
        { ...a, elements: [{ ...el, versionNonce: el.versionNonce + 1 }] },
        b,
      ]),
    ).not.toBe(hash);
  });
});

describe("parseLibraryTokensFromUrl", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("returns null without a library url", () => {
    window.history.replaceState(null, "", "/#foo=bar");
    expect(parseLibraryTokensFromUrl()).toBeNull();
  });

  it("reads the library url and token from the hash", () => {
    window.history.replaceState(
      null,
      "",
      `/#${URL_HASH_KEYS.addLibrary}=https%3A%2F%2Flib.test%2Fa&token=tok`,
    );
    expect(parseLibraryTokensFromUrl()).toEqual({
      libraryUrl: "https://lib.test/a",
      idToken: "tok",
    });
  });

  it("supports the legacy query parameter", () => {
    window.history.replaceState(
      null,
      "",
      `/?${URL_QUERY_KEYS.addLibrary}=https%3A%2F%2Flib.test%2Fb`,
    );
    expect(parseLibraryTokensFromUrl()).toEqual({
      libraryUrl: "https://lib.test/b",
      idToken: null,
    });
  });
});

describe("Library", () => {
  const createApp = () => {
    const app = {
      props: { onLibraryChange: vi.fn() },
      setState: vi.fn(),
      focusContainer: vi.fn(),
    };
    return { app, library: new Library(app as unknown as App) };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("setLibrary replaces items, notifies listeners and updates the atom", async () => {
    const { app, library } = createApp();
    const items = [createItem("a")];

    const result = await library.setLibrary(items);
    expect(result.map((item) => item.id)).toEqual(["a"]);
    // stored items are cloned
    expect(result[0]).not.toBe(items[0]);
    expect(app.props.onLibraryChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a" }),
    ]);
    expect(editorJotaiStore.get(libraryItemsAtom)).toMatchObject({
      status: "loaded",
      isInitialized: true,
      libraryItems: [expect.objectContaining({ id: "a" })],
    });
  });

  it("setLibrary accepts an updater function invoked with latest items", async () => {
    const { library } = createApp();
    await library.setLibrary([createItem("a")]);
    const updater = vi.fn((items: LibraryItems) => [createItem("b"), ...items]);
    const result = await library.setLibrary(updater);
    expect(updater).toHaveBeenCalledWith([
      expect.objectContaining({ id: "a" }),
    ]);
    expect(result.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("swallows AbortError and keeps current items", async () => {
    const { library } = createApp();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await library.setLibrary([createItem("a")]);
    const result = await library.setLibrary(Promise.reject(new AbortError()));
    expect(result.map((item) => item.id)).toEqual(["a"]);
    expect(console.warn).toHaveBeenCalledWith("Library update aborted by user");
  });

  it("propagates other errors", async () => {
    const { library } = createApp();
    await expect(
      library.setLibrary(Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
  });

  it("getLatestLibrary waits for queued updates", async () => {
    const { library } = createApp();
    library.setLibrary([createItem("a")]);
    library.setLibrary(async (items) => [...items, createItem("b")]);
    const latest = await library.getLatestLibrary();
    expect(latest.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("resetLibrary clears all items", async () => {
    const { library } = createApp();
    await library.setLibrary([createItem("a")]);
    expect(await library.resetLibrary()).toEqual([]);
    expect(await library.getLatestLibrary()).toEqual([]);
  });

  it("updateLibrary restores items with the default status", async () => {
    const { library } = createApp();
    const result = await library.updateLibrary({
      libraryItems: [
        { id: "x", elements: [API.createElement({ type: "rectangle" })] },
      ] as any,
      defaultStatus: "published",
    });
    expect(result).toEqual([
      expect.objectContaining({ id: "x", status: "published" }),
    ]);
  });

  it("updateLibrary merges with existing items when merge is set", async () => {
    const { library } = createApp();
    await library.setLibrary([createItem("a")]);
    const result = await library.updateLibrary({
      libraryItems: [createItem("b")],
      merge: true,
    });
    expect(result.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("updateLibrary accepts a function source and a Blob source", async () => {
    const { library } = createApp();
    await library.setLibrary([createItem("a")]);
    const fromFn = await library.updateLibrary({
      libraryItems: (current) => [...current, createItem("b")],
    });
    expect(fromFn.map((item) => item.id)).toEqual(["a", "b"]);

    const blob = new Blob([serializeLibraryAsJSON([createItem("c")])], {
      type: MIME_TYPES.excalidrawlib,
    });
    const fromBlob = await library.updateLibrary({ libraryItems: blob });
    expect(fromBlob.map((item) => item.id)).toEqual(["c"]);
  });

  it("updateLibrary opens the library sidebar when requested", async () => {
    const { app, library } = createApp();
    await library.updateLibrary({ libraryItems: [], openLibraryMenu: true });
    expect(app.setState).toHaveBeenCalledWith({
      openSidebar: { name: DEFAULT_SIDEBAR.name, tab: LIBRARY_SIDEBAR_TAB },
    });
  });

  it("updateLibrary applies items and focuses after a confirmed prompt", async () => {
    const { app, library } = createApp();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const result = await library.updateLibrary({
      libraryItems: [createItem("a")],
      prompt: true,
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(app.focusContainer).toHaveBeenCalled();
    expect(result.map((item) => item.id)).toEqual(["a"]);
  });

  it("updateLibrary keeps current items when the prompt is declined", async () => {
    const { app, library } = createApp();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await library.setLibrary([createItem("a")]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const result = await library.updateLibrary({
      libraryItems: [createItem("b")],
      prompt: true,
    });
    expect(result.map((item) => item.id)).toEqual(["a"]);
    expect(app.focusContainer).not.toHaveBeenCalled();
  });

  it("updateLibrary rejects on an invalid Blob", async () => {
    const { library } = createApp();
    await expect(
      library.updateLibrary({ libraryItems: new Blob(["{}"]) }),
    ).rejects.toThrow("Invalid library");
  });

  it("destroy clears current items", async () => {
    const { library } = createApp();
    await library.setLibrary([createItem("a")]);
    library.destroy();
    expect(await library.getLatestLibrary()).toEqual([]);
  });

  it("logs and continues when onLibraryChange throws", async () => {
    const { app, library } = createApp();
    const error = new Error("listener failed");
    app.props.onLibraryChange.mockImplementation(() => {
      throw error;
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await library.setLibrary([createItem("a")]);
    expect(result.map((item) => item.id)).toEqual(["a"]);
    expect(console.error).toHaveBeenCalledWith(error);
  });
});
