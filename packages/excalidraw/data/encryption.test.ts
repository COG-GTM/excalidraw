import { ENCRYPTION_KEY_BITS } from "@excalidraw/common";

import {
  IV_LENGTH_BYTES,
  createIV,
  decryptData,
  encryptData,
  generateEncryptionKey,
  getCryptoKey,
} from "./encryption";

const decryptToString = async (
  iv: Uint8Array<ArrayBuffer>,
  encrypted: ArrayBuffer,
  key: string,
) => new TextDecoder().decode(await decryptData(iv, encrypted, key));

describe("createIV", () => {
  it("returns a random IV of IV_LENGTH_BYTES", () => {
    const iv1 = createIV();
    const iv2 = createIV();
    expect(iv1).toBeInstanceOf(Uint8Array);
    expect(iv1.length).toBe(IV_LENGTH_BYTES);
    expect(Array.from(iv1)).not.toEqual(Array.from(iv2));
  });
});

describe("generateEncryptionKey", () => {
  it("returns a base64url jwk key string by default", async () => {
    const key = await generateEncryptionKey();
    expect(typeof key).toBe("string");
    // 128-bit key -> 22 base64url chars (no padding)
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await generateEncryptionKey()).not.toBe(key);
  });

  it("returns an extractable AES-GCM CryptoKey when asked", async () => {
    const key = await generateEncryptionKey("cryptoKey");
    expect(key.type).toBe("secret");
    expect(key.extractable).toBe(true);
    expect(key.algorithm).toMatchObject({
      name: "AES-GCM",
      length: ENCRYPTION_KEY_BITS,
    });
    expect([...key.usages].sort()).toEqual(["decrypt", "encrypt"]);
  });
});

describe("getCryptoKey", () => {
  it("imports a non-extractable key limited to the requested usage", async () => {
    const key = await getCryptoKey(await generateEncryptionKey(), "encrypt");
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(["encrypt"]);
  });
});

describe("encryptData / decryptData", () => {
  it("round-trips string data", async () => {
    const key = await generateEncryptionKey();
    const { encryptedBuffer, iv } = await encryptData(key, "secret text ✓");
    expect(iv.length).toBe(IV_LENGTH_BYTES);
    expect(new TextDecoder().decode(encryptedBuffer)).not.toContain(
      "secret text",
    );
    expect(await decryptToString(iv, encryptedBuffer, key)).toBe(
      "secret text ✓",
    );
  });

  it("accepts Uint8Array, ArrayBuffer and Blob input", async () => {
    const key = await generateEncryptionKey();
    const bytes = new TextEncoder().encode("payload");

    // jsdom's Blob#arrayBuffer() returns an ArrayBuffer from another realm
    // which Node's SubtleCrypto rejects, so return a same-realm copy
    const blob = Object.assign(new Blob([bytes]), {
      arrayBuffer: async () => bytes.slice().buffer,
    });

    for (const input of [bytes, bytes.buffer as ArrayBuffer, blob]) {
      const { encryptedBuffer, iv } = await encryptData(key, input);
      expect(await decryptToString(iv, encryptedBuffer, key)).toBe("payload");
    }
  });

  it("accepts a CryptoKey instead of a string key", async () => {
    const cryptoKey = await generateEncryptionKey("cryptoKey");
    const jwk = (await window.crypto.subtle.exportKey("jwk", cryptoKey)).k!;
    const { encryptedBuffer, iv } = await encryptData(cryptoKey, "hello");
    expect(await decryptToString(iv, encryptedBuffer, jwk)).toBe("hello");
  });

  it("uses a fresh IV for each encryption", async () => {
    const key = await generateEncryptionKey();
    const a = await encryptData(key, "same");
    const b = await encryptData(key, "same");
    expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv));
    expect(Array.from(new Uint8Array(a.encryptedBuffer))).not.toEqual(
      Array.from(new Uint8Array(b.encryptedBuffer)),
    );
  });

  it("fails to decrypt with the wrong key or IV", async () => {
    const key = await generateEncryptionKey();
    const { encryptedBuffer, iv } = await encryptData(key, "data");
    await expect(
      decryptData(iv, encryptedBuffer, await generateEncryptionKey()),
    ).rejects.toThrow();
    await expect(
      decryptData(createIV(), encryptedBuffer, key),
    ).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const key = await generateEncryptionKey();
    const { encryptedBuffer, iv } = await encryptData(key, "data");
    const tampered = new Uint8Array(encryptedBuffer.slice(0));
    tampered[0] ^= 0xff;
    await expect(decryptData(iv, tampered, key)).rejects.toThrow();
  });
});
