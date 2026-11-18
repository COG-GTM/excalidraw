import { isLocalLink, normalizeLink, toValidURL } from "../src/url";

describe("normalizeLink", () => {
  // NOTE not an extensive XSS test suite, just to check if we're not
  // regressing in sanitization
  it("should sanitize links", () => {
    expect(
      // eslint-disable-next-line no-script-url
      normalizeLink(`javascript://%0aalert(document.domain)`).startsWith(
        // eslint-disable-next-line no-script-url
        `javascript:`,
      ),
    ).toBe(false);
    expect(normalizeLink("ola")).toBe("ola");
    expect(normalizeLink(" ola")).toBe("ola");

    expect(normalizeLink("https://www.excalidraw.com")).toBe(
      "https://www.excalidraw.com",
    );
    expect(normalizeLink("www.excalidraw.com")).toBe("www.excalidraw.com");
    expect(normalizeLink("/ola")).toBe("/ola");
    expect(normalizeLink("http://test")).toBe("http://test");
    expect(normalizeLink("ftp://test")).toBe("ftp://test");
    expect(normalizeLink("file://")).toBe("file://");
    expect(normalizeLink("file://")).toBe("file://");
    expect(normalizeLink("[test](https://test)")).toBe("[test](https://test)");
    expect(normalizeLink("[[test]]")).toBe("[[test]]");
    expect(normalizeLink("<test>")).toBe("<test>");
    expect(normalizeLink("test&")).toBe("test&");
  });
});

describe("isLocalLink", () => {
  it("detects same-origin and relative links", () => {
    expect(isLocalLink(`${window.location.origin}/foo`)).toBe(true);
    expect(isLocalLink("/foo")).toBe(true);
    expect(isLocalLink("https://example.com/foo")).toBe(false);
    expect(isLocalLink(null)).toBe(false);
  });
});

describe("toValidURL", () => {
  it("turns relative links into absolute ones", () => {
    expect(toValidURL("/foo")).toBe(`${window.location.origin}/foo`);
  });

  it("keeps valid absolute URLs", () => {
    expect(toValidURL(" https://excalidraw.com/a ")).toBe(
      "https://excalidraw.com/a",
    );
  });

  it("returns about:blank for invalid or unsafe links", () => {
    expect(toValidURL("not a url")).toBe("about:blank");
    // eslint-disable-next-line no-script-url
    expect(toValidURL("javascript:alert(1)")).toBe("about:blank");
  });

  it("returns empty links as-is after trimming", () => {
    expect(normalizeLink("   ")).toBe("");
  });
});
