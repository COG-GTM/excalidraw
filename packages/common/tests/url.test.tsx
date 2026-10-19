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

describe("toValidURL", () => {
  it("should expand relative links to fully-qualified same-origin urls", () => {
    expect(toValidURL("/foo")).toBe(`${location.origin}/foo`);
    expect(toValidURL(" /foo/bar?x=1#y")).toBe(
      `${location.origin}/foo/bar?x=1#y`,
    );
  });

  it("should pass through valid absolute urls", () => {
    expect(toValidURL("https://www.excalidraw.com")).toBe(
      "https://www.excalidraw.com",
    );
    expect(toValidURL("https://example.com/path?q=1#hash")).toBe(
      "https://example.com/path?q=1#hash",
    );
    expect(toValidURL("  http://test  ")).toBe("http://test");
  });

  it("should return about:blank for unparseable urls", () => {
    expect(toValidURL("ola")).toBe("about:blank");
    expect(toValidURL("www.excalidraw.com")).toBe("about:blank");
    expect(toValidURL("[[test]]")).toBe("about:blank");
    expect(toValidURL("")).toBe("about:blank");
  });

  it("should not return dangerous urls", () => {
    // eslint-disable-next-line no-script-url
    expect(toValidURL("javascript:alert(1)")).toBe("about:blank");
    // eslint-disable-next-line no-script-url
    expect(toValidURL("javascript://%0aalert(document.domain)")).toBe(
      "about:blank",
    );
    expect(toValidURL("data:text/html,<script>alert(1)</script>")).toBe(
      "about:blank",
    );
  });
});

describe("isLocalLink", () => {
  it("should return false for empty links", () => {
    expect(isLocalLink(null)).toBe(false);
    expect(isLocalLink("")).toBe(false);
  });

  it("should return true for relative links", () => {
    expect(isLocalLink("/")).toBe(true);
    expect(isLocalLink("/foo")).toBe(true);
  });

  it("should return true for same-origin links", () => {
    expect(isLocalLink(location.origin)).toBe(true);
    expect(isLocalLink(`${location.origin}/foo?bar=1`)).toBe(true);
  });

  it("should return false for cross-origin links", () => {
    expect(isLocalLink("https://other.example.com/foo")).toBe(false);
    expect(isLocalLink("foo")).toBe(false);
  });
});
