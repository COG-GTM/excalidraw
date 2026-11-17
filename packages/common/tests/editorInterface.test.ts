import { vi } from "vitest";

import {
  deriveStylesPanelMode,
  getFormFactor,
  isMobileBreakpoint,
  isTabletBreakpoint,
  loadDesktopUIModePreference,
  setDesktopUIMode,
  type EditorInterface,
} from "../src/editorInterface";

const STORAGE_KEY = "excalidraw.desktopUIMode";

const makeEditorInterface = (
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

describe("editorInterface", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(STORAGE_KEY);
  });

  describe("isMobileBreakpoint()", () => {
    it("matches narrow widths and short landscape viewports", () => {
      expect(isMobileBreakpoint(599, 900)).toBe(true);
      expect(isMobileBreakpoint(600, 900)).toBe(false);
      expect(isMobileBreakpoint(999, 499)).toBe(true);
      expect(isMobileBreakpoint(1000, 499)).toBe(false);
      expect(isMobileBreakpoint(999, 500)).toBe(false);
    });
  });

  describe("isTabletBreakpoint()", () => {
    it("requires both sides within tablet bounds in any orientation", () => {
      expect(isTabletBreakpoint(768, 1024)).toBe(true);
      expect(isTabletBreakpoint(1024, 768)).toBe(true);
      expect(isTabletBreakpoint(599, 1024)).toBe(false);
      expect(isTabletBreakpoint(800, 1181)).toBe(false);
    });
  });

  describe("getFormFactor()", () => {
    it("classifies phone, tablet and desktop sizes", () => {
      expect(getFormFactor(375, 812)).toBe("phone");
      expect(getFormFactor(820, 1180)).toBe("tablet");
      expect(getFormFactor(1440, 900)).toBe("desktop");
    });
  });

  describe("deriveStylesPanelMode()", () => {
    it("maps form factors to panel modes", () => {
      expect(
        deriveStylesPanelMode(makeEditorInterface({ formFactor: "phone" })),
      ).toBe("mobile");
      expect(
        deriveStylesPanelMode(makeEditorInterface({ formFactor: "tablet" })),
      ).toBe("compact");
    });

    it("uses the desktop UI mode on desktop", () => {
      expect(
        deriveStylesPanelMode(
          makeEditorInterface({ desktopUIMode: "compact" }),
        ),
      ).toBe("compact");
      expect(
        deriveStylesPanelMode(makeEditorInterface({ desktopUIMode: "full" })),
      ).toBe("full");
    });
  });

  describe("desktop UI mode preference", () => {
    it("returns null when nothing valid is stored", () => {
      expect(loadDesktopUIModePreference()).toBeNull();
      localStorage.setItem(STORAGE_KEY, "weird");
      expect(loadDesktopUIModePreference()).toBeNull();
    });

    it("persists and reloads a valid mode", () => {
      expect(setDesktopUIMode("compact")).toBe("compact");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("compact");
      expect(loadDesktopUIModePreference()).toBe("compact");

      expect(setDesktopUIMode("full")).toBe("full");
      expect(loadDesktopUIModePreference()).toBe("full");
    });

    it("ignores invalid modes", () => {
      expect(setDesktopUIMode("mobile" as any)).toBeUndefined();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("tolerates storage access errors", () => {
      localStorage.setItem(STORAGE_KEY, "compact");
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
      expect(loadDesktopUIModePreference()).toBeNull();
      expect(setDesktopUIMode("compact")).toBe("compact");
      expect(getItem).toHaveBeenCalled();
      expect(setItem).toHaveBeenCalled();
    });
  });

  describe("createUserAgentDescriptor()", () => {
    const originalMatchMedia = window.matchMedia;

    const stubNavigator = ({
      platform = "",
      userAgent = "",
      userAgentData,
    }: {
      platform?: string;
      userAgent?: string;
      userAgentData?: { mobile?: boolean; platform?: string };
    }) => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
      if (userAgentData) {
        Object.defineProperty(navigator, "userAgentData", {
          value: userAgentData,
          configurable: true,
        });
      }
    };

    const stubTouchMedia = (touch: boolean) => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: touch,
        media: query,
      })) as any;
    };

    const loadModule = async () => {
      vi.resetModules();
      return import("../src/editorInterface");
    };

    afterEach(() => {
      delete (navigator as any).userAgentData;
      window.matchMedia = originalMatchMedia;
    });

    it("prefers client hints that report a mobile device", async () => {
      stubNavigator({
        platform: "Linux armv8l",
        userAgent: "Mozilla/5.0 (X11; Linux)",
        userAgentData: { mobile: true, platform: "Android" },
      });
      const { createUserAgentDescriptor } = await loadModule();
      expect(createUserAgentDescriptor("ua").isMobileDevice).toBe(true);
    });

    it("treats non-mobile Android client hints as tablet only with touch media", async () => {
      stubNavigator({
        userAgentData: { mobile: false, platform: "Android" },
      });
      const { createUserAgentDescriptor } = await loadModule();

      stubTouchMedia(true);
      expect(createUserAgentDescriptor("ua").isMobileDevice).toBe(true);
      stubTouchMedia(false);
      expect(createUserAgentDescriptor("ua").isMobileDevice).toBe(false);
    });

    it("treats desktop client hint platforms as desktop", async () => {
      stubNavigator({
        userAgentData: { mobile: false, platform: "macOS" },
      });
      const { createUserAgentDescriptor } = await loadModule();
      expect(createUserAgentDescriptor("ua")).toEqual({
        isMobileDevice: false,
        platform: "other",
      });
    });

    it("detects iOS devices", async () => {
      stubNavigator({
        platform: "iPhone",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      });
      const { createUserAgentDescriptor, isIOS } = await loadModule();
      expect(isIOS).toBe(true);
      expect(createUserAgentDescriptor("ua")).toEqual({
        isMobileDevice: true,
        platform: "ios",
      });
    });

    it("falls back to the Android user agent and touch media", async () => {
      stubNavigator({
        platform: "Linux armv8l",
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile",
      });
      const { createUserAgentDescriptor, isAndroid } = await loadModule();
      expect(isAndroid).toBe(true);

      stubTouchMedia(true);
      expect(createUserAgentDescriptor("ua")).toEqual({
        isMobileDevice: true,
        platform: "android",
      });
      stubTouchMedia(false);
      expect(createUserAgentDescriptor("ua").isMobileDevice).toBe(false);
    });

    it("treats desktop platforms without client hints as desktop", async () => {
      stubNavigator({
        platform: "Win32",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      });
      const { createUserAgentDescriptor, isWindows } = await loadModule();
      expect(isWindows).toBe(true);
      expect(createUserAgentDescriptor("ua")).toEqual({
        isMobileDevice: false,
        platform: "other",
      });
    });

    it("reports unknown platform for an empty user agent string", async () => {
      stubNavigator({ platform: "", userAgent: "" });
      const { createUserAgentDescriptor } = await loadModule();
      expect(createUserAgentDescriptor("")).toEqual({
        isMobileDevice: false,
        platform: "unknown",
      });
    });
  });
});
