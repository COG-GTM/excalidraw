import { decompressData } from "@excalidraw/excalidraw/data/encode";
import { generateEncryptionKey } from "@excalidraw/excalidraw/data/encryption";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { vi } from "vitest";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
} from "@excalidraw/element/types";
import type {
  BinaryFileData,
  BinaryFileMetadata,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import {
  FileManager,
  encodeFilesForUpload,
  updateStaleImageStatuses,
} from "../data/FileManager";

const createFile = (
  id: string,
  overrides: Partial<BinaryFileData> = {},
): BinaryFileData => ({
  id: id as FileId,
  mimeType: "image/png",
  dataURL: `data:image/png;base64,${id}` as BinaryFileData["dataURL"],
  created: 1,
  ...overrides,
});

const createImage = (
  fileId: string,
  overrides: Pick<Partial<ExcalidrawImageElement>, "status" | "isDeleted"> = {},
) =>
  API.createElement({
    type: "image",
    fileId: fileId as FileId,
    status: "pending",
    ...overrides,
  }) as ExcalidrawImageElement;

const toFiles = (...files: BinaryFileData[]): BinaryFiles =>
  Object.fromEntries(files.map((file) => [file.id, file]));

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

type SaveFilesResult = {
  savedFiles: Map<FileId, BinaryFileData>;
  erroredFiles: Map<FileId, BinaryFileData>;
};

type GetFilesResult = {
  loadedFiles: BinaryFileData[];
  erroredFiles: Map<FileId, true>;
};

const createFileManager = () => {
  const getFiles = vi.fn(
    async (fileIds: FileId[]): Promise<GetFilesResult> => ({
      loadedFiles: [],
      erroredFiles: new Map(),
    }),
  );
  const saveFiles = vi.fn(
    async ({
      addedFiles,
    }: {
      addedFiles: Map<FileId, BinaryFileData>;
    }): Promise<SaveFilesResult> => ({
      savedFiles: new Map(addedFiles),
      erroredFiles: new Map(),
    }),
  );
  const onFileStatusChange = vi.fn();
  const fileManager = new FileManager({
    getFiles,
    saveFiles,
    onFileStatusChange,
  });
  return { fileManager, getFiles, saveFiles, onFileStatusChange };
};

const addedFileIds = (saveFiles: ReturnType<typeof vi.fn>, call: number) => [
  ...(
    saveFiles.mock.calls[call][0] as {
      addedFiles: Map<FileId, BinaryFileData>;
    }
  ).addedFiles.keys(),
];

describe("FileManager", () => {
  describe("saveFiles", () => {
    it("saves only files referenced by initialized image elements", async () => {
      const { fileManager, saveFiles } = createFileManager();
      const fileA = createFile("a");
      const fileB = createFile("b");
      const unreferenced = createFile("c");

      const result = await fileManager.saveFiles({
        elements: [
          createImage("a"),
          createImage("b"),
          // image without a file yet (not initialized)
          API.createElement({ type: "image" }),
          API.createElement({ type: "rectangle" }),
          // referenced file not present in `files`
          createImage("missing"),
        ],
        files: toFiles(fileA, fileB, unreferenced),
      });

      expect(saveFiles).toHaveBeenCalledTimes(1);
      expect(addedFileIds(saveFiles, 0)).toEqual(["a", "b"]);
      const { addedFiles } = saveFiles.mock.calls[0][0];
      expect(addedFiles.get("a" as FileId)).toBe(fileA);
      expect(addedFiles.get("b" as FileId)).toBe(fileB);
      expect([...result.savedFiles.keys()]).toEqual(["a", "b"]);
      expect(result.erroredFiles.size).toBe(0);

      expect(fileManager.isFileTracked("a" as FileId)).toBe(true);
      expect(fileManager.isFileTracked("b" as FileId)).toBe(true);
      expect(fileManager.isFileTracked("c" as FileId)).toBe(false);
      expect(fileManager.isFileSavedOrBeingSaved(fileA)).toBe(true);
      expect(fileManager.isFileSavedOrBeingSaved(unreferenced)).toBe(false);
    });

    it("skips files already saved at the same version and re-saves when version bumps", async () => {
      const { fileManager, saveFiles } = createFileManager();
      const elements = [createImage("a")];
      const fileV1 = createFile("a");

      await fileManager.saveFiles({ elements, files: toFiles(fileV1) });
      expect(addedFileIds(saveFiles, 0)).toEqual(["a"]);

      // same (implicit) version 1 → not re-uploaded
      await fileManager.saveFiles({ elements, files: toFiles(fileV1) });
      expect(addedFileIds(saveFiles, 1)).toEqual([]);

      // explicit version 1 equals the default version
      const explicitV1 = createFile("a", { version: 1 });
      expect(fileManager.getFileVersion(fileV1)).toBe(1);
      expect(fileManager.isFileSavedOrBeingSaved(explicitV1)).toBe(true);
      await fileManager.saveFiles({ elements, files: toFiles(explicitV1) });
      expect(addedFileIds(saveFiles, 2)).toEqual([]);

      // bumped version → re-uploaded
      const fileV2 = createFile("a", { version: 2 });
      expect(fileManager.isFileSavedOrBeingSaved(fileV2)).toBe(false);
      await fileManager.saveFiles({ elements, files: toFiles(fileV2) });
      expect(addedFileIds(saveFiles, 3)).toEqual(["a"]);
      expect(saveFiles.mock.calls[3][0].addedFiles.get("a" as FileId)).toBe(
        fileV2,
      );
      expect(fileManager.isFileSavedOrBeingSaved(fileV2)).toBe(true);
      expect(fileManager.isFileSavedOrBeingSaved(fileV1)).toBe(false);
    });

    it("does not re-add a file that is currently being saved", async () => {
      const { fileManager, saveFiles } = createFileManager();
      const deferred = createDeferred<SaveFilesResult>();
      saveFiles.mockImplementationOnce(() => deferred.promise);
      const file = createFile("a");
      const elements = [createImage("a")];

      const firstSave = fileManager.saveFiles({
        elements,
        files: toFiles(file),
      });
      expect(fileManager.isFileSavedOrBeingSaved(file)).toBe(true);

      await fileManager.saveFiles({ elements, files: toFiles(file) });
      expect(addedFileIds(saveFiles, 1)).toEqual([]);

      deferred.resolve({
        savedFiles: new Map([[file.id, file]]),
        erroredFiles: new Map(),
      });
      await firstSave;
      expect(fileManager.isFileSavedOrBeingSaved(file)).toBe(true);
    });

    it("tracks errored files and does not retry them at the same version", async () => {
      const { fileManager, saveFiles } = createFileManager();
      const file = createFile("a");
      const elements = [createImage("a")];
      saveFiles.mockImplementationOnce(async ({ addedFiles }) => ({
        savedFiles: new Map(),
        erroredFiles: new Map(addedFiles),
      }));

      const result = await fileManager.saveFiles({
        elements,
        files: toFiles(file),
      });

      expect([...result.erroredFiles.keys()]).toEqual(["a"]);
      expect(result.savedFiles.size).toBe(0);
      expect(fileManager.isFileTracked(file.id)).toBe(true);
      // errored files are neither saved nor being saved
      expect(fileManager.isFileSavedOrBeingSaved(file)).toBe(false);
      expect(fileManager.shouldUpdateImageElementStatus(elements[0])).toBe(
        false,
      );
      expect(fileManager.shouldPreventUnload(elements)).toBe(false);
    });

    it("clears saving state even when the underlying save rejects", async () => {
      const { fileManager, saveFiles } = createFileManager();
      const file = createFile("a");
      const elements = [createImage("a")];
      saveFiles.mockRejectedValueOnce(new Error("network down"));

      await expect(
        fileManager.saveFiles({ elements, files: toFiles(file) }),
      ).rejects.toThrow("network down");

      expect(fileManager.isFileTracked(file.id)).toBe(false);
      expect(fileManager.isFileSavedOrBeingSaved(file)).toBe(false);
      expect(fileManager.shouldPreventUnload(elements)).toBe(false);

      // subsequent save retries the file
      await fileManager.saveFiles({ elements, files: toFiles(file) });
      expect(addedFileIds(saveFiles, 1)).toEqual(["a"]);
      expect(fileManager.isFileSavedOrBeingSaved(file)).toBe(true);
    });
  });

  describe("shouldPreventUnload", () => {
    it("is true only while a non-deleted initialized image is being saved", async () => {
      const { fileManager, saveFiles } = createFileManager();
      const deferred = createDeferred<SaveFilesResult>();
      saveFiles.mockImplementationOnce(() => deferred.promise);
      const file = createFile("a");
      const image = createImage("a");
      const deletedImage = createImage("a", { isDeleted: true });
      const otherImage = createImage("b");
      const rectangle = API.createElement({ type: "rectangle" });

      expect(fileManager.shouldPreventUnload([image])).toBe(false);

      const savePromise = fileManager.saveFiles({
        elements: [image],
        files: toFiles(file),
      });

      expect(fileManager.shouldPreventUnload([image])).toBe(true);
      expect(fileManager.shouldPreventUnload([rectangle, image])).toBe(true);
      expect(fileManager.shouldPreventUnload([deletedImage])).toBe(false);
      expect(fileManager.shouldPreventUnload([otherImage, rectangle])).toBe(
        false,
      );
      expect(fileManager.shouldPreventUnload([])).toBe(false);

      deferred.resolve({
        savedFiles: new Map([[file.id, file]]),
        erroredFiles: new Map(),
      });
      await savePromise;

      expect(fileManager.shouldPreventUnload([image])).toBe(false);
    });
  });

  describe("shouldUpdateImageElementStatus", () => {
    it("is true only for pending images whose file has been saved", async () => {
      const { fileManager } = createFileManager();
      const pending = createImage("a", { status: "pending" });

      expect(fileManager.shouldUpdateImageElementStatus(pending)).toBe(false);

      await fileManager.saveFiles({
        elements: [pending],
        files: toFiles(createFile("a")),
      });

      expect(fileManager.shouldUpdateImageElementStatus(pending)).toBe(true);
      expect(
        fileManager.shouldUpdateImageElementStatus(
          createImage("a", { status: "saved" }),
        ),
      ).toBe(false);
      expect(
        fileManager.shouldUpdateImageElementStatus(
          createImage("a", { status: "error" }),
        ),
      ).toBe(false);
      expect(
        fileManager.shouldUpdateImageElementStatus(createImage("unsaved")),
      ).toBe(false);
      expect(
        fileManager.shouldUpdateImageElementStatus(
          API.createElement({ type: "rectangle" }),
        ),
      ).toBe(false);
    });

    it("is true for pending images whose file was loaded via getFiles", async () => {
      const { fileManager, getFiles } = createFileManager();
      getFiles.mockResolvedValueOnce({
        loadedFiles: [createFile("a")],
        erroredFiles: new Map(),
      });

      await fileManager.getFiles(["a" as FileId]);

      expect(fileManager.shouldUpdateImageElementStatus(createImage("a"))).toBe(
        true,
      );
    });
  });

  describe("getFiles", () => {
    it("short-circuits on empty ids", async () => {
      const { fileManager, getFiles, onFileStatusChange } = createFileManager();

      const result = await fileManager.getFiles([]);

      expect(result.loadedFiles).toEqual([]);
      expect(result.erroredFiles.size).toBe(0);
      expect(getFiles).not.toHaveBeenCalled();
      expect(onFileStatusChange).not.toHaveBeenCalled();
    });

    it("emits loading then loaded/error statuses and tracks results", async () => {
      const { fileManager, getFiles, onFileStatusChange } = createFileManager();
      const deferred = createDeferred<GetFilesResult>();
      getFiles.mockImplementationOnce(() => deferred.promise);
      const loaded = createFile("a", { version: 3 });
      const ids = ["a", "b"] as FileId[];

      const promise = fileManager.getFiles(ids);

      expect(getFiles).toHaveBeenCalledWith(ids);
      expect(onFileStatusChange).toHaveBeenCalledTimes(1);
      expect(onFileStatusChange).toHaveBeenLastCalledWith([
        ["a", "loading"],
        ["b", "loading"],
      ]);
      expect(fileManager.isFileTracked("a" as FileId)).toBe(true);
      expect(fileManager.isFileTracked("b" as FileId)).toBe(true);

      deferred.resolve({
        loadedFiles: [loaded],
        erroredFiles: new Map([["b" as FileId, true]]),
      });
      const result = await promise;

      expect(result.loadedFiles).toEqual([loaded]);
      expect([...result.erroredFiles.keys()]).toEqual(["b"]);
      expect(onFileStatusChange).toHaveBeenCalledTimes(2);
      expect(onFileStatusChange).toHaveBeenLastCalledWith([
        ["a", "loaded"],
        ["b", "error"],
      ]);

      // loaded file is recorded as saved at its version
      expect(fileManager.isFileSavedOrBeingSaved(loaded)).toBe(true);
      expect(fileManager.isFileSavedOrBeingSaved(createFile("a"))).toBe(false);
      // errored fetch is still tracked so it isn't re-fetched
      expect(fileManager.isFileTracked("b" as FileId)).toBe(true);
      expect(fileManager.isFileSavedOrBeingSaved(createFile("b"))).toBe(false);
    });

    it("clears fetching state when the underlying fetch rejects", async () => {
      const { fileManager, getFiles, onFileStatusChange } = createFileManager();
      getFiles.mockRejectedValueOnce(new Error("fetch failed"));

      await expect(fileManager.getFiles(["a" as FileId])).rejects.toThrow(
        "fetch failed",
      );

      expect(fileManager.isFileTracked("a" as FileId)).toBe(false);
      expect(onFileStatusChange).toHaveBeenCalledTimes(1);
      expect(onFileStatusChange).toHaveBeenCalledWith([["a", "loading"]]);
    });
  });

  describe("reset", () => {
    it("emits error status for in-flight fetches and clears all tracking", async () => {
      const { fileManager, getFiles, onFileStatusChange } = createFileManager();
      const deferred = createDeferred<GetFilesResult>();
      getFiles.mockImplementationOnce(() => deferred.promise);

      await fileManager.saveFiles({
        elements: [createImage("saved")],
        files: toFiles(createFile("saved")),
      });
      const fetchPromise = fileManager.getFiles(["x", "y"] as FileId[]);
      onFileStatusChange.mockClear();

      fileManager.reset();

      expect(onFileStatusChange).toHaveBeenCalledTimes(1);
      expect(onFileStatusChange).toHaveBeenCalledWith([
        ["x", "error"],
        ["y", "error"],
      ]);
      for (const id of ["saved", "x", "y"]) {
        expect(fileManager.isFileTracked(id as FileId)).toBe(false);
      }

      deferred.resolve({ loadedFiles: [], erroredFiles: new Map() });
      await fetchPromise;
    });

    it("does not emit status updates when nothing is being fetched", async () => {
      const { fileManager, onFileStatusChange } = createFileManager();
      await fileManager.saveFiles({
        elements: [createImage("a")],
        files: toFiles(createFile("a")),
      });

      fileManager.reset();

      expect(onFileStatusChange).not.toHaveBeenCalled();
      expect(fileManager.isFileTracked("a" as FileId)).toBe(false);
    });
  });
});

describe("encodeFilesForUpload", () => {
  it("returns encrypted, compressed buffers that round-trip with metadata", async () => {
    const encryptionKey = await generateEncryptionKey();
    const fileA = createFile("a", { mimeType: "image/png" });
    const fileB = createFile("b", { mimeType: "image/jpeg" });

    const before = Date.now();
    const processed = await encodeFilesForUpload({
      files: new Map([
        [fileA.id, fileA],
        [fileB.id, fileB],
      ]),
      maxBytes: 1024 * 1024,
      encryptionKey,
    });
    const after = Date.now();

    expect(processed.map(({ id }) => id)).toEqual(["a", "b"]);

    for (const [index, file] of [fileA, fileB].entries()) {
      const { metadata, data } = await decompressData<BinaryFileMetadata>(
        processed[index].buffer,
        { decryptionKey: encryptionKey },
      );
      expect(new TextDecoder().decode(data)).toBe(file.dataURL);
      expect(metadata.id).toBe(file.id);
      expect(metadata.mimeType).toBe(file.mimeType);
      expect(metadata.created).toBeGreaterThanOrEqual(before);
      expect(metadata.created).toBeLessThanOrEqual(after);
      expect(metadata.lastRetrieved).toBeGreaterThanOrEqual(before);
      expect(metadata.lastRetrieved).toBeLessThanOrEqual(after);
    }
  });

  it("allows a file whose dataURL is exactly maxBytes", async () => {
    const encryptionKey = await generateEncryptionKey();
    const file = createFile("a");
    const byteLength = new TextEncoder().encode(file.dataURL).byteLength;

    const processed = await encodeFilesForUpload({
      files: new Map([[file.id, file]]),
      maxBytes: byteLength,
      encryptionKey,
    });

    expect(processed).toHaveLength(1);
  });

  it("throws fileTooBig when a dataURL exceeds maxBytes", async () => {
    const encryptionKey = await generateEncryptionKey();
    const maxBytes = 2 * 1024 * 1024;
    const small = createFile("small");
    const big = createFile("big", {
      dataURL: `data:image/png;base64,${"A".repeat(
        maxBytes,
      )}` as BinaryFileData["dataURL"],
    });

    await expect(
      encodeFilesForUpload({
        files: new Map([
          [small.id, small],
          [big.id, big],
        ]),
        maxBytes,
        encryptionKey,
      }),
    ).rejects.toThrow("File is too big. Maximum allowed size is 2MB.");
  });
});

describe("updateStaleImageStatuses", () => {
  const createAPI = (sceneElements: readonly ExcalidrawElement[]) =>
    ({
      updateScene: vi.fn(),
      getSceneElementsIncludingDeleted: vi.fn(() => sceneElements),
    } as unknown as ExcalidrawImperativeAPI & {
      updateScene: ReturnType<typeof vi.fn>;
    });

  it("is a no-op when there are no errored files", () => {
    const excalidrawAPI = createAPI([createImage("a")]);

    updateStaleImageStatuses({
      excalidrawAPI,
      erroredFiles: new Map(),
      elements: [],
    });

    expect(excalidrawAPI.updateScene).not.toHaveBeenCalled();
  });

  it("marks only images with errored files as error", () => {
    const erroredImage = createImage("a");
    const deletedErroredImage = createImage("a", { isDeleted: true });
    const okImage = createImage("b");
    const rectangle = API.createElement({ type: "rectangle" });
    const sceneElements = [
      erroredImage,
      deletedErroredImage,
      okImage,
      rectangle,
    ];
    const excalidrawAPI = createAPI(sceneElements);

    updateStaleImageStatuses({
      excalidrawAPI,
      erroredFiles: new Map([["a" as FileId, true]]),
      elements: sceneElements,
    });

    expect(excalidrawAPI.updateScene).toHaveBeenCalledTimes(1);
    const [{ elements, captureUpdate }] =
      excalidrawAPI.updateScene.mock.calls[0];
    expect(captureUpdate).toBe(CaptureUpdateAction.NEVER);
    expect(elements).toHaveLength(4);

    expect(elements[0].id).toBe(erroredImage.id);
    expect(elements[0].status).toBe("error");
    expect(elements[0].version).toBeGreaterThan(erroredImage.version);
    expect(elements[1].id).toBe(deletedErroredImage.id);
    expect(elements[1].status).toBe("error");
    expect(elements[2]).toBe(okImage);
    expect(elements[3]).toBe(rectangle);
    // originals are not mutated
    expect(erroredImage.status).toBe("pending");
  });
});
