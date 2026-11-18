import { MIME_TYPES } from "@excalidraw/common";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "@excalidraw/excalidraw/clipboard";
import { encodePngMetadata } from "@excalidraw/excalidraw/data/image";
import { diagramFactory } from "@excalidraw/excalidraw/tests/fixtures/diagramFixture";
import { vi } from "vitest";

import * as utils from "../src";

vi.mock("@excalidraw/excalidraw/clipboard", () => ({
  copyBlobToClipboardAsPng: vi.fn(async () => {}),
  copyTextToSystemClipboard: vi.fn(async () => {}),
  copyToClipboard: vi.fn(async () => {}),
}));

vi.mock("@excalidraw/excalidraw/data/image", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@excalidraw/excalidraw/data/image")
  >()),
  encodePngMetadata: vi.fn(
    async () => new Blob(["embedded"], { type: "image/png" }),
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("exportToBlob with exportEmbedScene", () => {
  it("embeds the serialized scene into png exports", async () => {
    const diagram = diagramFactory();
    const blob = await utils.exportToBlob({
      ...diagram,
      appState: { exportEmbedScene: true },
    });

    expect(encodePngMetadata).toHaveBeenCalledTimes(1);
    const { metadata } = vi.mocked(encodePngMetadata).mock.calls[0][0];
    const parsed = JSON.parse(metadata);
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.elements.map((el: { id: string }) => el.id)).toEqual(
      diagram.elements.map((el) => el.id),
    );
    expect(blob.size).toBe("embedded".length);
  });

  it("does not embed the scene for non-png exports", async () => {
    await utils.exportToBlob({
      ...diagramFactory(),
      mimeType: MIME_TYPES.jpg,
      appState: { exportEmbedScene: true, exportBackground: true },
    });

    expect(encodePngMetadata).not.toHaveBeenCalled();
  });

  it("does not embed the scene when exportEmbedScene is off", async () => {
    await utils.exportToBlob({ ...diagramFactory() });

    expect(encodePngMetadata).not.toHaveBeenCalled();
  });
});

describe("exportToClipboard", () => {
  it("copies the svg markup as text for type svg", async () => {
    await utils.exportToClipboard({ ...diagramFactory(), type: "svg" });

    expect(copyTextToSystemClipboard).toHaveBeenCalledTimes(1);
    const [svgMarkup] = vi.mocked(copyTextToSystemClipboard).mock.calls[0];
    expect(svgMarkup).toMatch(/^<svg/);
    expect(copyBlobToClipboardAsPng).not.toHaveBeenCalled();
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it("copies a png blob promise for type png", async () => {
    await utils.exportToClipboard({ ...diagramFactory(), type: "png" });

    expect(copyBlobToClipboardAsPng).toHaveBeenCalledTimes(1);
    const [blobPromise] = vi.mocked(copyBlobToClipboardAsPng).mock.calls[0];
    expect(blobPromise).toBeInstanceOf(Promise);
    const blob = await blobPromise;
    expect(blob.type).toBe(MIME_TYPES.png);
    expect(copyTextToSystemClipboard).not.toHaveBeenCalled();
  });

  it("copies the elements and files for type json", async () => {
    const diagram = diagramFactory();
    await utils.exportToClipboard({ ...diagram, type: "json" });

    expect(copyToClipboard).toHaveBeenCalledWith(
      diagram.elements,
      diagram.files,
    );
  });

  it("throws for an unknown type", async () => {
    await expect(
      utils.exportToClipboard({
        ...diagramFactory(),
        type: "pdf" as unknown as "png",
      }),
    ).rejects.toThrow("Invalid export type");
  });
});
