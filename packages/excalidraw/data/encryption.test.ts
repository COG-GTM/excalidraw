import {
  IV_LENGTH_BYTES,
  createIV,
  decryptData,
  encryptData,
  generateEncryptionKey,
} from "./encryption";

const decode = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer);

describe("encryption", () => {
  describe("generateEncryptionKey", () => {
    it("returns a base64url JWK `k` string by default", async () => {
      const key = await generateEncryptionKey();
      expect(typeof key).toBe("string");
      // 128-bit key -> 16 bytes -> 22 base64url chars (no padding)
      expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(await generateEncryptionKey()).not.toBe(key);
    });

    it("returns a CryptoKey when requested", async () => {
      const key = await generateEncryptionKey("cryptoKey");
      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 128 });
      expect(key.usages).toEqual(
        expect.arrayContaining(["encrypt", "decrypt"]),
      );
    });
  });

  describe("createIV", () => {
    it("creates a random 12-byte IV", () => {
      const iv1 = createIV();
      const iv2 = createIV();
      expect(IV_LENGTH_BYTES).toBe(12);
      expect(iv1).toBeInstanceOf(Uint8Array);
      expect(iv1.length).toBe(12);
      expect(iv2.length).toBe(12);
      expect(Array.from(iv1)).not.toEqual(Array.from(iv2));
    });
  });

  describe("encryptData / decryptData round trip", () => {
    const text = "excalidraw ✏️ end-to-end encrypted scene";
    const bytes = () => new TextEncoder().encode(text);

    const inputs: [string, () => Parameters<typeof encryptData>[1]][] = [
      ["string", () => text],
      ["Uint8Array", () => bytes()],
      ["ArrayBuffer", () => bytes().buffer],
      ["Blob", () => new Blob([bytes()])],
      ["File", () => new File([bytes()], "scene.excalidraw")],
    ];

    it.each(inputs)("round-trips %s input", async (_, makeInput) => {
      const key = await generateEncryptionKey();
      const { encryptedBuffer, iv } = await encryptData(key, makeInput());

      expect(iv.length).toBe(IV_LENGTH_BYTES);
      // AES-GCM appends a 16-byte auth tag
      expect(encryptedBuffer.byteLength).toBe(bytes().byteLength + 16);
      expect(decode(encryptedBuffer)).not.toContain("excalidraw");

      const decrypted = await decryptData(iv, encryptedBuffer, key);
      expect(decode(decrypted)).toBe(text);
    });

    it("accepts a CryptoKey for encryption", async () => {
      const cryptoKey = await generateEncryptionKey("cryptoKey");
      const jwk = await window.crypto.subtle.exportKey("jwk", cryptoKey);
      const { encryptedBuffer, iv } = await encryptData(cryptoKey, text);
      const decrypted = await decryptData(iv, encryptedBuffer, jwk.k!);
      expect(decode(decrypted)).toBe(text);
    });

    it("uses a fresh IV for every encryption", async () => {
      const key = await generateEncryptionKey();
      const a = await encryptData(key, text);
      const b = await encryptData(key, text);
      expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv));
      expect(Array.from(new Uint8Array(a.encryptedBuffer))).not.toEqual(
        Array.from(new Uint8Array(b.encryptedBuffer)),
      );
    });

    it("rejects decryption with the wrong key", async () => {
      const key = await generateEncryptionKey();
      const otherKey = await generateEncryptionKey();
      const { encryptedBuffer, iv } = await encryptData(key, text);
      await expect(
        decryptData(iv, encryptedBuffer, otherKey),
      ).rejects.toThrow();
    });

    it("rejects decryption with the wrong IV", async () => {
      const key = await generateEncryptionKey();
      const { encryptedBuffer } = await encryptData(key, text);
      await expect(
        decryptData(createIV(), encryptedBuffer, key),
      ).rejects.toThrow();
    });

    it("rejects tampered ciphertext", async () => {
      const key = await generateEncryptionKey();
      const { encryptedBuffer, iv } = await encryptData(key, text);
      const tampered = new Uint8Array(encryptedBuffer.slice(0));
      tampered[0] ^= 0xff;
      await expect(decryptData(iv, tampered, key)).rejects.toThrow();
    });
  });
});
