import { deflate } from "pako";
import { vi } from "vitest";

import {
  base64urlToString,
  base64ToString,
  compressData,
  decode,
  decompressData,
  encode,
  stringToBase64,
  toByteString,
} from "./encode";
import {
  encryptData,
  generateEncryptionKey,
  IV_LENGTH_BYTES,
} from "./encryption";

// mirrors the `concatBuffers()` layout in encode.ts so tests can pin the
// on-the-wire format independently of the implementation:
// [version (u32 BE)] ([chunk length (u32 BE)] [chunk bytes])*
const buildContainer = (version: number, ...chunks: Uint8Array[]) => {
  const out = new Uint8Array(
    4 + chunks.reduce((acc, chunk) => acc + 4 + chunk.byteLength, 0),
  );
  const view = new DataView(out.buffer);
  view.setUint32(0, version);
  let cursor = 4;
  for (const chunk of chunks) {
    view.setUint32(cursor, chunk.byteLength);
    cursor += 4;
    out.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return out;
};

const readContainer = (buffer: Uint8Array) => {
  const view = new DataView(buffer.buffer, buffer.byteOffset);
  const version = view.getUint32(0);
  const chunks: Uint8Array[] = [];
  let cursor = 4;
  while (cursor < buffer.byteLength) {
    const size = view.getUint32(cursor);
    cursor += 4;
    chunks.push(buffer.slice(cursor, cursor + size));
    cursor += size;
  }
  return { version, chunks };
};

const utf8 = (str: string) => new TextEncoder().encode(str);

const randomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  // getRandomValues is capped at 65536 bytes per call
  for (let offset = 0; offset < length; offset += 65536) {
    window.crypto.getRandomValues(
      bytes.subarray(offset, Math.min(offset + 65536, length)),
    );
  }
  return bytes;
};

describe("compressData / decompressData", () => {
  let key: string;

  beforeAll(async () => {
    key = await generateEncryptionKey();
  });

  it.each([
    ["empty", new Uint8Array(0)],
    ["small", utf8("hello excalidraw 👋")],
    ["multi-KB random", randomBytes(64 * 1024 + 7)],
    ["multi-KB compressible", utf8("excalidraw".repeat(5000))],
  ])("round-trips %s payload with metadata", async (_, payload) => {
    const metadata = { id: "scene-1", nested: { list: [1, "two", null] } };

    const compressed = await compressData(payload, {
      encryptionKey: key,
      metadata,
    });
    const { data, metadata: decodedMetadata } = await decompressData<
      typeof metadata
    >(compressed, { decryptionKey: key });

    expect(decodedMetadata).toEqual(metadata);
    expect(Array.from(data)).toEqual(Array.from(payload));
  });

  it("round-trips payload without metadata (metadata decodes to null)", async () => {
    const payload = utf8("no metadata");

    const compressed = await compressData(payload, { encryptionKey: key });
    const result = await decompressData(compressed, { decryptionKey: key });

    expect(result.metadata).toBeNull();
    expect(new TextDecoder().decode(result.data)).toBe("no metadata");
  });

  it("produces the versioned [encodingMetadata, iv, ciphertext] container", async () => {
    const payload = utf8("x".repeat(1000));
    const compressed = await compressData(payload, { encryptionKey: key });

    const { version, chunks } = readContainer(compressed);
    expect(version).toBe(1);
    expect(chunks).toHaveLength(3);

    const [encodingMetadata, iv, cipher] = chunks;
    expect(JSON.parse(new TextDecoder().decode(encodingMetadata))).toEqual({
      version: 2,
      compression: "pako@1",
      encryption: "AES-GCM",
    });
    expect(iv.byteLength).toBe(IV_LENGTH_BYTES);
    // highly compressible payload must actually be deflated before encryption
    // (AES-GCM adds a 16-byte auth tag on top of the plaintext length)
    expect(cipher.byteLength).toBeLessThan(payload.byteLength);
    expect(compressed.byteLength).toBe(
      4 +
        3 * 4 +
        encodingMetadata.byteLength +
        iv.byteLength +
        cipher.byteLength,
    );
  });

  it("uses a fresh IV for every call", async () => {
    const payload = utf8("same input");
    const a = readContainer(
      await compressData(payload, { encryptionKey: key }),
    );
    const b = readContainer(
      await compressData(payload, { encryptionKey: key }),
    );

    expect(Array.from(a.chunks[1])).not.toEqual(Array.from(b.chunks[1]));
    expect(Array.from(a.chunks[2])).not.toEqual(Array.from(b.chunks[2]));
  });

  it("decodes a buffer produced by an earlier build (backwards compatibility)", async () => {
    // generated once via compressData(utf8("hello excalidraw"), {
    //   encryptionKey: FIXTURE_KEY, metadata: { id: "fixture", n: 1 } })
    // -- test-only random key, not a secret
    const FIXTURE_KEY = "0CprWwNxVieAlttmpvVOaQ";
    const FIXTURE =
      "AAAAAQAAADt7InZlcnNpb24iOjIsImNvbXByZXNzaW9uIjoicGFrb0AxIiwiZW5jcnlwdGlvbiI6IkFFUy1HQ00ifQAAAAxaInfzVew+n1Hq39gAAABJc7hrzAnkFuOZPL9QukGrz2JkvFV5YhOZTh/6ef1eIIAFxskZFsc9b1sW89WYy8ewUt7H0zj+0DlaJ4IivsTYdiDA8BXFWtH+8Q==";
    const buffer = new Uint8Array(Buffer.from(FIXTURE, "base64"));

    const { metadata, data } = await decompressData(buffer, {
      decryptionKey: FIXTURE_KEY,
    });

    expect(metadata).toEqual({ id: "fixture", n: 1 });
    expect(new TextDecoder().decode(data)).toBe("hello excalidraw");
  });

  it("decodes uncompressed containers (compression: null)", async () => {
    const payload = utf8("stored without deflate");
    const inner = buildContainer(1, utf8(JSON.stringify({ a: 1 })), payload);
    const { encryptedBuffer, iv } = await encryptData(key, inner);

    const container = buildContainer(
      1,
      utf8(
        JSON.stringify({
          version: 2,
          compression: null,
          encryption: "AES-GCM",
        }),
      ),
      iv,
      new Uint8Array(encryptedBuffer),
    );

    const { metadata, data } = await decompressData(container, {
      decryptionKey: key,
    });
    expect(metadata).toEqual({ a: 1 });
    expect(new TextDecoder().decode(data)).toBe("stored without deflate");
  });

  it("inflates when encoding metadata declares compression", async () => {
    const payload = utf8("deflated by hand");
    const inner = buildContainer(1, utf8("null"), payload);
    const { encryptedBuffer, iv } = await encryptData(
      key,
      deflate(inner) as Uint8Array<ArrayBuffer>,
    );

    const container = buildContainer(
      1,
      utf8(
        JSON.stringify({
          version: 2,
          compression: "pako@1",
          encryption: "AES-GCM",
        }),
      ),
      iv,
      new Uint8Array(encryptedBuffer),
    );

    const { metadata, data } = await decompressData(container, {
      decryptionKey: key,
    });
    expect(metadata).toBeNull();
    expect(new TextDecoder().decode(data)).toBe("deflated by hand");
  });

  describe("error paths", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("rejects with the wrong decryption key and logs encoding metadata", async () => {
      const compressed = await compressData(utf8("secret"), {
        encryptionKey: key,
        metadata: { a: 1 },
      });
      const wrongKey = await generateEncryptionKey();

      await expect(
        decompressData(compressed, { decryptionKey: wrongKey }),
      ).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error during decompressing and decrypting the file.",
        { version: 2, compression: "pako@1", encryption: "AES-GCM" },
      );
    });

    it("rejects buffers with an unsupported container version", async () => {
      const compressed = await compressData(utf8("data"), {
        encryptionKey: key,
      });
      new DataView(compressed.buffer).setUint32(0, 2);

      await expect(
        decompressData(compressed, { decryptionKey: key }),
      ).rejects.toThrow("invalid version 2");
    });

    it("rejects non-container input (e.g. legacy/garbage data)", async () => {
      const garbage = utf8('{"type":"excalidraw","elements":[]}');

      await expect(
        decompressData(garbage, { decryptionKey: key }),
      ).rejects.toThrow(/invalid version/);
    });

    it("rejects truncated buffers instead of returning partial data", async () => {
      const compressed = await compressData(utf8("x".repeat(500)), {
        encryptionKey: key,
        metadata: { a: 1 },
      });

      for (const cut of [1, 8, 17]) {
        await expect(
          decompressData(compressed.slice(0, compressed.byteLength - cut), {
            decryptionKey: key,
          }),
        ).rejects.toThrow();
      }
    });

    describe("malformed chunk boundaries", () => {
      // byte offsets of the outer container's length fields
      const layout = (buffer: Uint8Array) => {
        const view = new DataView(buffer.buffer);
        const encodingMetaLength = view.getUint32(4);
        const ivLengthOffset = 4 + 4 + encodingMetaLength;
        const cipherLengthOffset = ivLengthOffset + 4 + IV_LENGTH_BYTES;
        return { view, ivLengthOffset, cipherLengthOffset };
      };

      const compress = () =>
        compressData(utf8("x".repeat(500)), {
          encryptionKey: key,
          metadata: { a: 1 },
        });

      it("rejects a buffer truncated inside a length field", async () => {
        const compressed = await compress();
        const { cipherLengthOffset } = layout(compressed);

        await expect(
          decompressData(compressed.slice(0, cipherLengthOffset + 2), {
            decryptionKey: key,
          }),
        ).rejects.toThrow(RangeError);
      });

      it("rejects a buffer truncated right after a chunk (missing chunk)", async () => {
        const compressed = await compress();
        const { cipherLengthOffset } = layout(compressed);

        await expect(
          decompressData(compressed.slice(0, cipherLengthOffset), {
            decryptionKey: key,
          }),
        ).rejects.toThrow();
      });

      it("rejects an overstated length that swallows the next chunk", async () => {
        const compressed = await compress();
        const { view, ivLengthOffset } = layout(compressed);
        view.setUint32(ivLengthOffset, IV_LENGTH_BYTES + 4 + 50);

        await expect(
          decompressData(compressed, { decryptionKey: key }),
        ).rejects.toThrow();
      });

      it("rejects an understated length of the last chunk", async () => {
        const compressed = await compress();
        const { view, cipherLengthOffset } = layout(compressed);
        view.setUint32(cipherLengthOffset, 5);

        await expect(
          decompressData(compressed, { decryptionKey: key }),
        ).rejects.toThrow();
      });

      it("rejects an overstated encoding-metadata length", async () => {
        const compressed = await compress();
        const { view } = layout(compressed);
        view.setUint32(4, view.getUint32(4) + 3);

        await expect(
          decompressData(compressed, { decryptionKey: key }),
        ).rejects.toThrow(SyntaxError);
      });

      it("tolerates an overstated length of the last chunk (current behavior)", async () => {
        // `splitBuffers` slices with `slice(cursor, cursor + size)`, which
        // clamps to the buffer end, so an overstated final length is lenient
        const compressed = await compress();
        const { view, cipherLengthOffset } = layout(compressed);
        view.setUint32(
          cipherLengthOffset,
          view.getUint32(cipherLengthOffset) + 100,
        );

        const { data } = await decompressData(compressed, {
          decryptionKey: key,
        });
        expect(new TextDecoder().decode(data)).toBe("x".repeat(500));
      });
    });

    it("rejects tampered ciphertext (AES-GCM authentication)", async () => {
      const compressed = await compressData(utf8("integrity"), {
        encryptionKey: key,
      });
      compressed[compressed.byteLength - 1] ^= 0xff;

      await expect(
        decompressData(compressed, { decryptionKey: key }),
      ).rejects.toThrow();
    });
  });
});

describe("byte string & base64 helpers", () => {
  it("toByteString encodes strings as UTF-8 bytes", () => {
    expect(toByteString("abc")).toBe("abc");
    expect(toByteString("é")).toBe("\xc3\xa9");
    expect(toByteString("👋")).toBe("\xf0\x9f\x91\x8b");
  });

  it("toByteString accepts Uint8Array and ArrayBuffer", () => {
    const bytes = new Uint8Array([0, 127, 128, 255]);
    expect(toByteString(bytes)).toBe("\x00\x7f\x80\xff");
    expect(toByteString(bytes.buffer)).toBe("\x00\x7f\x80\xff");
  });

  it("stringToBase64 / base64ToString round-trip multi-byte UTF-8", () => {
    const str = "Excalidraw ✏️ 日本語 👋🏽";
    const base64 = stringToBase64(str);

    expect(base64).toBe(Buffer.from(str, "utf8").toString("base64"));
    expect(base64ToString(base64)).toBe(str);
  });

  it("stringToBase64 / base64ToString with isByteString=true skip re-encoding", () => {
    const byteString = "\x00\x7f\x80\xff";
    const base64 = stringToBase64(byteString, true);

    expect(base64).toBe("AH+A/w==");
    expect(base64ToString(base64, true)).toBe(byteString);
    // without the flag, the byte string would get UTF-8 encoded again
    expect(stringToBase64(byteString)).not.toBe(base64);
  });

  it("base64urlToString normalizes url-safe alphabet and missing padding", () => {
    // bytes chosen so that standard base64 contains both "+" and "/"
    const byteString = "\xfb\xff\xbf";
    expect(window.btoa(byteString)).toBe("+/+/");
    expect(base64urlToString("-_-_")).toBe(byteString);

    // padding lengths 0, 1 and 2
    expect(base64urlToString("YWJj")).toBe("abc");
    expect(base64urlToString("YWI")).toBe("ab");
    expect(base64urlToString("YQ")).toBe("a");
  });
});

describe("encode / decode", () => {
  const text = JSON.stringify({ type: "excalidraw", label: "日本語 👋" });

  it("compresses by default and round-trips", () => {
    const encoded = encode({ text });

    expect(encoded).toMatchObject({
      version: "1",
      encoding: "bstring",
      compressed: true,
    });
    expect(decode(encoded)).toBe(text);
  });

  it("round-trips with compress: false", () => {
    const encoded = encode({ text, compress: false });

    expect(encoded).toEqual({
      version: "1",
      encoding: "bstring",
      compressed: false,
      encoded: toByteString(text),
    });
    expect(decode(encoded)).toBe(text);
  });

  it("throws on unknown encoding", () => {
    expect(() =>
      decode({
        encoding: "base64" as any,
        compressed: false,
        encoded: "",
      }),
    ).toThrow('decode: unknown encoding "base64"');
  });
});
