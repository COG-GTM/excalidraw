import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { vi } from "vitest";

import type { FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { appJotaiStore } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "../data/LocalData";
import { FileStatusStore } from "../data/fileStatusStore";

const idb = vi.hoisted(() => {
  const stores = new Map<string, Map<string, any>>();
  const getStore = (store: string) => {
    if (!stores.has(store)) {
      stores.set(store, new Map());
    }
    return stores.get(store)!;
  };
  return { stores, getStore };
});

vi.mock("idb-keyval", () => ({
  createStore: vi.fn((dbName: string, storeName: string) => {
    const key = `${dbName}/${storeName}`;
    idb.getStore(key);
    return key;
  }),
  get: vi.fn(async (key: string, store: string) =>
    idb.getStore(store).get(key),
  ),
  getMany: vi.fn(async (keys: string[], store: string) =>
    keys.map((key) => idb.getStore(store).get(key)),
  ),
  set: vi.fn(async (key: string, value: any, store: string) => {
    idb.getStore(store).set(key, value);
  }),
  setMany: vi.fn(async (pairs: [string, any][], store: string) => {
    for (const [key, value] of pairs) {
      idb.getStore(store).set(key, value);
    }
  }),
  del: vi.fn(async (key: string, store: string) => {
    idb.getStore(store).delete(key);
  }),
  entries: vi.fn(async (store: string) => [...idb.getStore(store).entries()]),
}));

const { set: idbSet } = await import("idb-keyval");

const FILES_STORE = "files-db/files-store";
const LIBRARY_STORE = `${STORAGE_KEYS.IDB_LIBRARY}-db/${STORAGE_KEYS.IDB_LIBRARY}-store`;
const DAY_MS = 24 * 3600 * 1000;

const filesStore = () => idb.getStore(FILES_STORE);

const createAppState = (overrides: Partial<AppState> = {}): AppState =>
  ({
    ...getDefaultAppState(),
    width: 1000,
    height: 1000,
    offsetLeft: 0,
    offsetTop: 0,
    ...overrides,
  } as AppState);

let fileIdCounter = 0;
/** FileManager tracks saved/fetched ids on a singleton, so ids must be unique
 * across tests */
const uniqueFileId = (prefix: string) =>
  `${prefix}-${++fileIdCounter}` as FileId;

const createFileData = (
  id: FileId,
  overrides: Partial<BinaryFileData> = {},
): BinaryFileData => ({
  id,
  mimeType: "image/png",
  dataURL: "data:image/png;base64,AAAA" as BinaryFileData["dataURL"],
  created: Date.now(),
  ...overrides,
});

const readLocalStorageJSON = (key: string) =>
  JSON.parse(localStorage.getItem(key) as string);

describe("LocalData", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const store of idb.stores.values()) {
      store.clear();
    }
    appJotaiStore.set(localStorageQuotaExceededAtom, false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    LocalData.resumeSave("collaboration");
    LocalData.flushSave();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("save()", () => {
    it("persists only non-deleted elements and the cleared appState", async () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const deleted = API.createElement({
        type: "ellipse",
        id: "deleted",
        isDeleted: true,
      });
      const onFilesSaved = vi.fn();

      LocalData.save(
        [rect, deleted],
        createAppState({ viewBackgroundColor: "#ff0000" }),
        {},
        onFilesSaved,
      );

      // debounced: nothing written until flushed
      expect(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
      ).toBeNull();

      LocalData.flushSave();

      const savedElements = readLocalStorageJSON(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      );
      expect(savedElements.map((el: { id: string }) => el.id)).toEqual([
        "rect",
      ]);

      const savedAppState = readLocalStorageJSON(
        STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      );
      expect(savedAppState.viewBackgroundColor).toBe("#ff0000");
      // non-browser-persisted keys are stripped
      expect(savedAppState).not.toHaveProperty("width");
      expect(savedAppState).not.toHaveProperty("collaborators");

      expect(
        Number(readLocalStorageJSON(STORAGE_KEYS.VERSION_DATA_STATE)),
      ).toBeGreaterThan(0);

      await vi.waitFor(() => expect(onFilesSaved).toHaveBeenCalledTimes(1));
    });

    it("debounces consecutive saves, persisting only the latest", () => {
      const first = API.createElement({ type: "rectangle", id: "first" });
      const second = API.createElement({ type: "rectangle", id: "second" });

      LocalData.save([first], createAppState(), {}, () => {});
      LocalData.save([second], createAppState(), {}, () => {});
      LocalData.flushSave();

      const savedElements = readLocalStorageJSON(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      );
      expect(savedElements.map((el: { id: string }) => el.id)).toEqual([
        "second",
      ]);
    });

    it("does not persist an open canvas-search sidebar", () => {
      LocalData.save(
        [],
        createAppState({
          openSidebar: { name: DEFAULT_SIDEBAR.name, tab: CANVAS_SEARCH_TAB },
        }),
        {},
        () => {},
      );
      LocalData.flushSave();

      expect(
        readLocalStorageJSON(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE).openSidebar,
      ).toBeNull();
    });

    it("persists other open sidebar tabs", () => {
      const openSidebar = { name: DEFAULT_SIDEBAR.name, tab: "library" };
      LocalData.save([], createAppState({ openSidebar }), {}, () => {});
      LocalData.flushSave();

      expect(
        readLocalStorageJSON(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE).openSidebar,
      ).toEqual(openSidebar);
    });

    it("saves image files of the scene to IndexedDB", async () => {
      const fileId = uniqueFileId("scene-image");
      const image = API.createElement({ type: "image", fileId });
      const fileData = createFileData(fileId);
      const onFilesSaved = vi.fn();

      LocalData.save(
        [image],
        createAppState(),
        { [fileId]: fileData },
        onFilesSaved,
      );
      LocalData.flushSave();

      await vi.waitFor(() => expect(onFilesSaved).toHaveBeenCalledTimes(1));
      expect(filesStore().get(fileId)).toEqual(fileData);
    });

    it("sets the quota-exceeded flag on QuotaExceededError and resets it on next successful save", () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      const setItemSpy = vi
        .spyOn(localStorage, "setItem")
        .mockImplementation((key: string, value: string) => {
          if (key === STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS) {
            throw new DOMException("quota exceeded", "QuotaExceededError");
          }
          originalSetItem(key, value);
        });

      LocalData.save([], createAppState(), {}, () => {});
      LocalData.flushSave();

      expect(appJotaiStore.get(localStorageQuotaExceededAtom)).toBe(true);
      expect(console.error).toHaveBeenCalled();
      // appState write is skipped once elements write fails
      expect(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE),
      ).toBeNull();

      setItemSpy.mockRestore();

      LocalData.save([], createAppState(), {}, () => {});
      LocalData.flushSave();

      expect(appJotaiStore.get(localStorageQuotaExceededAtom)).toBe(false);
      expect(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE),
      ).not.toBeNull();
    });

    it("does not set the quota-exceeded flag for other storage errors", () => {
      vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });

      LocalData.save([], createAppState(), {}, () => {});
      LocalData.flushSave();

      expect(appJotaiStore.get(localStorageQuotaExceededAtom)).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("save pausing", () => {
    it("pauseSave() prevents saving until resumeSave()", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });

      LocalData.pauseSave("collaboration");
      expect(LocalData.isSavePaused()).toBe(true);

      LocalData.save([rect], createAppState(), {}, () => {});
      LocalData.flushSave();
      expect(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
      ).toBeNull();

      LocalData.resumeSave("collaboration");
      expect(LocalData.isSavePaused()).toBe(false);

      // saves dropped while paused are not replayed on resume
      LocalData.flushSave();
      expect(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
      ).toBeNull();

      LocalData.save([rect], createAppState(), {}, () => {});
      LocalData.flushSave();
      expect(
        readLocalStorageJSON(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
      ).toHaveLength(1);
    });

    it("does not save while the document is hidden", () => {
      const hiddenSpy = vi
        .spyOn(document, "hidden", "get")
        .mockReturnValue(true);
      const rect = API.createElement({ type: "rectangle", id: "rect" });

      expect(LocalData.isSavePaused()).toBe(true);
      LocalData.save([rect], createAppState(), {}, () => {});
      LocalData.flushSave();
      expect(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
      ).toBeNull();

      hiddenSpy.mockReturnValue(false);
      expect(LocalData.isSavePaused()).toBe(false);
    });
  });

  describe("fileStorage", () => {
    describe("clearObsoleteFiles()", () => {
      it("deletes only files unused on canvas and not retrieved within 24h", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const now = new Date("2026-01-10T12:00:00Z").getTime();
        vi.setSystemTime(now);

        const staleUnused = uniqueFileId("stale-unused");
        const staleOnCanvas = uniqueFileId("stale-on-canvas");
        const freshUnused = uniqueFileId("fresh-unused");
        const neverRetrievedUnused = uniqueFileId("never-retrieved-unused");
        const neverRetrievedOnCanvas = uniqueFileId(
          "never-retrieved-on-canvas",
        );

        filesStore().set(
          staleUnused,
          createFileData(staleUnused, { lastRetrieved: now - DAY_MS - 1 }),
        );
        filesStore().set(
          staleOnCanvas,
          createFileData(staleOnCanvas, { lastRetrieved: now - 2 * DAY_MS }),
        );
        filesStore().set(
          freshUnused,
          createFileData(freshUnused, { lastRetrieved: now - DAY_MS + 1000 }),
        );
        filesStore().set(
          neverRetrievedUnused,
          createFileData(neverRetrievedUnused),
        );
        filesStore().set(
          neverRetrievedOnCanvas,
          createFileData(neverRetrievedOnCanvas),
        );

        await LocalData.fileStorage.clearObsoleteFiles({
          currentFileIds: [staleOnCanvas, neverRetrievedOnCanvas],
        });

        await vi.waitFor(() =>
          expect([...filesStore().keys()].sort()).toEqual(
            [staleOnCanvas, freshUnused, neverRetrievedOnCanvas].sort(),
          ),
        );
      });
    });

    describe("getFiles()", () => {
      it("returns loaded and errored files and refreshes lastRetrieved", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const now = new Date("2026-01-10T12:00:00Z").getTime();
        vi.setSystemTime(now);

        const existingId = uniqueFileId("existing");
        const missingId = uniqueFileId("missing");
        const stored = createFileData(existingId, {
          lastRetrieved: now - 5 * DAY_MS,
        });
        filesStore().set(existingId, stored);

        const { loadedFiles, erroredFiles } =
          await LocalData.fileStorage.getFiles([existingId, missingId]);

        expect(loadedFiles).toEqual([{ ...stored, lastRetrieved: now }]);
        expect([...erroredFiles.keys()]).toEqual([missingId]);

        await vi.waitFor(() =>
          expect(filesStore().get(existingId).lastRetrieved).toBe(now),
        );
        expect(filesStore().has(missingId)).toBe(false);

        const statuses = FileStatusStore.getSnapshot().value;
        expect(statuses.get(existingId)).toBe("loaded");
        expect(statuses.get(missingId)).toBe("error");
      });
    });

    describe("saveFiles()", () => {
      it("saves only image files referenced by elements and reports errors", async () => {
        const okId = uniqueFileId("ok");
        const failingId = uniqueFileId("failing");
        const unreferencedId = uniqueFileId("unreferenced");
        const files: BinaryFiles = {
          [okId]: createFileData(okId),
          [failingId]: createFileData(failingId),
          [unreferencedId]: createFileData(unreferencedId),
        };

        vi.mocked(idbSet).mockImplementation(async (key, value, store) => {
          if (key === failingId) {
            throw new Error("IDB write failed");
          }
          idb.getStore(store as unknown as string).set(key as string, value);
        });

        const { savedFiles, erroredFiles } =
          await LocalData.fileStorage.saveFiles({
            elements: [
              API.createElement({ type: "image", fileId: okId }),
              API.createElement({ type: "image", fileId: failingId }),
              API.createElement({ type: "rectangle" }),
            ],
            files,
          });

        expect([...savedFiles.keys()]).toEqual([okId]);
        expect([...erroredFiles.keys()]).toEqual([failingId]);
        expect(filesStore().get(okId)).toEqual(files[okId]);
        expect(filesStore().has(failingId)).toBe(false);
        expect(filesStore().has(unreferencedId)).toBe(false);
        expect(
          Number(readLocalStorageJSON(STORAGE_KEYS.VERSION_FILES)),
        ).toBeGreaterThan(0);
        expect(LocalData.fileStorage.isFileTracked(failingId)).toBe(true);
      });

      it("does not re-save files already saved at the same version", async () => {
        const fileId = uniqueFileId("resave");
        const files: BinaryFiles = { [fileId]: createFileData(fileId) };
        const elements = [API.createElement({ type: "image", fileId })];

        await LocalData.fileStorage.saveFiles({ elements, files });
        vi.mocked(idbSet).mockClear();

        const { savedFiles } = await LocalData.fileStorage.saveFiles({
          elements,
          files,
        });
        expect(savedFiles.size).toBe(0);
        expect(idbSet).not.toHaveBeenCalled();
      });
    });
  });
});

describe("LibraryIndexedDBAdapter", () => {
  beforeEach(() => {
    idb.getStore(LIBRARY_STORE).clear();
  });

  it("returns null when no library data is stored", async () => {
    expect(await LibraryIndexedDBAdapter.load()).toBeNull();
  });

  it("round-trips saved library data", async () => {
    const data = {
      libraryItems: [
        {
          id: "item-1",
          status: "unpublished" as const,
          elements: [API.createElement({ type: "rectangle" })],
          created: 1,
        },
      ],
    };

    await LibraryIndexedDBAdapter.save(data);

    expect(idb.getStore(LIBRARY_STORE).get("libraryData")).toEqual(data);
    expect(await LibraryIndexedDBAdapter.load()).toEqual(data);
  });
});

describe("LibraryLocalStorageMigrationAdapter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when the legacy key is absent", () => {
    expect(LibraryLocalStorageMigrationAdapter.load()).toBeNull();
  });

  it("returns null when the legacy value is JSON null", () => {
    localStorage.setItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY, "null");
    expect(LibraryLocalStorageMigrationAdapter.load()).toBeNull();
  });

  it("loads legacy library items and clears them", () => {
    const libraryItems = [
      {
        id: "legacy",
        status: "published",
        elements: [],
        created: 1,
      },
    ];
    localStorage.setItem(
      STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY,
      JSON.stringify(libraryItems),
    );

    expect(LibraryLocalStorageMigrationAdapter.load()).toEqual({
      libraryItems,
    });

    LibraryLocalStorageMigrationAdapter.clear();
    expect(
      localStorage.getItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY),
    ).toBeNull();
    expect(LibraryLocalStorageMigrationAdapter.load()).toBeNull();
  });
});
