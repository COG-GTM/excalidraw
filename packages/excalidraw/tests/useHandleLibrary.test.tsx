import React, { useState } from "react";
import { vi } from "vitest";

import { MIME_TYPES } from "@excalidraw/common";

import { serializeLibraryAsJSON } from "../data/json";
import { useHandleLibrary } from "../data/library";
import { t } from "../i18n";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render, unmountComponent, waitFor } from "./test-utils";

import type {
  LibraryMigrationAdapter,
  LibraryPersistedData,
  LibraryPersistenceAdapter,
} from "../data/library";
import type { ExcalidrawImperativeAPI, LibraryItem } from "../types";

const { h } = window;

const LIBRARY_URL =
  "https://libraries.excalidraw.com/libraries/test/test.excalidrawlib";

const createLibraryItem = (id: string): LibraryItem => ({
  id,
  status: "published",
  created: 1,
  elements: [API.createElement({ id: `${id}_rect`, type: "rectangle" })],
});

const ids = (items: readonly { id: string }[] | undefined) =>
  (items || []).map((item) => item.id);

const createAdapter = (initialItems: LibraryItem[] = []) => {
  let stored: LibraryItem[] = initialItems;
  const adapter = {
    load: vi.fn(async () => ({ libraryItems: stored })),
    save: vi.fn(async (data: LibraryPersistedData) => {
      stored = [...data.libraryItems];
    }),
    getStored: () => stored,
  };
  return adapter as typeof adapter & LibraryPersistenceAdapter;
};

const createMigrationAdapter = (
  legacyItems: LibraryItem[] | null,
): LibraryMigrationAdapter & {
  load: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
} => ({
  load: vi.fn(async () => (legacyItems ? { libraryItems: legacyItems } : null)),
  clear: vi.fn(async () => {}),
});

type HostProps = {
  adapter: LibraryPersistenceAdapter;
  migrationAdapter?: LibraryMigrationAdapter;
  validateLibraryUrl?: (libraryUrl: string) => boolean;
};

const Host = (props: HostProps) => {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  useHandleLibrary({ ...props, excalidrawAPI });
  return <Excalidraw onExcalidrawAPI={setExcalidrawAPI} />;
};

const renderHost = async (props: HostProps) => {
  await render(<Host {...props} />);
  await waitFor(() => {
    expect(h.app.library).toBeDefined();
  });
};

const getLibraryItemIds = async () =>
  ids(await h.app.library.getLatestLibrary());

const mockFetchLibrary = (items: LibraryItem[]) => {
  const blob = new Blob([serializeLibraryAsJSON(items)], {
    type: MIME_TYPES.excalidrawlib,
  });
  return vi
    .spyOn(window, "fetch")
    .mockImplementation(async () => ({ blob: async () => blob } as Response));
};

describe("useHandleLibrary", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    unmountComponent();
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  describe("adapter (no migration)", () => {
    it("should load initial library from adapter without re-saving it", async () => {
      const adapter = createAdapter([createLibraryItem("db1")]);

      await renderHost({ adapter });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["db1"]);
      });
      expect(adapter.load).toHaveBeenCalledWith({ source: "load" });
      expect(adapter.save).not.toHaveBeenCalled();
    });

    it("should persist library updates to the adapter", async () => {
      const adapter = createAdapter([createLibraryItem("db1")]);

      await renderHost({ adapter });
      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["db1"]);
      });

      await act(() =>
        h.app.library.updateLibrary({
          libraryItems: [createLibraryItem("new1")],
          merge: true,
        }),
      );

      await waitFor(() => {
        expect(adapter.save).toHaveBeenCalledTimes(1);
      });
      expect(ids(adapter.getStored())).toEqual(["new1", "db1"]);
      expect(adapter.load).toHaveBeenCalledWith({ source: "save" });
    });

    it("should persist deletions to the adapter", async () => {
      const adapter = createAdapter([
        createLibraryItem("db1"),
        createLibraryItem("db2"),
      ]);

      await renderHost({ adapter });
      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["db1", "db2"]);
      });

      await act(() =>
        h.app.library.setLibrary((items) =>
          items.filter((item) => item.id !== "db1"),
        ),
      );

      await waitFor(() => {
        expect(ids(adapter.getStored())).toEqual(["db2"]);
      });
    });

    it("should show an error toast if persisting fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const adapter = createAdapter([createLibraryItem("db1")]);

      await renderHost({ adapter });
      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["db1"]);
      });

      adapter.save.mockRejectedValueOnce(new Error("quota exceeded"));

      await act(() =>
        h.app.library.updateLibrary({
          libraryItems: [createLibraryItem("new1")],
          merge: true,
        }),
      );

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(t("errors.saveLibraryError"));
      });
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("couldn't persist library update"),
        expect.anything(),
      );
    });

    it("should block unload while a save is in progress", async () => {
      const adapter = createAdapter([]);

      await renderHost({ adapter });
      await waitFor(() => {
        expect(adapter.load).toHaveBeenCalled();
      });
      // let the initial load settle
      await act(() => h.app.library.getLatestLibrary());

      let resolveSave!: () => void;
      adapter.save.mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveSave = resolve)),
      );

      await act(() =>
        h.app.library.updateLibrary({
          libraryItems: [createLibraryItem("new1")],
        }),
      );
      await waitFor(() => {
        expect(adapter.save).toHaveBeenCalledTimes(1);
      });

      const pendingEvent = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(pendingEvent);
      expect(pendingEvent.defaultPrevented).toBe(true);

      await act(async () => resolveSave());

      await waitFor(() => {
        const settledEvent = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(settledEvent);
        expect(settledEvent.defaultPrevented).toBe(false);
      });
    });
  });

  describe("migrationAdapter", () => {
    it("should migrate legacy data, persist it, then clear legacy store", async () => {
      const callOrder: string[] = [];
      const adapter = createAdapter([createLibraryItem("db1")]);
      const migrationAdapter = createMigrationAdapter([
        createLibraryItem("legacy1"),
      ]);
      adapter.save.mockImplementation(async (data) => {
        callOrder.push("save");
        expect(ids(data.libraryItems)).toEqual(["legacy1", "db1"]);
      });
      migrationAdapter.clear.mockImplementation(async () => {
        callOrder.push("clear");
      });

      await renderHost({ adapter, migrationAdapter });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["legacy1", "db1"]);
      });
      expect(migrationAdapter.load).toHaveBeenCalledTimes(1);
      expect(adapter.save).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(["save", "clear"]);
    });

    it("should skip save & clear when there's no legacy data", async () => {
      const adapter = createAdapter([createLibraryItem("db1")]);
      const migrationAdapter = createMigrationAdapter(null);

      await renderHost({ adapter, migrationAdapter });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["db1"]);
      });
      expect(migrationAdapter.load).toHaveBeenCalledTimes(1);
      expect(adapter.save).not.toHaveBeenCalled();
      expect(migrationAdapter.clear).not.toHaveBeenCalled();
    });

    it("should not clear legacy store if saving migrated data fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const adapter = createAdapter([createLibraryItem("db1")]);
      const migrationAdapter = createMigrationAdapter([
        createLibraryItem("legacy1"),
      ]);
      adapter.save.mockRejectedValue(new Error("save failed"));

      await renderHost({ adapter, migrationAdapter });

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "couldn't migrate legacy library data: save failed",
        );
      });
      expect(migrationAdapter.clear).not.toHaveBeenCalled();
      // falls back to the restored legacy data
      await waitFor(async () => {
        expect(await getLibraryItemIds()).toContain("legacy1");
      });
    });

    it("should still load migrated data if clearing legacy store fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const adapter = createAdapter([]);
      const migrationAdapter = createMigrationAdapter([
        createLibraryItem("legacy1"),
      ]);
      migrationAdapter.clear.mockRejectedValue(new Error("clear failed"));

      await renderHost({ adapter, migrationAdapter });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["legacy1"]);
      });
      expect(ids(adapter.getStored())).toEqual(["legacy1"]);
      expect(consoleError).toHaveBeenCalledWith(
        "couldn't delete legacy library data: clear failed",
      );
    });

    it("should fall back to adapter data if legacy load fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const adapter = createAdapter([createLibraryItem("db1")]);
      const migrationAdapter = createMigrationAdapter(null);
      migrationAdapter.load.mockRejectedValue(new Error("load failed"));

      await renderHost({ adapter, migrationAdapter });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["db1"]);
      });
      expect(consoleError).toHaveBeenCalledWith(
        "error during library migration: load failed",
      );
      expect(adapter.save).not.toHaveBeenCalled();
      expect(migrationAdapter.clear).not.toHaveBeenCalled();
    });
  });

  describe("install from URL", () => {
    it("should install library from #addLibrary on mount, persist it and strip the hash", async () => {
      const fetchSpy = mockFetchLibrary([createLibraryItem("remote1")]);
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const adapter = createAdapter([createLibraryItem("db1")]);
      window.history.replaceState(
        {},
        "",
        `/#addLibrary=${encodeURIComponent(LIBRARY_URL)}&token=abc`,
      );

      await renderHost({ adapter });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(
          expect.arrayContaining(["remote1", "db1"]),
        );
      });
      expect(fetchSpy).toHaveBeenCalledWith(LIBRARY_URL);
      expect(confirmSpy).toHaveBeenCalled();
      expect(window.location.hash).not.toContain("addLibrary");
      expect(window.location.hash).toContain("token=abc");
      await waitFor(() => {
        expect(ids(adapter.getStored())).toEqual(
          expect.arrayContaining(["remote1", "db1"]),
        );
      });
      expect(h.state.openSidebar?.tab).toBe("library");
    });

    it("should install library from legacy ?addLibrary query param and strip it", async () => {
      mockFetchLibrary([createLibraryItem("remote1")]);
      vi.spyOn(window, "confirm").mockReturnValue(true);
      window.history.replaceState(
        {},
        "",
        `/?addLibrary=${encodeURIComponent(LIBRARY_URL)}`,
      );

      await renderHost({ adapter: createAdapter() });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["remote1"]);
      });
      expect(window.location.search).not.toContain("addLibrary");
    });

    it("should install library on hashchange and restore the previous URL", async () => {
      const fetchSpy = mockFetchLibrary([createLibraryItem("remote1")]);
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const adapter = createAdapter([]);

      await renderHost({ adapter });
      await waitFor(() => {
        expect(adapter.load).toHaveBeenCalled();
      });

      const oldURL = `${window.location.origin}/#room=xyz`;
      window.history.replaceState(
        {},
        "",
        `/#addLibrary=${encodeURIComponent(LIBRARY_URL)}`,
      );
      window.dispatchEvent(
        new HashChangeEvent("hashchange", {
          oldURL,
          newURL: window.location.href,
        }),
      );

      expect(window.location.href).toBe(oldURL);
      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["remote1"]);
      });
      expect(fetchSpy).toHaveBeenCalledWith(LIBRARY_URL);
      await waitFor(() => {
        expect(ids(adapter.getStored())).toEqual(["remote1"]);
      });
    });

    it("should not install library if user declines the prompt", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      mockFetchLibrary([createLibraryItem("remote1")]);
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      const adapter = createAdapter([createLibraryItem("db1")]);
      window.history.replaceState(
        {},
        "",
        `/#addLibrary=${encodeURIComponent(LIBRARY_URL)}`,
      );

      await renderHost({ adapter });

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(window.location.hash).not.toContain("addLibrary");
      });
      expect(await getLibraryItemIds()).toEqual(["db1"]);
      expect(adapter.save).not.toHaveBeenCalled();
    });

    it("should reject disallowed library URLs without fetching", async () => {
      const fetchSpy = mockFetchLibrary([createLibraryItem("remote1")]);
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const adapter = createAdapter([createLibraryItem("db1")]);
      // importLibraryFromURL() rethrows after showing the error toast and the
      // hook doesn't await it, so swallow the resulting unhandled rejection
      const vitestListeners = process.listeners("unhandledRejection");
      process.removeAllListeners("unhandledRejection");
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);
      const disallowedURL = "https://evil.example.com/lib.excalidrawlib";
      window.history.replaceState(
        {},
        "",
        `/#addLibrary=${encodeURIComponent(disallowedURL)}`,
      );

      await renderHost({ adapter });

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(
          `Invalid or disallowed library URL: "${disallowedURL}"`,
        );
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(window.location.hash).not.toContain("addLibrary");
      expect(await getLibraryItemIds()).toEqual(["db1"]);
      expect(adapter.save).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(unhandled).toHaveBeenCalledWith(
          expect.objectContaining({
            message: `Invalid or disallowed library URL: "${disallowedURL}"`,
          }),
          expect.anything(),
        );
      });
      process.removeAllListeners("unhandledRejection");
      vitestListeners.forEach((listener) =>
        process.on("unhandledRejection", listener),
      );
    });

    it("should honor a custom validateLibraryUrl", async () => {
      const fetchSpy = mockFetchLibrary([createLibraryItem("remote1")]);
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const customURL = "https://my-libraries.example.com/lib.excalidrawlib";
      const validateLibraryUrl = vi.fn(() => true);
      window.history.replaceState(
        {},
        "",
        `/#addLibrary=${encodeURIComponent(customURL)}`,
      );

      await renderHost({ adapter: createAdapter(), validateLibraryUrl });

      await waitFor(async () => {
        expect(await getLibraryItemIds()).toEqual(["remote1"]);
      });
      expect(validateLibraryUrl).toHaveBeenCalledWith(customURL);
      expect(fetchSpy).toHaveBeenCalledWith(customURL);
    });
  });

  it("should remove window listeners on unmount", async () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    await renderHost({ adapter: createAdapter() });
    unmountComponent();

    const removed = removeEventListener.mock.calls.map(([type]) => type);
    expect(removed).toContain("hashchange");
    expect(removed).toContain("beforeunload");
  });
});
