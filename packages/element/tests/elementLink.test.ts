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

const appStateWithGroups = (selectedGroupIds: Record<string, true>) =>
  ({ selectedGroupIds } as unknown as AppState);

describe("defaultGetElementLinkFromSelection", () => {
  it("adds the element id as a search param of the current URL", () => {
    const link = defaultGetElementLinkFromSelection("abc123", "element");
    const url = new URL(link);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get(ELEMENT_LINK_KEY)).toBe("abc123");
  });

  it("overwrites an existing element param instead of appending", () => {
    const first = defaultGetElementLinkFromSelection("first", "group");
    window.history.pushState({}, "", first);
    try {
      const url = new URL(
        defaultGetElementLinkFromSelection("second", "group"),
      );
      expect(url.searchParams.getAll(ELEMENT_LINK_KEY)).toEqual(["second"]);
    } finally {
      window.history.pushState({}, "", "/");
    }
  });
});

describe("canCreateLinkFromElements", () => {
  it("allows a single element", () => {
    expect(canCreateLinkFromElements([API.createElement({})])).toBe(true);
  });

  it("allows multiple elements only when they share a group", () => {
    const grouped = [
      API.createElement({ groupIds: ["g1"] }),
      API.createElement({ groupIds: ["g1"] }),
    ];
    expect(canCreateLinkFromElements(grouped)).toBe(true);

    const ungrouped = [API.createElement({}), API.createElement({})];
    expect(canCreateLinkFromElements(ungrouped)).toBe(false);
  });

  it("rejects an empty selection", () => {
    expect(canCreateLinkFromElements([])).toBe(false);
  });
});

describe("getLinkIdAndTypeFromSelection", () => {
  it("returns null for an empty selection", () => {
    expect(getLinkIdAndTypeFromSelection([], appStateWithGroups({}))).toBe(
      null,
    );
  });

  it("returns the element id for a single element", () => {
    const el = API.createElement({ id: "el-1" });
    expect(getLinkIdAndTypeFromSelection([el], appStateWithGroups({}))).toEqual(
      { id: "el-1", type: "element" },
    );
  });

  it("returns the selected group id for a grouped selection", () => {
    const elements = [
      API.createElement({ groupIds: ["inner", "outer"] }),
      API.createElement({ groupIds: ["inner", "outer"] }),
    ];
    expect(
      getLinkIdAndTypeFromSelection(
        elements,
        appStateWithGroups({ outer: true }),
      ),
    ).toEqual({ id: "outer", type: "group" });
  });

  it("falls back to the first element's innermost group id", () => {
    const elements = [
      API.createElement({ groupIds: ["inner", "outer"] }),
      API.createElement({ groupIds: ["inner", "outer"] }),
    ];
    expect(
      getLinkIdAndTypeFromSelection(elements, appStateWithGroups({})),
    ).toEqual({ id: "inner", type: "group" });
  });

  it("returns null for multiple elements without a common group", () => {
    const elements = [
      API.createElement({ groupIds: ["a"] }),
      API.createElement({ groupIds: ["b"] }),
    ];
    expect(
      getLinkIdAndTypeFromSelection(elements, appStateWithGroups({})),
    ).toBe(null);
  });
});

describe("isElementLink", () => {
  const sameHost = (search: string) =>
    `${window.location.protocol}//${window.location.host}/${search}`;

  it("is true for same-host URLs carrying the element param", () => {
    expect(isElementLink(sameHost(`?${ELEMENT_LINK_KEY}=abc`))).toBe(true);
  });

  it("is false without the element param", () => {
    expect(isElementLink(sameHost("?other=abc"))).toBe(false);
  });

  it("is false for other hosts", () => {
    expect(isElementLink(`https://example.com/?${ELEMENT_LINK_KEY}=abc`)).toBe(
      false,
    );
  });

  it("is false for strings that are not URLs", () => {
    expect(isElementLink("not a url")).toBe(false);
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
      parseElementLinkFromURL(`https://example.com/?${ELEMENT_LINK_KEY}`),
    ).toBe("");
  });

  it("returns null when the param is missing", () => {
    expect(parseElementLinkFromURL("https://example.com/?foo=bar")).toBe(null);
  });

  it("returns null for invalid URLs", () => {
    expect(parseElementLinkFromURL("::::")).toBe(null);
  });
});
