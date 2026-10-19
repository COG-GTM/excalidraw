import { compressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  generateEncryptionKey,
  getCryptoKey,
  IV_LENGTH_BYTES,
} from "@excalidraw/excalidraw/data/encryption";
import { t } from "@excalidraw/excalidraw/i18n";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";
import { vi } from "vitest";

import type { LocalPoint } from "@excalidraw/math";
import type {
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  BinaryFileData,
  BinaryFiles,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { DELETED_ELEMENT_TIMEOUT } from "../app_constants";
import {
  exportToBackend,
  getCollaborationLinkData,
  getSyncableElements,
  importFromBackend,
  isCollaborationLink,
  isSyncableElement,
} from "../data";
import { saveFilesToFirebase } from "../data/firebase";

vi.mock("../data/firebase", () => ({
  saveFilesToFirebase: vi.fn(async () => ({
    savedFiles: [],
    erroredFiles: [],
  })),
}));

const VALID_KEY = "sTdLvMC_M3V8_vGa3UVRDg";

const orderedElement = (
  opts: Parameters<typeof API.createElement>[0],
  updated?: number,
) =>
  ({
    ...API.createElement(opts),
    index: "a0",
    ...(updated !== undefined ? { updated } : {}),
  } as OrderedExcalidrawElement);

const fetchMock = vi.fn();

const okResponse = (buffer: Uint8Array) => ({
  ok: true,
  arrayBuffer: async () =>
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
});

const jsonResponse = (json: any) => ({
  ok: true,
  json: async () => json,
});

const scene = () => ({
  elements: [API.createElement({ type: "rectangle", id: "rect-1" })],
  appState: { viewBackgroundColor: "#abcdef" },
});

const encodeNewFormat = async (data: object, key: string) =>
  compressData(new TextEncoder().encode(JSON.stringify(data)), {
    encryptionKey: key,
  });

const concat = (a: Uint8Array, b: ArrayBuffer) => {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out;
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(saveFilesToFirebase).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isSyncableElement / getSyncableElements", () => {
  const NOW = new Date("2024-01-01T00:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("syncs non-deleted visible elements", () => {
    const rect = orderedElement({ type: "rectangle", width: 10 });
    expect(isSyncableElement(rect)).toBe(true);
  });

  it("does not sync invisibly small non-deleted elements", () => {
    const tiny = orderedElement({ type: "rectangle", width: 0, height: 0 });
    const singlePointLine = orderedElement({
      type: "line",
      points: [pointFrom<LocalPoint>(0, 0)],
    });
    expect(isSyncableElement(tiny)).toBe(false);
    expect(isSyncableElement(singlePointLine)).toBe(false);
  });

  it("syncs deleted elements updated within DELETED_ELEMENT_TIMEOUT", () => {
    const deleted = orderedElement(
      { type: "rectangle", isDeleted: true },
      NOW - DELETED_ELEMENT_TIMEOUT + 1000,
    );
    expect(isSyncableElement(deleted)).toBe(true);
  });

  it("syncs deleted elements even if invisibly small, within timeout", () => {
    const deleted = orderedElement(
      {
        type: "rectangle",
        width: 0,
        height: 0,
        isDeleted: true,
      },
      NOW - 1000,
    );
    expect(isSyncableElement(deleted)).toBe(true);
  });

  it("does not sync deleted elements older than DELETED_ELEMENT_TIMEOUT", () => {
    const expired = orderedElement(
      { type: "rectangle", isDeleted: true },
      NOW - DELETED_ELEMENT_TIMEOUT - 1000,
    );
    const atBoundary = orderedElement(
      { type: "rectangle", isDeleted: true },
      NOW - DELETED_ELEMENT_TIMEOUT,
    );
    expect(isSyncableElement(expired)).toBe(false);
    expect(isSyncableElement(atBoundary)).toBe(false);
  });

  it("getSyncableElements filters out non-syncable elements", () => {
    const visible = orderedElement({ type: "rectangle", id: "visible" });
    const tiny = orderedElement({
      type: "rectangle",
      id: "tiny",
      width: 0,
      height: 0,
    });
    const recentlyDeleted = orderedElement(
      {
        type: "rectangle",
        id: "recent",
        isDeleted: true,
      },
      NOW - 1000,
    );
    const expired = orderedElement(
      {
        type: "rectangle",
        id: "expired",
        isDeleted: true,
      },
      NOW - DELETED_ELEMENT_TIMEOUT - 1,
    );

    expect(
      getSyncableElements([visible, tiny, recentlyDeleted, expired]).map(
        (el) => el.id,
      ),
    ).toEqual(["visible", "recent"]);
  });
});

describe("collaboration links", () => {
  const base = "https://excalidraw.com/";

  it("isCollaborationLink detects #room=<id>,<key> hashes", () => {
    expect(isCollaborationLink(`${base}#room=abc123,${VALID_KEY}`)).toBe(true);
    expect(isCollaborationLink(`${base}#json=abc123,${VALID_KEY}`)).toBe(false);
    expect(isCollaborationLink(`${base}#room=abc123`)).toBe(false);
    expect(isCollaborationLink(`${base}#room=abc$123,${VALID_KEY}`)).toBe(
      false,
    );
    expect(isCollaborationLink(base)).toBe(false);
  });

  it("getCollaborationLinkData returns roomId and roomKey for valid links", () => {
    expect(
      getCollaborationLinkData(`${base}#room=abc_123-x,${VALID_KEY}`),
    ).toEqual({ roomId: "abc_123-x", roomKey: VALID_KEY });
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("getCollaborationLinkData alerts and returns null for wrong key length", () => {
    expect(getCollaborationLinkData(`${base}#room=abc123,shortkey`)).toBe(null);
    expect(getCollaborationLinkData(`${base}#room=abc123,${VALID_KEY}X`)).toBe(
      null,
    );
    expect(window.alert).toHaveBeenCalledTimes(2);
    expect(window.alert).toHaveBeenCalledWith(t("alerts.invalidEncryptionKey"));
  });

  it("getCollaborationLinkData returns null for malformed hashes without alerting", () => {
    expect(getCollaborationLinkData(`${base}#room=abc123`)).toBe(null);
    expect(getCollaborationLinkData(`${base}#json=abc,${VALID_KEY}`)).toBe(
      null,
    );
    expect(getCollaborationLinkData(base)).toBe(null);
    expect(window.alert).not.toHaveBeenCalled();
  });
});

describe("importFromBackend", () => {
  it("alerts and returns {} when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false });

    const key = await generateEncryptionKey();
    await expect(importFromBackend("scene-id", key)).resolves.toEqual({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/scene-id$/);
    expect(window.alert).toHaveBeenCalledWith(t("alerts.importBackendFailed"));
  });

  it("alerts and returns {} when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const key = await generateEncryptionKey();
    await expect(importFromBackend("scene-id", key)).resolves.toEqual({});
    expect(window.alert).toHaveBeenCalledWith(t("alerts.importBackendFailed"));
  });

  it("decodes payloads in the current compressed format", async () => {
    const key = await generateEncryptionKey();
    const data = scene();
    fetchMock.mockResolvedValue(okResponse(await encodeNewFormat(data, key)));

    const result = await importFromBackend("scene-id", key);

    expect(result.elements).toEqual(JSON.parse(JSON.stringify(data.elements)));
    expect(result.appState).toEqual(data.appState);
    expect(console.warn).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("returns null elements/appState when missing from payload", async () => {
    const key = await generateEncryptionKey();
    fetchMock.mockResolvedValue(okResponse(await encodeNewFormat({}, key)));

    await expect(importFromBackend("scene-id", key)).resolves.toEqual({
      elements: null,
      appState: null,
    });
  });

  it("falls back to legacy IV-prefixed format", async () => {
    const key = await generateEncryptionKey();
    const data = scene();
    const { encryptedBuffer, iv } = await encryptData(
      key,
      JSON.stringify(data),
    );
    fetchMock.mockResolvedValue(okResponse(concat(iv, encryptedBuffer)));

    const result = await importFromBackend("scene-id", key);

    expect(console.warn).toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    expect(result.elements).toEqual(JSON.parse(JSON.stringify(data.elements)));
    expect(result.appState).toEqual(data.appState);
  });

  it("falls back to legacy fixed-IV format", async () => {
    const key = await generateEncryptionKey();
    const data = scene();
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: new Uint8Array(IV_LENGTH_BYTES) },
      await getCryptoKey(key, "encrypt"),
      new TextEncoder().encode(JSON.stringify(data)),
    );
    fetchMock.mockResolvedValue(okResponse(new Uint8Array(encrypted)));

    const result = await importFromBackend("scene-id", key);

    expect(window.alert).not.toHaveBeenCalled();
    expect(result.elements).toEqual(JSON.parse(JSON.stringify(data.elements)));
    expect(result.appState).toEqual(data.appState);
  });

  // NOTE: pins current behavior — the legacy fallback is returned without
  // `await`, so its rejection bypasses the outer catch (no alert, no `{}`).
  it("rejects when the payload can't be decrypted by either format", async () => {
    const key = await generateEncryptionKey();
    const wrongKey = await generateEncryptionKey();
    fetchMock.mockResolvedValue(
      okResponse(await encodeNewFormat(scene(), key)),
    );

    await expect(importFromBackend("scene-id", wrongKey)).rejects.toThrow();
    expect(console.warn).toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });
});

describe("exportToBackend", () => {
  const fileId = "file-1" as FileId;
  const files: BinaryFiles = {
    [fileId]: {
      id: fileId,
      mimeType: "image/png",
      dataURL: "data:image/png;base64,iVBORw0KGgo=" as DataURL,
      created: 1,
    } as BinaryFileData,
    ["unused-file" as FileId]: {
      id: "unused-file" as FileId,
      mimeType: "image/png",
      dataURL: "data:image/png;base64,AAAA" as DataURL,
      created: 1,
    } as BinaryFileData,
  };

  it("returns a #json=<id>,<key> url, uploads referenced files, and round-trips", async () => {
    const rect = API.createElement({ type: "rectangle", id: "rect-1" });
    const image = API.createElement({
      type: "image",
      id: "image-1",
      fileId,
      status: "saved",
    });
    fetchMock.mockResolvedValue(jsonResponse({ id: "share-123" }));

    const result = await exportToBackend(
      [rect, image],
      { viewBackgroundColor: "#123456" },
      files,
    );

    expect(result.errorMessage).toBe(null);
    const url = new URL(result.url!);
    const match = url.hash.match(/^#json=([^,]+),(.+)$/);
    expect(match).not.toBe(null);
    const [, id, key] = match!;
    expect(id).toBe("share-123");
    expect(key).toHaveLength(22);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");

    expect(saveFilesToFirebase).toHaveBeenCalledTimes(1);
    const { prefix, files: uploaded } =
      vi.mocked(saveFilesToFirebase).mock.calls[0][0];
    expect(prefix).toBe("/files/shareLinks/share-123");
    expect(uploaded.map((f) => f.id)).toEqual([fileId]);

    // the POSTed payload must be decodable with the key from the url
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse(new Uint8Array(init.body)));
    const imported = await importFromBackend(id, key);
    expect(imported.elements?.map((el) => el.id)).toEqual([
      "rect-1",
      "image-1",
    ]);
    expect(imported.appState?.viewBackgroundColor).toBe("#123456");
  });

  it("returns the too-big error message on RequestTooLargeError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error_class: "RequestTooLargeError" }),
    );

    await expect(exportToBackend(scene().elements, {}, {})).resolves.toEqual({
      url: null,
      errorMessage: t("alerts.couldNotCreateShareableLinkTooBig"),
    });
    expect(saveFilesToFirebase).not.toHaveBeenCalled();
  });

  it("returns the generic error message for other backend errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error_class: "SomeOtherError" }),
    );

    await expect(exportToBackend(scene().elements, {}, {})).resolves.toEqual({
      url: null,
      errorMessage: t("alerts.couldNotCreateShareableLink"),
    });
    expect(saveFilesToFirebase).not.toHaveBeenCalled();
  });

  it("returns the generic error message when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(exportToBackend(scene().elements, {}, {})).resolves.toEqual({
      url: null,
      errorMessage: t("alerts.couldNotCreateShareableLink"),
    });
    expect(console.error).toHaveBeenCalled();
    expect(saveFilesToFirebase).not.toHaveBeenCalled();
  });
});
