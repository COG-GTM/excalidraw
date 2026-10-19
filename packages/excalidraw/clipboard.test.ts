import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import {
  createPasteEvent,
  parseClipboard,
  parseDataTransferEvent,
  serializeAsClipboardJSON,
} from "./clipboard";
import { API } from "./tests/helpers/api";

import type { BinaryFileData, BinaryFiles, DataURL } from "./types";

describe("parseClipboard()", () => {
  it("should parse JSON as plaintext if not excalidraw-api/clipboard data", async () => {
    let text;
    let clipboardData;
    // -------------------------------------------------------------------------

    text = "123";
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);

    // -------------------------------------------------------------------------

    text = "[123]";
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);

    // -------------------------------------------------------------------------

    text = JSON.stringify({ val: 42 });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);
  });

  it("should parse valid excalidraw JSON if inside text/plain", async () => {
    const rect = API.createElement({ type: "rectangle" });

    const json = serializeAsClipboardJSON({ elements: [rect], files: null });
    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/plain": json,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
  });

  it("should parse valid excalidraw JSON if inside text/html", async () => {
    const rect = API.createElement({ type: "rectangle" });

    let json;
    let clipboardData;
    // -------------------------------------------------------------------------
    json = serializeAsClipboardJSON({ elements: [rect], files: null });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": json,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
    // -------------------------------------------------------------------------
    json = serializeAsClipboardJSON({ elements: [rect], files: null });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<div> ${json}</div>`,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
    // -------------------------------------------------------------------------
  });

  it("should parse <image> `src` urls out of text/html", async () => {
    let clipboardData;
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<img src="https://example.com/image.png" />`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
    ]);
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<div><img src="https://example.com/image.png" /></div><a><img src="https://example.com/image2.png" /></a>`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
      {
        type: "imageUrl",
        value: "https://example.com/image2.png",
      },
    ]);
  });

  it("should parse text content alongside <image> `src` urls out of text/html", async () => {
    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<a href="https://example.com">hello </a><div><img src="https://example.com/image.png" /></div><b>my friend!</b>`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "text",
        // trimmed
        value: "hello",
      },
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
      {
        type: "text",
        value: "my friend!",
      },
    ]);
  });
});

describe("serializeAsClipboardJSON()", () => {
  const createBinaryFile = (id: string): BinaryFileData => ({
    id: id as FileId,
    mimeType: MIME_TYPES.png,
    dataURL: `data:image/png;base64,${id}` as DataURL,
    created: 1,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should include binary files of copied image elements", () => {
    const image = API.createElement({ type: "image", fileId: "file-1" });
    const rect = API.createElement({ type: "rectangle" });
    const files: BinaryFiles = {
      "file-1": createBinaryFile("file-1"),
      "file-2": createBinaryFile("file-2"),
    };

    const parsed = JSON.parse(
      serializeAsClipboardJSON({ elements: [image, rect], files }),
    );

    expect(parsed.type).toBe(EXPORT_DATA_TYPES.excalidrawClipboard);
    expect(parsed.elements).toEqual([image, rect]);
    expect(parsed.files).toEqual({ "file-1": files["file-1"] });
  });

  it("should round-trip image files through parseClipboard()", async () => {
    const image = API.createElement({ type: "image", fileId: "file-1" });
    const files: BinaryFiles = { "file-1": createBinaryFile("file-1") };

    const json = serializeAsClipboardJSON({ elements: [image], files });
    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": json } }),
      ),
    );

    expect(clipboardData.elements).toEqual([image]);
    expect(clipboardData.files).toEqual(files);
  });

  it("should serialize an empty files map when the image's file is missing", () => {
    const image = API.createElement({ type: "image", fileId: "missing" });
    const files: BinaryFiles = { other: createBinaryFile("other") };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const parsed = JSON.parse(
      serializeAsClipboardJSON({ elements: [image], files }),
    );

    expect(parsed.elements).toEqual([image]);
    expect(parsed.files).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should warn and omit files when image elements are copied without files", () => {
    const image = API.createElement({ type: "image", fileId: "file-1" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const parsed = JSON.parse(
      serializeAsClipboardJSON({ elements: [image], files: null }),
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("without providing associated `files` object"),
    );
    expect(parsed.elements).toEqual([image]);
    expect(parsed).not.toHaveProperty("files");
  });

  it("should not warn or collect files for non-initialized images", () => {
    const image = API.createElement({ type: "image" });
    const rect = API.createElement({ type: "rectangle" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      JSON.parse(
        serializeAsClipboardJSON({ elements: [image, rect], files: null }),
      ),
    ).not.toHaveProperty("files");
    expect(
      JSON.parse(
        serializeAsClipboardJSON({
          elements: [image, rect],
          files: { "file-1": createBinaryFile("file-1") },
        }),
      ).files,
    ).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should keep frameId of frame children copied together with their frame", () => {
    const frame = API.createElement({ type: "frame" });
    const child = API.createElement({ type: "rectangle", frameId: frame.id });

    const parsed = JSON.parse(
      serializeAsClipboardJSON({ elements: [child, frame], files: null }),
    );

    expect(parsed.elements).toEqual([child, frame]);
    expect(parsed.elements[0].frameId).toBe(frame.id);
  });

  it("should keep frameId of frame children copied without their frame", () => {
    // containing frame is resolved only among copied elements, so the
    // dangling frameId is kept here and repaired on paste by restore
    const frame = API.createElement({ type: "frame" });
    const child = API.createElement({ type: "rectangle", frameId: frame.id });

    const parsed = JSON.parse(
      serializeAsClipboardJSON({ elements: [child], files: null }),
    );

    expect(parsed.elements).toEqual([child]);
    expect(parsed.elements[0].frameId).toBe(frame.id);
  });

  it("should detach elements whose copied container is not a frame without mutating the original", () => {
    const rect = API.createElement({ type: "rectangle" });
    const child = API.createElement({ type: "ellipse", frameId: rect.id });
    const originalVersion = child.version;

    const parsed = JSON.parse(
      serializeAsClipboardJSON({ elements: [rect, child], files: null }),
    );

    expect(parsed.elements[0]).toEqual(rect);
    expect(parsed.elements[1].id).toBe(child.id);
    expect(parsed.elements[1].frameId).toBeNull();
    expect(parsed.elements[1].version).toBeGreaterThan(originalVersion);
    expect(child.frameId).toBe(rect.id);
    expect(child.version).toBe(originalVersion);
  });
});
