import {
  MQ_MAX_HEIGHT_LANDSCAPE,
  MQ_MAX_MOBILE,
  MQ_MAX_TABLET,
  MQ_MAX_WIDTH_LANDSCAPE,
  MQ_MIN_TABLET,
  createUserAgentDescriptor,
  deriveStylesPanelMode,
  getFormFactor,
  isMobileBreakpoint,
  isTabletBreakpoint,
  loadDesktopUIModePreference,
  setDesktopUIMode,
} from "@excalidraw/common";

import type { EditorInterface } from "@excalidraw/common";

const STORAGE_KEY = "excalidraw.desktopUIMode";

const createEditorInterface = (
  overrides: Partial<EditorInterface>,
): EditorInterface => ({
  formFactor: "desktop",
  desktopUIMode: "full",
  userAgent: { isMobileDevice: false, platform: "other" },
  isTouchScreen: false,
  canFitSidebar: true,
  isLandscape: true,
  ...overrides,
});

const overriddenNavigatorProps = new Set<string>();

const setNavigatorProp = (key: string, value: unknown) => {
  Object.defineProperty(window.navigator, key, {
    value,
    configurable: true,
  });
  overriddenNavigatorProps.add(key);
};

const setMatchMedia = (matches: (query: string) => boolean) => {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) => ({ matches: matches(query), media: query } as any),
  );
};

afterEach(() => {
  for (const key of overriddenNavigatorProps) {
    delete (window.navigator as any)[key];
  }
  overriddenNavigatorProps.clear();
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) => ({ matches: false, media: query } as any),
  );
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("breakpoints", () => {
  it("treats narrow widths as mobile", () => {
    expect(isMobileBreakpoint(MQ_MAX_MOBILE, 2000)).toBe(true);
    expect(isMobileBreakpoint(MQ_MAX_MOBILE + 1, 2000)).toBe(false);
  });

  it("treats short landscape viewports as mobile", () => {
    expect(
      isMobileBreakpoint(
        MQ_MAX_WIDTH_LANDSCAPE - 1,
        MQ_MAX_HEIGHT_LANDSCAPE - 1,
      ),
    ).toBe(true);
    expect(
      isMobileBreakpoint(MQ_MAX_WIDTH_LANDSCAPE, MQ_MAX_HEIGHT_LANDSCAPE - 1),
    ).toBe(false);
    expect(
      isMobileBreakpoint(MQ_MAX_WIDTH_LANDSCAPE - 1, MQ_MAX_HEIGHT_LANDSCAPE),
    ).toBe(false);
  });

  it("detects tablets by min and max side in either orientation", () => {
    expect(isTabletBreakpoint(MQ_MIN_TABLET, MQ_MAX_TABLET)).toBe(true);
    expect(isTabletBreakpoint(MQ_MAX_TABLET, MQ_MIN_TABLET)).toBe(true);
    expect(isTabletBreakpoint(MQ_MIN_TABLET - 1, MQ_MAX_TABLET)).toBe(false);
    expect(isTabletBreakpoint(MQ_MIN_TABLET, MQ_MAX_TABLET + 1)).toBe(false);
  });
});

describe("getFormFactor", () => {
  it("returns phone, tablet or desktop based on editor size", () => {
    expect(getFormFactor(400, 800)).toBe("phone");
    expect(getFormFactor(800, 1100)).toBe("tablet");
    expect(getFormFactor(1920, 1080)).toBe("desktop");
  });

  it("prefers phone over tablet for short landscape viewports", () => {
    expect(getFormFactor(900, 450)).toBe("phone");
  });
});

describe("deriveStylesPanelMode", () => {
  it("maps phone to mobile and tablet to compact", () => {
    expect(
      deriveStylesPanelMode(createEditorInterface({ formFactor: "phone" })),
    ).toBe("mobile");
    expect(
      deriveStylesPanelMode(createEditorInterface({ formFactor: "tablet" })),
    ).toBe("compact");
  });

  it("uses the desktop UI mode on desktop", () => {
    expect(
      deriveStylesPanelMode(
        createEditorInterface({ formFactor: "desktop", desktopUIMode: "full" }),
      ),
    ).toBe("full");
    expect(
      deriveStylesPanelMode(
        createEditorInterface({
          formFactor: "desktop",
          desktopUIMode: "compact",
        }),
      ),
    ).toBe("compact");
  });
});

describe("createUserAgentDescriptor", () => {
  it("reports 'other' for a non-empty UA and 'unknown' for an empty one", () => {
    expect(createUserAgentDescriptor("Mozilla/5.0").platform).toBe("other");
    expect(createUserAgentDescriptor("").platform).toBe("unknown");
  });

  it("treats a desktop platform without client hints as non-mobile", () => {
    setNavigatorProp("platform", "Win32");
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
  });

  it("trusts client hints reporting a mobile device", () => {
    setNavigatorProp("userAgentData", { mobile: true, platform: "Android" });
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(true);
  });

  it("treats desktop OS client hints as non-mobile", () => {
    for (const platform of ["Windows", "macOS", "Linux", "Chrome OS"]) {
      setNavigatorProp("userAgentData", { mobile: false, platform });
      expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
    }
  });

  it("detects android tablets from client hints via touch media queries", () => {
    setNavigatorProp("userAgentData", { mobile: false, platform: "Android" });

    setMatchMedia(() => true);
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(true);

    setMatchMedia((query) => query === "(hover: none)");
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
  });

  it("falls back to UA heuristics for unknown client-hint platforms", () => {
    setNavigatorProp("userAgentData", { platform: "" });
    expect(createUserAgentDescriptor("x").isMobileDevice).toBe(false);
  });
});

describe("user agent detection at module load", () => {
  const importFresh = async () => {
    vi.resetModules();
    return import("@excalidraw/common/editorInterface");
  };

  afterEach(() => {
    vi.resetModules();
  });

  it("detects iOS devices", async () => {
    setNavigatorProp("platform", "iPhone");
    setNavigatorProp(
      "userAgent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
    );
    const mod = await importFresh();

    expect(mod.isIOS).toBe(true);
    expect(mod.isDarwin).toBe(true);
    expect(mod.isSafari).toBe(true);
    expect(mod.createUserAgentDescriptor("x")).toEqual({
      isMobileDevice: true,
      platform: "ios",
    });
  });

  it("detects android phones and tablets from the legacy UA", async () => {
    setNavigatorProp("platform", "Linux armv8l");
    setNavigatorProp(
      "userAgent",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0 Mobile Safari/537.36",
    );
    const mod = await importFresh();

    expect(mod.isAndroid).toBe(true);
    expect(mod.isChrome).toBe(true);
    expect(mod.isSafari).toBe(false);

    setMatchMedia(() => true);
    expect(mod.createUserAgentDescriptor("x")).toEqual({
      isMobileDevice: true,
      platform: "android",
    });

    setMatchMedia(() => false);
    expect(mod.createUserAgentDescriptor("x").isMobileDevice).toBe(false);
  });

  it("detects Windows platforms", async () => {
    setNavigatorProp("platform", "Win32");
    const mod = await importFresh();
    expect(mod.isWindows).toBe(true);
    expect(mod.isDarwin).toBe(false);
  });

  it("detects Brave via navigator.brave", async () => {
    const { isBrave } = await importFresh();
    expect(isBrave()).toBe(false);

    function isBraveFn() {
      return true;
    }
    setNavigatorProp("brave", { isBrave: isBraveFn });
    Object.defineProperty(isBraveFn, "name", { value: "isBrave" });
    expect(isBrave()).toBe(true);
  });
});

describe("desktop UI mode preference", () => {
  it("returns null when nothing is stored", () => {
    expect(loadDesktopUIModePreference()).toBe(null);
  });

  it("persists and loads valid modes", () => {
    expect(setDesktopUIMode("compact")).toBe("compact");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("compact");
    expect(loadDesktopUIModePreference()).toBe("compact");

    expect(setDesktopUIMode("full")).toBe("full");
    expect(loadDesktopUIModePreference()).toBe("full");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem(STORAGE_KEY, "mobile");
    expect(loadDesktopUIModePreference()).toBe(null);
  });

  it("rejects invalid modes without persisting them", () => {
    expect(setDesktopUIMode("mobile" as any)).toBe(undefined);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
  });

  it("swallows storage errors", () => {
    const getItem = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(loadDesktopUIModePreference()).toBe(null);
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(setDesktopUIMode("compact")).toBe("compact");
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, "compact");
  });
});
