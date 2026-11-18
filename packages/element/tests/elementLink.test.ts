import { ELEMENT_LINK_KEY } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  canCreateLinkFromElements,
  defaultGetElementLinkFromSelection,
  getLinkIdAndTypeFromSelection,
  isElementLink,
  parseElementLinkFromURL,
} from "../src/elementLink";

const appStateWithGroups = (selectedGroupIds: AppState["selectedGroupIds"]) =>
  ({ selectedGroupIds } as AppState);

describe("defaultGetElementLinkFromSelection", () => {
  it("adds the element id to the current page URL", () => {
    const link = defaultGetElementLinkFromSelection("abc123", "element");
    const url = new URL(link);

    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe(window.location.pathname);
    expect(url.searchParams.get(ELEMENT_LINK_KEY)).toBe("abc123");
  });

  it("replaces an existing element param instead of duplicating it", () => {
    const link = defaultGetElementLinkFromSelection("first", "group");
    window.history.pushState({}, "", link);
    try {
      const next = new URL(
        defaultGetElementLinkFromSelection("second", "group"),
      );
      expect(next.searchParams.getAll(ELEMENT_LINK_KEY)).toEqual(["second"]);
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("falls back to the bare page URL if it cannot be parsed", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.stubGlobal(
      "URL",
      class {
        constructor() {
          throw new TypeError("Invalid URL");
        }
      },
    );
    try {
      const link = defaultGetElementLinkFromSelection("abc", "element");
      expect(link).toBe(window.location.href);
      expect(link).not.toContain(`${ELEMENT_LINK_KEY}=`);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      consoleError.mockRestore();
    }
  });
});

describe("canCreateLinkFromElements", () => {
  it("allows a single element", () => {
    expect(canCreateLinkFromElements([API.createElement({})])).toBe(true);
  });

  it("disallows an empty selection", () => {
    expect(canCreateLinkFromElements([])).toBe(false);
  });

  it("allows multiple elements that share a group", () => {
    const a = API.createElement({ groupIds: ["g1"] });
    const b = API.createElement({ groupIds: ["g1"] });
    expect(canCreateLinkFromElements([a, b])).toBe(true);
  });

  it("disallows multiple elements that are not all in one group", () => {
    const a = API.createElement({ groupIds: ["g1"] });
    const b = API.createElement({ groupIds: ["g2"] });
    const c = API.createElement({});
    expect(canCreateLinkFromElements([a, b])).toBe(false);
    expect(canCreateLinkFromElements([a, c])).toBe(false);
  });
});

describe("getLinkIdAndTypeFromSelection", () => {
  it("returns null for an empty selection", () => {
    expect(getLinkIdAndTypeFromSelection([], appStateWithGroups({}))).toBe(
      null,
    );
  });

  it("returns the element id for a single selected element", () => {
    const el = API.createElement({ id: "el-1", groupIds: ["g1"] });
    expect(getLinkIdAndTypeFromSelection([el], appStateWithGroups({}))).toEqual(
      { id: "el-1", type: "element" },
    );
  });

  it("prefers the selected group id for grouped multi-selection", () => {
    const a = API.createElement({ groupIds: ["inner", "outer"] });
    const b = API.createElement({ groupIds: ["inner", "outer"] });
    expect(
      getLinkIdAndTypeFromSelection(
        [a, b],
        appStateWithGroups({ outer: true }),
      ),
    ).toEqual({ id: "outer", type: "group" });
  });

  it("falls back to the first element's innermost group id", () => {
    const a = API.createElement({ groupIds: ["inner", "outer"] });
    const b = API.createElement({ groupIds: ["inner", "outer"] });
    expect(
      getLinkIdAndTypeFromSelection([a, b], appStateWithGroups({})),
    ).toEqual({ id: "inner", type: "group" });
  });

  it("returns null for a multi-selection across groups", () => {
    const a = API.createElement({ groupIds: ["g1"] });
    const b = API.createElement({ groupIds: ["g2"] });
    expect(
      getLinkIdAndTypeFromSelection([a, b], appStateWithGroups({ g1: true })),
    ).toBe(null);
  });
});

describe("isElementLink", () => {
  it("accepts same-host URLs that carry the element param", () => {
    expect(
      isElementLink(
        `${window.location.origin}/?${ELEMENT_LINK_KEY}=abc&other=1`,
      ),
    ).toBe(true);
  });

  it("rejects same-host URLs without the element param", () => {
    expect(isElementLink(`${window.location.origin}/?foo=abc`)).toBe(false);
  });

  it("rejects element links pointing at a different host", () => {
    expect(isElementLink(`https://example.com/?${ELEMENT_LINK_KEY}=abc`)).toBe(
      false,
    );
  });

  it("rejects strings that are not URLs", () => {
    expect(isElementLink("not a url")).toBe(false);
    expect(isElementLink("")).toBe(false);
  });
});

describe("parseElementLinkFromURL", () => {
  it("returns the element id from the URL", () => {
    expect(
      parseElementLinkFromURL(`https://example.com/?${ELEMENT_LINK_KEY}=xyz`),
    ).toBe("xyz");
  });

  it("returns an empty string when the param has no value", () => {
    expect(
      parseElementLinkFromURL(`https://example.com/?${ELEMENT_LINK_KEY}=`),
    ).toBe("");
  });

  it("returns null when the URL has no element param", () => {
    expect(parseElementLinkFromURL("https://example.com/?id=xyz")).toBe(null);
  });

  it("returns null for invalid URLs", () => {
    expect(parseElementLinkFromURL("::::")).toBe(null);
  });
});
