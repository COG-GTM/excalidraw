import { ELEMENT_LINK_KEY } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  canCreateLinkFromElements,
  defaultGetElementLinkFromSelection,
  getLinkIdAndTypeFromSelection,
  isElementLink,
  parseElementLinkFromURL,
} from "../src/elementLink";

const appState = (overrides: Partial<AppState> = {}) =>
  ({ ...getDefaultAppState(), ...overrides } as AppState);

describe("elementLink", () => {
  it("defaultGetElementLinkFromSelection appends the element id to the current url", () => {
    const link = defaultGetElementLinkFromSelection("abc", "element");
    const url = new URL(link);

    expect(url.host).toBe(window.location.host);
    expect(url.searchParams.get(ELEMENT_LINK_KEY)).toBe("abc");
  });

  it("defaultGetElementLinkFromSelection falls back to the raw url if URL parsing fails", () => {
    const OriginalURL = window.URL;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    window.URL = class {
      constructor() {
        throw new Error("boom");
      }
    } as unknown as typeof URL;

    try {
      expect(defaultGetElementLinkFromSelection("abc", "element")).toBe(
        window.location.href,
      );
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      window.URL = OriginalURL;
      errorSpy.mockRestore();
    }
  });

  it("canCreateLinkFromElements requires a single element or a shared group", () => {
    const a = API.createElement({ groupIds: ["g1"] });
    const b = API.createElement({ groupIds: ["g1"] });
    const c = API.createElement({ groupIds: [] });

    expect(canCreateLinkFromElements([])).toBe(false);
    expect(canCreateLinkFromElements([c])).toBe(true);
    expect(canCreateLinkFromElements([a, b])).toBe(true);
    expect(canCreateLinkFromElements([a, c])).toBe(false);
  });

  it("getLinkIdAndTypeFromSelection", () => {
    const a = API.createElement({ groupIds: ["inner", "outer"] });
    const b = API.createElement({ groupIds: ["inner", "outer"] });
    const c = API.createElement({});

    expect(getLinkIdAndTypeFromSelection([], appState())).toBe(null);
    expect(getLinkIdAndTypeFromSelection([a, c], appState())).toBe(null);

    expect(getLinkIdAndTypeFromSelection([c], appState())).toEqual({
      id: c.id,
      type: "element",
    });

    // prefers the selected group
    expect(
      getLinkIdAndTypeFromSelection(
        [a, b],
        appState({ selectedGroupIds: { outer: true } }),
      ),
    ).toEqual({ id: "outer", type: "group" });

    // falls back to the innermost group of the first element
    expect(getLinkIdAndTypeFromSelection([a, b], appState())).toEqual({
      id: "inner",
      type: "group",
    });
  });

  it("isElementLink only accepts same-host urls with the element key", () => {
    const sameHost = new URL(window.location.href);
    sameHost.searchParams.set(ELEMENT_LINK_KEY, "abc");

    expect(isElementLink(sameHost.toString())).toBe(true);
    expect(isElementLink(window.location.href)).toBe(false);
    expect(
      isElementLink(`https://other.example.com/?${ELEMENT_LINK_KEY}=abc`),
    ).toBe(false);
    expect(isElementLink("not a url")).toBe(false);
  });

  it("parseElementLinkFromURL", () => {
    expect(
      parseElementLinkFromURL(
        `https://excalidraw.com/?${ELEMENT_LINK_KEY}=my-id`,
      ),
    ).toBe("my-id");
    expect(parseElementLinkFromURL("https://excalidraw.com/")).toBe(null);
    expect(parseElementLinkFromURL("not a url")).toBe(null);
  });
});
