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

describe("normalizeLink edge cases", () => {
  it("returns empty string for blank input", () => {
    expect(normalizeLink("")).toBe("");
    expect(normalizeLink("   ")).toBe("");
  });

  it("escapes double quotes", () => {
    expect(normalizeLink('https://a.com/"x"')).toBe(
      "https://a.com/&quot;x&quot;",
    );
  });
});

describe("isLocalLink", () => {
  it("treats same-origin and root-relative links as local", () => {
    expect(isLocalLink(`${location.origin}/foo`)).toBe(true);
    expect(isLocalLink("/foo")).toBe(true);
  });

  it("treats external, relative and empty links as non-local", () => {
    expect(isLocalLink("https://example.com/foo")).toBe(false);
    expect(isLocalLink("foo")).toBe(false);
    expect(isLocalLink("")).toBe(false);
    expect(isLocalLink(null)).toBe(false);
  });
});

describe("toValidURL", () => {
  it("keeps valid absolute URLs", () => {
    expect(toValidURL("https://excalidraw.com/path?q=1")).toBe(
      "https://excalidraw.com/path?q=1",
    );
  });

  it("makes root-relative links fully qualified", () => {
    expect(toValidURL("/foo")).toBe(`${location.origin}/foo`);
    expect(toValidURL("  /foo ")).toBe(`${location.origin}/foo`);
  });

  it("returns about:blank for unparseable links", () => {
    expect(toValidURL("www.excalidraw.com")).toBe("about:blank");
    expect(toValidURL("not a url")).toBe("about:blank");
  });

  it("returns about:blank for script URLs", () => {
    // eslint-disable-next-line no-script-url
    expect(toValidURL("javascript:alert(1)")).toBe("about:blank");
  });
});
