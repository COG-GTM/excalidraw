import { ExcalidrawError } from "@excalidraw/excalidraw/errors";
import { render } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";

const PLUS_ORIGIN = "https://plus.excalidraw.test";

const { getFilesMock } = vi.hoisted(() => ({ getFilesMock: vi.fn() }));

vi.mock("../data/LocalData", () => ({
  LocalData: { fileStorage: { getFiles: getFilesMock } },
}));

let mod: typeof import("../ExcalidrawPlusIframeExport");

// -----------------------------------------------------------------------------
// JWT helpers
// -----------------------------------------------------------------------------

const RSA_PARAMS = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;

const bytesToBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

const toBase64Url = (base64: string) =>
  base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const encodeJSON = (value: unknown) => toBase64Url(btoa(JSON.stringify(value)));

const generateKeyPair = async () => {
  const keyPair = (await crypto.subtle.generateKey(RSA_PARAMS, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  return {
    privateKey: keyPair.privateKey,
    publicKey: bytesToBase64(new Uint8Array(spki)),
  };
};

const signJWT = async (privateKey: CryptoKey, payload: object) => {
  const header = encodeJSON({ alg: "RS256", typ: "JWT" });
  const body = encodeJSON(payload);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${toBase64Url(
    bytesToBase64(new Uint8Array(signature)),
  )}`;
};

const nowInSeconds = () => Math.floor(Date.now() / 1000);

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
  // EXCALIDRAW_PLUS_ORIGIN is read at module load, so stub before importing
  vi.stubEnv("VITE_APP_PLUS_APP", PLUS_ORIGIN);
  mod = await import("../ExcalidrawPlusIframeExport");
  keys = await generateKeyPair();
  otherKeys = await generateKeyPair();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  getFilesMock.mockReset();
  getFilesMock.mockResolvedValue({
    loadedFiles: [],
    erroredFiles: new Map(),
  });
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------

describe("verifyJWT", () => {
  it("resolves for a token signed by the matching key with a future exp", async () => {
    const token = await signJWT(keys.privateKey, {
      sub: "user",
      exp: nowInSeconds() + 60,
    });

    await expect(
      mod.verifyJWT({ token, publicKey: keys.publicKey }),
    ).resolves.toBeUndefined();
  });

  it("resolves for a valid token without exp", async () => {
    const token = await signJWT(keys.privateKey, { sub: "user" });

    await expect(
      mod.verifyJWT({ token, publicKey: keys.publicKey }),
    ).resolves.toBeUndefined();
  });

  it("accepts a PEM-wrapped public key", async () => {
    const token = await signJWT(keys.privateKey, { sub: "user" });
    const pem = `-----BEGIN PUBLIC KEY-----${keys.publicKey}-----END PUBLIC KEY-----`;

    await expect(
      mod.verifyJWT({ token, publicKey: pem }),
    ).resolves.toBeUndefined();
  });

  it("rejects when the public key is empty", async () => {
    const token = await signJWT(keys.privateKey, { sub: "user" });

    await expect(mod.verifyJWT({ token, publicKey: "" })).rejects.toThrow(
      "Public key is undefined",
    );
  });

  it.each([
    ["two parts", "aaa.bbb"],
    ["one part", "aaa"],
    ["empty signature", "aaa.bbb."],
    ["empty string", ""],
  ])("rejects a malformed token (%s)", async (_, token) => {
    await expect(
      mod.verifyJWT({ token, publicKey: keys.publicKey }),
    ).rejects.toThrow("Invalid JWT format");
  });

  it("rejects a token with a tampered signature", async () => {
    const token = await signJWT(keys.privateKey, { sub: "user" });
    const [header, payload, signature] = token.split(".");
    const tamperedSignature =
      (signature[0] === "A" ? "B" : "A") + signature.slice(1);

    await expect(
      mod.verifyJWT({
        token: `${header}.${payload}.${tamperedSignature}`,
        publicKey: keys.publicKey,
      }),
    ).rejects.toThrow("Invalid JWT");
  });

  it("rejects a token whose payload was swapped after signing", async () => {
    const token = await signJWT(keys.privateKey, {
      sub: "user",
      exp: nowInSeconds() - 60,
    });
    const [header, , signature] = token.split(".");
    const forgedPayload = encodeJSON({
      sub: "user",
      exp: nowInSeconds() + 3600,
    });

    await expect(
      mod.verifyJWT({
        token: `${header}.${forgedPayload}.${signature}`,
        publicKey: keys.publicKey,
      }),
    ).rejects.toThrow(/^Invalid JWT$/);
  });

  it("rejects a token signed with a different key", async () => {
    const token = await signJWT(otherKeys.privateKey, { sub: "user" });

    await expect(
      mod.verifyJWT({ token, publicKey: keys.publicKey }),
    ).rejects.toThrow(/^Invalid JWT$/);
  });

  it("rejects an expired token", async () => {
    const token = await signJWT(keys.privateKey, {
      sub: "user",
      exp: nowInSeconds() - 1,
    });

    await expect(
      mod.verifyJWT({ token, publicKey: keys.publicKey }),
    ).rejects.toThrow("JWT has expired");
  });

  it("checks exp against the current time in seconds", async () => {
    vi.useFakeTimers({ now: new Date("2030-01-01T00:00:00Z") });
    try {
      const now = Math.floor(Date.now() / 1000);
      const valid = await signJWT(keys.privateKey, { exp: now + 30 });
      const expired = await signJWT(keys.privateKey, { exp: now - 30 });

      await expect(
        mod.verifyJWT({ token: valid, publicKey: keys.publicKey }),
      ).resolves.toBeUndefined();
      await expect(
        mod.verifyJWT({ token: expired, publicKey: keys.publicKey }),
      ).rejects.toThrow("JWT has expired");
    } finally {
      vi.useRealTimers();
    }
  });
});

// -----------------------------------------------------------------------------

describe("parseSceneData", () => {
  const appStateString = JSON.stringify({ viewBackgroundColor: "#fff" });

  it.each([
    ["elements", null, appStateString],
    ["appState", JSON.stringify([{ id: "a" }]), null],
    ["both", null, null],
    ["elements (empty string)", "", appStateString],
  ])(
    "throws ExcalidrawError when %s is missing",
    async (_, rawElementsString, rawAppStateString) => {
      const promise = mod.parseSceneData({
        rawElementsString,
        rawAppStateString,
      });

      await expect(promise).rejects.toBeInstanceOf(ExcalidrawError);
      await expect(promise).rejects.toThrow("Elements or appstate is missing.");
      expect(getFilesMock).not.toHaveBeenCalled();
    },
  );

  it("throws ExcalidrawError when the scene is empty", async () => {
    const promise = mod.parseSceneData({
      rawElementsString: "[]",
      rawAppStateString: appStateString,
    });

    await expect(promise).rejects.toBeInstanceOf(ExcalidrawError);
    await expect(promise).rejects.toThrow("Scene is empty, nothing to export.");
    expect(getFilesMock).not.toHaveBeenCalled();
  });

  it.each([
    ["elements", "{not json", appStateString],
    ["appState", JSON.stringify([{ id: "a" }]), "{not json"],
  ])(
    "maps invalid %s JSON to a generic ExcalidrawError",
    async (_, rawElementsString, rawAppStateString) => {
      const promise = mod.parseSceneData({
        rawElementsString,
        rawAppStateString,
      });

      await expect(promise).rejects.toBeInstanceOf(ExcalidrawError);
      await expect(promise).rejects.toThrow("Failed to parse scene data.");
    },
  );

  it("maps file storage failures to a generic ExcalidrawError", async () => {
    getFilesMock.mockRejectedValue(new Error("IndexedDB is broken"));

    const promise = mod.parseSceneData({
      rawElementsString: JSON.stringify([{ id: "img", fileId: "f1" }]),
      rawAppStateString: appStateString,
    });

    await expect(promise).rejects.toBeInstanceOf(ExcalidrawError);
    await expect(promise).rejects.toThrow("Failed to parse scene data.");
  });

  it("returns SCENE_DATA and loads files for every referenced fileId", async () => {
    const elements = [
      { id: "rect", type: "rectangle" },
      { id: "img1", type: "image", fileId: "f1" },
      { id: "img2", type: "image", fileId: null },
      { id: "img3", type: "image", fileId: "f2" },
    ];
    const files = {
      loadedFiles: [{ id: "f1" }, { id: "f2" }],
      erroredFiles: new Map(),
    };
    getFilesMock.mockResolvedValue(files);

    const result = await mod.parseSceneData({
      rawElementsString: JSON.stringify(elements),
      rawAppStateString: appStateString,
    });

    expect(getFilesMock).toHaveBeenCalledTimes(1);
    expect(getFilesMock).toHaveBeenCalledWith(["f1", "f2"]);
    expect(result).toEqual({
      type: "SCENE_DATA",
      elements,
      appState: { viewBackgroundColor: "#fff" },
      files,
    });
  });
});

// -----------------------------------------------------------------------------

describe("<ExcalidrawPlusIframeExport />", () => {
  type MessageHandler = (event: MessageEvent) => Promise<void>;

  const setup = () => {
    const parentPostMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => {});
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const utils = render(
      <React.StrictMode>
        <mod.ExcalidrawPlusIframeExport />
      </React.StrictMode>,
    );

    const messageHandlers = addEventListener.mock.calls
      .filter(([type]) => type === "message")
      .map(([, handler]) => handler as unknown as MessageHandler);
    const handler = messageHandlers[messageHandlers.length - 1];

    return {
      ...utils,
      handler,
      parentPostMessage,
      removeEventListener,
    };
  };

  const createMessage = (data: unknown, origin = PLUS_ORIGIN) => {
    const sourcePostMessage = vi.fn();
    const event = new MessageEvent("message", { data, origin });
    Object.defineProperty(event, "source", {
      value: { postMessage: sourcePostMessage },
    });
    return { event, sourcePostMessage };
  };

  const storeScene = (elements: unknown[]) => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(elements),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify({ viewBackgroundColor: "#123456" }),
    );
  };

  beforeEach(() => {
    vi.stubEnv("VITE_APP_PLUS_EXPORT_PUBLIC_KEY", keys.publicKey);
  });

  afterEach(() => {
    vi.stubEnv("VITE_APP_PLUS_EXPORT_PUBLIC_KEY", "");
  });

  it("posts READY to the parent window exactly once, targeting the Plus origin", () => {
    const { parentPostMessage, container } = setup();

    expect(container).toBeEmptyDOMElement();
    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: "READY" },
      PLUS_ORIGIN,
    );
  });

  it("rejects messages from a foreign origin without replying", async () => {
    const { handler } = setup();
    storeScene([{ id: "a" }]);
    const token = await signJWT(keys.privateKey, { sub: "user" });
    const { event, sourcePostMessage } = createMessage(
      { type: "REQUEST_SCENE", jwt: token },
      "https://evil.example.com",
    );

    await expect(handler(event)).rejects.toThrow("Invalid origin");
    expect(sourcePostMessage).not.toHaveBeenCalled();
    expect(getFilesMock).not.toHaveBeenCalled();
  });

  it("rejects REQUEST_SCENE without a jwt without replying", async () => {
    const { handler } = setup();
    storeScene([{ id: "a" }]);
    const { event, sourcePostMessage } = createMessage({
      type: "REQUEST_SCENE",
    });

    await expect(handler(event)).rejects.toThrow("JWT is missing");
    expect(sourcePostMessage).not.toHaveBeenCalled();
  });

  it("ignores unknown message types", async () => {
    const { handler } = setup();
    const { event, sourcePostMessage } = createMessage({ type: "OTHER" });

    await expect(handler(event)).resolves.toBeUndefined();
    expect(sourcePostMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", async () => "not-a-jwt"],
    [
      "signed by another key",
      () => signJWT(otherKeys.privateKey, { sub: "user" }),
    ],
    ["expired", () => signJWT(keys.privateKey, { exp: nowInSeconds() - 60 })],
  ])(
    "replies with ERROR and no scene data for a %s jwt",
    async (_, makeToken) => {
      const { handler } = setup();
      storeScene([{ id: "a", fileId: "f1" }]);
      const { event, sourcePostMessage } = createMessage({
        type: "REQUEST_SCENE",
        jwt: await makeToken(),
      });

      await handler(event);

      expect(sourcePostMessage).toHaveBeenCalledTimes(1);
      expect(sourcePostMessage).toHaveBeenCalledWith(
        { type: "ERROR", message: "Failed to verify JWT" },
        { targetOrigin: PLUS_ORIGIN },
      );
      expect(getFilesMock).not.toHaveBeenCalled();
    },
  );

  it("replies with ERROR when the public key is not configured", async () => {
    vi.stubEnv("VITE_APP_PLUS_EXPORT_PUBLIC_KEY", "");
    const { handler } = setup();
    storeScene([{ id: "a" }]);
    const { event, sourcePostMessage } = createMessage({
      type: "REQUEST_SCENE",
      jwt: await signJWT(keys.privateKey, { sub: "user" }),
    });

    await handler(event);

    expect(sourcePostMessage).toHaveBeenCalledWith(
      { type: "ERROR", message: "Failed to verify JWT" },
      { targetOrigin: PLUS_ORIGIN },
    );
  });

  it("replies with SCENE_DATA from local storage for a valid jwt", async () => {
    const { handler } = setup();
    const elements = [
      { id: "rect", type: "rectangle" },
      { id: "img", type: "image", fileId: "f1" },
    ];
    storeScene(elements);
    const files = { loadedFiles: [{ id: "f1" }], erroredFiles: new Map() };
    getFilesMock.mockResolvedValue(files);
    const { event, sourcePostMessage } = createMessage({
      type: "REQUEST_SCENE",
      jwt: await signJWT(keys.privateKey, { exp: nowInSeconds() + 60 }),
    });

    await handler(event);

    expect(getFilesMock).toHaveBeenCalledWith(["f1"]);
    expect(sourcePostMessage).toHaveBeenCalledTimes(1);
    expect(sourcePostMessage).toHaveBeenCalledWith(
      {
        type: "SCENE_DATA",
        elements,
        appState: { viewBackgroundColor: "#123456" },
        files,
      },
      { targetOrigin: PLUS_ORIGIN },
    );
  });

  it.each([
    [
      "the scene is empty",
      () => storeScene([]),
      "Scene is empty, nothing to export.",
    ],
    ["nothing is stored", () => {}, "Elements or appstate is missing."],
    [
      "stored elements are corrupted",
      () => {
        storeScene([{ id: "a" }]);
        localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS, "{bad");
      },
      "Failed to parse scene data.",
    ],
  ])(
    "replies with ERROR when %s",
    async (_, prepareStorage, expectedMessage) => {
      const { handler } = setup();
      prepareStorage();
      const { event, sourcePostMessage } = createMessage({
        type: "REQUEST_SCENE",
        jwt: await signJWT(keys.privateKey, { sub: "user" }),
      });

      await handler(event);

      expect(sourcePostMessage).toHaveBeenCalledTimes(1);
      expect(sourcePostMessage).toHaveBeenCalledWith(
        { type: "ERROR", message: expectedMessage },
        { targetOrigin: PLUS_ORIGIN },
      );
    },
  );

  it("removes its message listener on unmount", () => {
    const { handler, unmount, removeEventListener } = setup();

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith("message", handler);
  });
});
