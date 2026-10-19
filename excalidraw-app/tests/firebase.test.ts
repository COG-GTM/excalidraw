import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { compressData } from "@excalidraw/excalidraw/data/encode";
import {
  decryptData,
  encryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { vi } from "vitest";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  isSavedToFirebase,
  loadFilesFromFirebase,
  loadFromFirebase,
  saveFilesToFirebase,
  saveToFirebase,
} from "../data/firebase";
import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import type { Socket } from "socket.io-client";

import type { SyncableExcalidrawElement } from "../data";
import type Portal from "../collab/Portal";

vi.hoisted(() => {
  vi.stubEnv(
    "VITE_APP_FIREBASE_CONFIG",
    JSON.stringify({ storageBucket: "test-bucket" }),
  );
});

const firestoreMock = vi.hoisted(() => {
  type Doc = { path: string };
  const store = new Map<string, any>();
  const transaction = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  };
  const makeSnapshot = (path: string) => ({
    exists: () => store.has(path),
    data: () => store.get(path),
  });
  transaction.get.mockImplementation(async (ref: Doc) =>
    makeSnapshot(ref.path),
  );
  transaction.set.mockImplementation((ref: Doc, data: any) => {
    store.set(ref.path, data);
  });
  transaction.update.mockImplementation((ref: Doc, data: any) => {
    store.set(ref.path, { ...store.get(ref.path), ...data });
  });

  class Bytes {
    private constructor(private readonly bytes: Uint8Array) {}
    static fromUint8Array(bytes: Uint8Array) {
      return new Bytes(new Uint8Array(bytes));
    }
    toUint8Array() {
      return new Uint8Array(this.bytes);
    }
  }

  return {
    store,
    transaction,
    Bytes,
    getDoc: vi.fn(async (ref: Doc) => makeSnapshot(ref.path)),
    runTransaction: vi.fn(
      async (_firestore: unknown, fn: (tx: typeof transaction) => unknown) =>
        fn(transaction),
    ),
  };
});

const storageMock = vi.hoisted(() => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_firestore: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: firestoreMock.getDoc,
  runTransaction: firestoreMock.runTransaction,
  Bytes: firestoreMock.Bytes,
}));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => ({})),
  ref: storageMock.ref,
  uploadBytes: storageMock.uploadBytes,
}));

const appState = getDefaultAppState() as AppState;

const createSocket = () => ({ id: Math.random().toString() } as any as Socket);

const createPortal = (overrides: Partial<Portal> = {}) =>
  ({
    socket: createSocket(),
    roomId: "room-id",
    roomKey: null,
    ...overrides,
  } as Portal);

// `API.createElement` ignores version-related props, so apply them afterwards
const createElement = ({
  version,
  versionNonce,
  updated,
  ...rest
}: Parameters<typeof API.createElement>[0] & {
  version?: number;
  versionNonce?: number;
  updated?: number;
}): ExcalidrawElement => {
  const element = API.createElement(rest);
  return {
    ...element,
    version: version ?? element.version,
    versionNonce: versionNonce ?? element.versionNonce,
    updated: updated ?? element.updated,
  };
};

const createElements = (
  ...elements: ExcalidrawElement[]
): SyncableExcalidrawElement[] =>
  // assign indices directly; `syncInvalidIndices` would bump element versions
  elements.map((element, i) => ({
    ...element,
    index: `a${i}`,
  })) as SyncableExcalidrawElement[];

const storeScene = async (
  roomId: string,
  roomKey: string,
  elements: readonly ExcalidrawElement[],
  sceneVersion = 1,
) => {
  const { encryptedBuffer, iv } = await encryptData(
    roomKey,
    new TextEncoder().encode(JSON.stringify(elements)),
  );
  firestoreMock.store.set(`scenes/${roomId}`, {
    sceneVersion,
    ciphertext: firestoreMock.Bytes.fromUint8Array(
      new Uint8Array(encryptedBuffer),
    ),
    iv: firestoreMock.Bytes.fromUint8Array(iv),
  });
};

const decryptStoredScene = async (roomId: string, roomKey: string) => {
  const stored = firestoreMock.store.get(`scenes/${roomId}`);
  const decrypted = await decryptData(
    stored.iv.toUint8Array(),
    stored.ciphertext.toUint8Array(),
    roomKey,
  );
  return {
    sceneVersion: stored.sceneVersion as number,
    elements: JSON.parse(
      new TextDecoder().decode(decrypted),
    ) as ExcalidrawElement[],
  };
};

describe("firebase", () => {
  let roomKey: string;

  beforeEach(async () => {
    firestoreMock.store.clear();
    vi.clearAllMocks();
    roomKey = await generateEncryptionKey();
  });

  describe("isSavedToFirebase", () => {
    it("treats the scene as saved when there's no active room", () => {
      const elements = createElements(createElement({ type: "rectangle" }));

      expect(
        isSavedToFirebase(createPortal({ socket: null, roomKey }), elements),
      ).toBe(true);
      expect(
        isSavedToFirebase(createPortal({ roomId: null, roomKey }), elements),
      ).toBe(true);
      expect(isSavedToFirebase(createPortal({ roomKey: null }), elements)).toBe(
        true,
      );
    });

    it("returns false for a room that was never saved or loaded", () => {
      const elements = createElements(createElement({ type: "rectangle" }));

      expect(isSavedToFirebase(createPortal({ roomKey }), elements)).toBe(
        false,
      );
    });
  });

  describe("saveToFirebase", () => {
    it("bails without touching firestore when there's no active room", async () => {
      const elements = createElements(createElement({ type: "rectangle" }));

      expect(
        await saveToFirebase(
          createPortal({ socket: null, roomKey }),
          elements,
          appState,
        ),
      ).toBe(null);
      expect(
        await saveToFirebase(
          createPortal({ roomId: null, roomKey }),
          elements,
          appState,
        ),
      ).toBe(null);
      expect(
        await saveToFirebase(
          createPortal({ roomKey: null }),
          elements,
          appState,
        ),
      ).toBe(null);
      expect(firestoreMock.runTransaction).not.toHaveBeenCalled();
    });

    it("creates a new encrypted scene document and marks the scene as saved", async () => {
      const portal = createPortal({ roomKey });
      const elements = createElements(
        createElement({ type: "rectangle", id: "A", version: 2 }),
        createElement({ type: "ellipse", id: "B", version: 3 }),
      );

      const result = await saveToFirebase(portal, elements, appState);

      expect(firestoreMock.transaction.set).toHaveBeenCalledTimes(1);
      expect(firestoreMock.transaction.update).not.toHaveBeenCalled();
      expect(firestoreMock.transaction.set.mock.calls[0][0]).toEqual({
        path: "scenes/room-id",
      });

      const stored = await decryptStoredScene("room-id", roomKey);
      expect(stored.sceneVersion).toBe(5);
      expect(stored.elements.map((el) => [el.id, el.version])).toEqual([
        ["A", 2],
        ["B", 3],
      ]);

      expect(result?.map((el) => el.id)).toEqual(["A", "B"]);
      expect(isSavedToFirebase(portal, elements)).toBe(true);
    });

    it("skips saving when the scene version is unchanged since last save", async () => {
      const portal = createPortal({ roomKey });
      const elements = createElements(createElement({ type: "rectangle" }));

      await saveToFirebase(portal, elements, appState);
      expect(firestoreMock.runTransaction).toHaveBeenCalledTimes(1);

      expect(await saveToFirebase(portal, elements, appState)).toBe(null);
      expect(firestoreMock.runTransaction).toHaveBeenCalledTimes(1);
    });

    it("reports unsaved changes once the local scene version changes", async () => {
      const portal = createPortal({ roomKey });
      const rect = createElement({ type: "rectangle", id: "A" });
      const elements = createElements(rect);

      await saveToFirebase(portal, elements, appState);

      const updated = createElements({ ...rect, version: rect.version + 1 });
      expect(isSavedToFirebase(portal, updated)).toBe(false);
    });

    it("reconciles with the stored scene and keeps newer remote elements", async () => {
      const portal = createPortal({ roomKey });

      const remoteA = createElement({
        type: "rectangle",
        id: "A",
        version: 5,
        versionNonce: 1,
        strokeColor: "#ff0000",
      });
      const remoteOnly = createElement({
        type: "ellipse",
        id: "C",
        version: 1,
      });
      await storeScene(
        "room-id",
        roomKey,
        createElements(remoteA, remoteOnly),
        6,
      );

      const localA = createElement({
        type: "rectangle",
        id: "A",
        version: 2,
        versionNonce: 2,
        strokeColor: "#00ff00",
      });
      const localB = createElement({
        type: "diamond",
        id: "B",
        version: 3,
      });

      const result = await saveToFirebase(
        portal,
        createElements(localA, localB),
        appState,
      );

      expect(firestoreMock.transaction.set).not.toHaveBeenCalled();
      expect(firestoreMock.transaction.update).toHaveBeenCalledTimes(1);

      const stored = await decryptStoredScene("room-id", roomKey);
      const storedById = new Map(stored.elements.map((el) => [el.id, el]));
      expect([...storedById.keys()].sort()).toEqual(["A", "B", "C"]);
      expect(storedById.get("A")?.version).toBe(5);
      expect(storedById.get("A")?.strokeColor).toBe("#ff0000");
      // reconciliation may re-sync fractional indices (bumping versions), so
      // compare against the stored elements rather than hardcoded numbers
      expect(stored.sceneVersion).toBe(
        stored.elements.reduce((acc, el) => acc + el.version, 0),
      );

      const resultById = new Map(result!.map((el) => [el.id, el]));
      expect([...resultById.keys()].sort()).toEqual(["A", "B", "C"]);
      expect(resultById.get("A")?.strokeColor).toBe("#ff0000");

      expect(isSavedToFirebase(portal, result!)).toBe(true);
      expect(isSavedToFirebase(portal, createElements(localA, localB))).toBe(
        false,
      );
    });

    it("keeps newer local elements over older stored ones", async () => {
      const portal = createPortal({ roomKey });

      await storeScene(
        "room-id",
        roomKey,
        createElements(
          createElement({
            type: "rectangle",
            id: "A",
            version: 1,
            strokeColor: "#ff0000",
          }),
        ),
      );

      const result = await saveToFirebase(
        portal,
        createElements(
          createElement({
            type: "rectangle",
            id: "A",
            version: 4,
            strokeColor: "#00ff00",
          }),
        ),
        appState,
      );

      const stored = await decryptStoredScene("room-id", roomKey);
      expect(stored.elements).toHaveLength(1);
      expect(stored.elements[0].version).toBe(4);
      expect(stored.elements[0].strokeColor).toBe("#00ff00");
      expect(result?.[0].strokeColor).toBe("#00ff00");
    });

    it("propagates transaction failures without marking the scene saved", async () => {
      const portal = createPortal({ roomKey });
      const elements = createElements(createElement({ type: "rectangle" }));
      firestoreMock.runTransaction.mockRejectedValueOnce(
        new Error("transaction failed"),
      );

      await expect(saveToFirebase(portal, elements, appState)).rejects.toThrow(
        "transaction failed",
      );
      expect(isSavedToFirebase(portal, elements)).toBe(false);
    });
  });

  describe("loadFromFirebase", () => {
    it("returns null when the scene document doesn't exist", async () => {
      expect(await loadFromFirebase("missing", roomKey, createSocket())).toBe(
        null,
      );
      expect(firestoreMock.getDoc).toHaveBeenCalledWith({
        path: "scenes/missing",
      });
    });

    it("decrypts the stored scene and drops non-syncable elements", async () => {
      await storeScene(
        "room-id",
        roomKey,
        createElements(
          createElement({ type: "rectangle", id: "A", version: 2 }),
          createElement({
            type: "rectangle",
            id: "tiny",
            width: 0,
            height: 0,
          }),
          createElement({
            type: "ellipse",
            id: "deleted",
            isDeleted: true,
            updated: 0,
          }),
        ),
      );

      const elements = await loadFromFirebase("room-id", roomKey, null);

      expect(elements?.map((el) => el.id)).toEqual(["A"]);
      expect(elements?.[0].version).toBe(2);
    });

    it("populates the version cache only when a socket is passed", async () => {
      await storeScene(
        "room-id",
        roomKey,
        createElements(createElement({ type: "rectangle", id: "A" })),
      );

      const socketlessPortal = createPortal({ roomKey });
      const loadedWithoutSocket = await loadFromFirebase(
        "room-id",
        roomKey,
        null,
      );
      expect(isSavedToFirebase(socketlessPortal, loadedWithoutSocket!)).toBe(
        false,
      );

      const portal = createPortal({ roomKey });
      const loaded = await loadFromFirebase("room-id", roomKey, portal.socket);
      expect(isSavedToFirebase(portal, loaded!)).toBe(true);
    });

    it("rejects when decrypting with the wrong key", async () => {
      await storeScene(
        "room-id",
        roomKey,
        createElements(createElement({ type: "rectangle" })),
      );

      await expect(
        loadFromFirebase("room-id", await generateEncryptionKey(), null),
      ).rejects.toThrow();
    });
  });

  describe("saveFilesToFirebase", () => {
    it("uploads each file under the prefix and reports failures per file", async () => {
      storageMock.uploadBytes.mockImplementation(
        async (ref: { path: string }) => {
          if (ref.path.endsWith("/bad")) {
            throw new Error("upload failed");
          }
        },
      );

      const result = await saveFilesToFirebase({
        prefix: "/files/rooms/room-id",
        files: [
          { id: "good" as FileId, buffer: new Uint8Array([1]) },
          { id: "bad" as FileId, buffer: new Uint8Array([2]) },
        ],
      });

      expect(result).toEqual({ savedFiles: ["good"], erroredFiles: ["bad"] });
      expect(storageMock.uploadBytes).toHaveBeenCalledWith(
        { path: "/files/rooms/room-id/good" },
        new Uint8Array([1]),
        { cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}` },
      );
    });
  });

  describe("loadFilesFromFirebase", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("loads, decodes and dedupes files and reports failures per file", async () => {
      const dataURL = "data:image/png;base64,AAAA";
      const encoded = await compressData(new TextEncoder().encode(dataURL), {
        encryptionKey: roomKey,
        metadata: { mimeType: "image/png", created: 123 },
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes("%2Fok?")) {
          return {
            status: 200,
            arrayBuffer: async () => encoded.slice().buffer,
          };
        }
        if (url.includes("%2Fmissing?")) {
          return { status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
        }
        throw new Error("network error");
      });
      vi.stubGlobal("fetch", fetchMock);

      const { loadedFiles, erroredFiles } = await loadFilesFromFirebase(
        "/files/rooms/room-id",
        roomKey,
        ["ok", "ok", "missing", "broken"] as FileId[],
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/files%2Frooms%2Froom-id%2Fok?alt=media",
      );
      expect(loadedFiles).toEqual([
        {
          id: "ok",
          mimeType: "image/png",
          dataURL,
          created: 123,
          lastRetrieved: 123,
        },
      ]);
      expect([...erroredFiles.keys()].sort()).toEqual(["broken", "missing"]);
      expect(consoleError).toHaveBeenCalledTimes(1);

      consoleError.mockRestore();
    });

    it("marks files that fail to decrypt as errored", async () => {
      const encoded = await compressData(new TextEncoder().encode("data:"), {
        encryptionKey: await generateEncryptionKey(),
        metadata: { mimeType: "image/png" },
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          status: 200,
          arrayBuffer: async () => encoded.slice().buffer,
        })),
      );

      const { loadedFiles, erroredFiles } = await loadFilesFromFirebase(
        "files",
        roomKey,
        ["wrong-key"] as FileId[],
      );

      expect(loadedFiles).toEqual([]);
      expect([...erroredFiles.keys()]).toEqual(["wrong-key"]);

      consoleError.mockRestore();
    });
  });
});
