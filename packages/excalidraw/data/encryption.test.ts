import {
  IV_LENGTH_BYTES,
  createIV,
  decryptData,
  encryptData,
  generateEncryptionKey,
  getCryptoKey,
} from "./encryption";

const decodeText = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer);

describe("encryption", () => {
  it("createIV returns random IVs of the expected length", () => {
    const a = createIV();
    const b = createIV();
    expect(a).toBeInstanceOf(Uint8Array);
    expect(a.length).toBe(IV_LENGTH_BYTES);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("generateEncryptionKey returns a JWK string by default", async () => {
    const key = await generateEncryptionKey();
    expect(typeof key).toBe("string");
    // 128 bit key, base64url encoded without padding
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await generateEncryptionKey()).not.toBe(key);
  });

  it("generateEncryptionKey can return a CryptoKey", async () => {
    const key = await generateEncryptionKey("cryptoKey");
    expect(key.type).toBe("secret");
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 128 });
    expect(key.usages).toEqual(expect.arrayContaining(["encrypt", "decrypt"]));
  });

  it("getCryptoKey imports a non-extractable key for the given usage", async () => {
    const key = await getCryptoKey(await generateEncryptionKey(), "encrypt");
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(["encrypt"]);
  });

  it("round-trips string data", async () => {
    const key = await generateEncryptionKey();
    const { encryptedBuffer, iv } = await encryptData(key, "top secret");
    expect(iv.length).toBe(IV_LENGTH_BYTES);
    expect(decodeText(encryptedBuffer)).not.toContain("top secret");
    expect(decodeText(await decryptData(iv, encryptedBuffer, key))).toBe(
      "top secret",
    );
  });

  it("round-trips Uint8Array and ArrayBuffer data", async () => {
    const key = await generateEncryptionKey();
    // TextEncoder output is a Node-realm Uint8Array, which SubtleCrypto accepts
    const bytes = new TextEncoder().encode("\x01\x02\x03\x04\x05");

    const fromView = await encryptData(key, bytes);
    expect(
      Array.from(
        new Uint8Array(
          await decryptData(fromView.iv, fromView.encryptedBuffer, key),
        ),
      ),
    ).toEqual([1, 2, 3, 4, 5]);

    const fromBuffer = await encryptData(key, bytes.slice().buffer);
    expect(
      Array.from(
        new Uint8Array(
          await decryptData(fromBuffer.iv, fromBuffer.encryptedBuffer, key),
        ),
      ),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("accepts a CryptoKey for encryption", async () => {
    const cryptoKey = await generateEncryptionKey("cryptoKey");
    const jwk = (await window.crypto.subtle.exportKey("jwk", cryptoKey)).k!;
    const { encryptedBuffer, iv } = await encryptData(cryptoKey, "hello");
    expect(decodeText(await decryptData(iv, encryptedBuffer, jwk))).toBe(
      "hello",
    );
  });

  it("encrypts Blob data", async () => {
    const key = await generateEncryptionKey();
    const bytes = new TextEncoder().encode("blob contents");
    const blob = new Blob([bytes]);
    // jsdom Blob buffers are cross-realm and rejected by Node's SubtleCrypto
    (blob as any).arrayBuffer = () => Promise.resolve(bytes.slice().buffer);
    const { encryptedBuffer, iv } = await encryptData(key, blob);
    expect(decodeText(await decryptData(iv, encryptedBuffer, key))).toBe(
      "blob contents",
    );
  });

  it("fails to decrypt with the wrong key or tampered data", async () => {
    const key = await generateEncryptionKey();
    const { encryptedBuffer, iv } = await encryptData(key, "payload");

    await expect(
      decryptData(iv, encryptedBuffer, await generateEncryptionKey()),
    ).rejects.toThrow();

    const tampered = new Uint8Array(encryptedBuffer.slice(0));
    tampered[0] ^= 0xff;
    await expect(decryptData(iv, tampered, key)).rejects.toThrow();
  });
});
