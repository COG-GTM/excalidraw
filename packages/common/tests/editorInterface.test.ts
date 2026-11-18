import {
  MQ_MAX_HEIGHT_LANDSCAPE,
  MQ_MAX_MOBILE,
  MQ_MAX_TABLET,
  MQ_MAX_WIDTH_LANDSCAPE,
  MQ_MIN_TABLET,
  createUserAgentDescriptor,
  deriveStylesPanelMode,
  getFormFactor,
  isBrave,
  isMobileBreakpoint,
  isTabletBreakpoint,
  loadDesktopUIModePreference,
  setDesktopUIMode,
} from "../src/editorInterface";

import type { EditorInterface } from "../src/editorInterface";

const STORAGE_KEY = "excalidraw.desktopUIMode";

const editorInterface = (
  formFactor: EditorInterface["formFactor"],
  desktopUIMode: EditorInterface["desktopUIMode"] = "full",
): EditorInterface => ({
  formFactor,
  desktopUIMode,
  userAgent: { isMobileDevice: false, platform: "other" },
  isTouchScreen: false,
  canFitSidebar: true,
  isLandscape: true,
});

const setUserAgentData = (value: unknown) => {
  Object.defineProperty(navigator, "userAgentData", {
    value,
    configurable: true,
  });
};

const originalMatchMedia = window.matchMedia;

const mockMatchMedia = (matches: boolean) => {
  window.matchMedia = ((query: string) =>
    ({ matches, media: query } as MediaQueryList)) as typeof window.matchMedia;
};

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("breakpoints", () => {
  it("isMobileBreakpoint", () => {
    expect(isMobileBreakpoint(MQ_MAX_MOBILE, 1000)).toBe(true);
    expect(isMobileBreakpoint(MQ_MAX_MOBILE + 1, 1000)).toBe(false);
    // short landscape phones
    expect(
      isMobileBreakpoint(
        MQ_MAX_WIDTH_LANDSCAPE - 1,
        MQ_MAX_HEIGHT_LANDSCAPE - 1,
      ),
    ).toBe(true);
    expect(
      isMobileBreakpoint(MQ_MAX_WIDTH_LANDSCAPE, MQ_MAX_HEIGHT_LANDSCAPE - 1),
    ).toBe(false);
  });

  it("isTabletBreakpoint", () => {
    expect(isTabletBreakpoint(MQ_MIN_TABLET, MQ_MAX_TABLET)).toBe(true);
    expect(isTabletBreakpoint(MQ_MAX_TABLET, MQ_MIN_TABLET)).toBe(true);
    expect(isTabletBreakpoint(MQ_MIN_TABLET - 1, MQ_MAX_TABLET)).toBe(false);
    expect(isTabletBreakpoint(MQ_MIN_TABLET, MQ_MAX_TABLET + 1)).toBe(false);
  });

  it("getFormFactor", () => {
    expect(getFormFactor(400, 800)).toBe("phone");
    expect(getFormFactor(800, 1100)).toBe("tablet");
    expect(getFormFactor(1440, 900)).toBe("desktop");
  });
});

describe("deriveStylesPanelMode", () => {
  it("maps form factors to panel modes", () => {
    expect(deriveStylesPanelMode(editorInterface("phone"))).toBe("mobile");
    expect(deriveStylesPanelMode(editorInterface("tablet"))).toBe("compact");
    expect(deriveStylesPanelMode(editorInterface("desktop", "full"))).toBe(
      "full",
    );
    expect(deriveStylesPanelMode(editorInterface("desktop", "compact"))).toBe(
      "compact",
    );
  });
});

describe("isBrave", () => {
  afterEach(() => {
    delete (navigator as any).brave;
  });

  it("detects the Brave navigator API", () => {
    expect(isBrave()).toBe(false);
    const braveCheck = () => true;
    Object.defineProperty(braveCheck, "name", { value: "isBrave" });
    (navigator as any).brave = { isBrave: braveCheck };
    expect(isBrave()).toBe(true);
  });
});

describe("createUserAgentDescriptor", () => {
  afterEach(() => {
    delete (navigator as any).userAgentData;
  });

  it("reports the platform from the user agent string", () => {
    expect(createUserAgentDescriptor("Mozilla/5.0").platform).toBe("other");
    expect(createUserAgentDescriptor("").platform).toBe("unknown");
  });

  it("is not a mobile device on a desktop jsdom user agent", () => {
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
  });

  it("trusts userAgentData.mobile", () => {
    setUserAgentData({ mobile: true, platform: "Android" });
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(true);
  });

  it("treats desktop userAgentData platforms as non-mobile", () => {
    for (const platform of ["Windows", "macOS", "Linux", "Chrome OS"]) {
      setUserAgentData({ mobile: false, platform });
      expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
    }
  });

  it("detects android tablets via touch media queries", () => {
    setUserAgentData({ mobile: false, platform: "Android" });

    mockMatchMedia(true);
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(true);

    mockMatchMedia(false);
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
  });

  it("falls through unknown userAgentData platforms", () => {
    setUserAgentData({ platform: undefined });
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
  });
});

describe("user agent detection (module-level)", () => {
  const originalUA = navigator.userAgent;

  afterEach(() => {
    delete (navigator as any).userAgent;
    delete (navigator as any).platform;
    vi.resetModules();
  });

  const importWithNavigator = async (userAgent: string, platform = "") => {
    Object.defineProperty(navigator, "userAgent", {
      value: userAgent,
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: platform,
      configurable: true,
    });
    vi.resetModules();
    return import("../src/editorInterface");
  };

  it("detects android phones and tablets from the legacy UA", async () => {
    const phone = await importWithNavigator(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile Safari",
    );
    expect(phone.isAndroid).toBe(true);
    expect(phone.createUserAgentDescriptor(navigator.userAgent).platform).toBe(
      "android",
    );

    mockMatchMedia(true);
    expect(
      phone.createUserAgentDescriptor(navigator.userAgent).isMobileDevice,
    ).toBe(true);

    mockMatchMedia(false);
    expect(
      phone.createUserAgentDescriptor(navigator.userAgent).isMobileDevice,
    ).toBe(false);
  });

  it("detects iOS devices", async () => {
    const ios = await importWithNavigator(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari",
      "iPhone",
    );
    expect(ios.isIOS).toBe(true);
    expect(ios.isDarwin).toBe(true);
    expect(ios.isSafari).toBe(true);
    expect(ios.isChrome).toBe(false);
    expect(ios.createUserAgentDescriptor(navigator.userAgent)).toEqual({
      isMobileDevice: true,
      platform: "ios",
    });
  });

  it("detects Windows Chrome as desktop", async () => {
    const win = await importWithNavigator(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
      "Win32",
    );
    expect(win.isWindows).toBe(true);
    expect(win.isChrome).toBe(true);
    expect(win.isSafari).toBe(false);
    expect(
      win.createUserAgentDescriptor(navigator.userAgent).isMobileDevice,
    ).toBe(false);
  });

  it("restores the original user agent after each test", () => {
    expect(navigator.userAgent).toBe(originalUA);
  });
});

describe("desktop UI mode preference", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("returns null when nothing valid is stored", () => {
    expect(loadDesktopUIModePreference()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, "weird");
    expect(loadDesktopUIModePreference()).toBeNull();
  });

  it("persists and loads valid modes", () => {
    expect(setDesktopUIMode("compact")).toBe("compact");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("compact");
    expect(loadDesktopUIModePreference()).toBe("compact");

    expect(setDesktopUIMode("full")).toBe("full");
    expect(loadDesktopUIModePreference()).toBe("full");
  });

  it("ignores invalid modes", () => {
    expect(setDesktopUIMode("bogus" as any)).toBeUndefined();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("swallows storage errors", () => {
    const getItem = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    try {
      expect(loadDesktopUIModePreference()).toBeNull();
      expect(setDesktopUIMode("compact")).toBe("compact");
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
