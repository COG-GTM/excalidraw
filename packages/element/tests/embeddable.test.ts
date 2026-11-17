import { FONT_FAMILY, VERTICAL_ALIGN } from "@excalidraw/common";

import {
  createPlaceholderEmbeddableLabel,
  embeddableURLValidator,
  getEmbedLink,
  maybeParseEmbedSrc,
} from "../src/embeddable";
import { newEmbeddableElement, newIframeElement } from "../src/newElement";

import type { ExcalidrawTextElement } from "../src/types";

describe("YouTube timestamp parsing", () => {
  it("should parse YouTube URLs with timestamp in seconds", () => {
    const testCases = [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90",
        expectedStart: 90,
      },
      {
        url: "https://youtu.be/dQw4w9WgXcQ?t=120",
        expectedStart: 120,
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=150",
        expectedStart: 150,
      },
    ];

    testCases.forEach(({ url, expectedStart }) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        expect(result.link).toContain(`start=${expectedStart}`);
      }
    });
  });

  it("should parse YouTube URLs with timestamp in time format", () => {
    const testCases = [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s",
        expectedStart: 90, // 1*60 + 30
      },
      {
        url: "https://youtu.be/dQw4w9WgXcQ?t=2m45s",
        expectedStart: 165, // 2*60 + 45
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s",
        expectedStart: 3723, // 1*3600 + 2*60 + 3
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s",
        expectedStart: 45,
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5m",
        expectedStart: 300, // 5*60
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2h",
        expectedStart: 7200, // 2*3600
      },
    ];

    testCases.forEach(({ url, expectedStart }) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        expect(result.link).toContain(`start=${expectedStart}`);
      }
    });
  });

  it("should handle YouTube URLs without timestamps", () => {
    const testCases = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ];

    testCases.forEach((url) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        expect(result.link).not.toContain("start=");
      }
    });
  });

  it("should handle YouTube shorts URLs with timestamps", () => {
    const url = "https://www.youtube.com/shorts/dQw4w9WgXcQ?t=30";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toContain("start=30");
    }
    // Shorts should have portrait aspect ratio
    expect(result?.intrinsicSize).toEqual({ w: 315, h: 560 });
  });

  it("should handle playlist URLs with timestamps", () => {
    const url =
      "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy1KbG5lbfgQ0-PKQY6FKYZ&t=60";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toContain("start=60");
      expect(result.link).toContain("list=PLrAXtmRdnEQy1KbG5lbfgQ0-PKQY6FKYZ");
    }
  });

  it("should handle malformed or edge case timestamps", () => {
    const testCases = [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=abc",
        expectedStart: 0, // Invalid timestamp should default to 0
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=",
        expectedStart: 0, // Empty timestamp should default to 0
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0",
        expectedStart: 0, // Zero timestamp should be handled
      },
    ];

    testCases.forEach(({ url, expectedStart }) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        if (expectedStart === 0) {
          expect(result.link).not.toContain("start=");
        } else {
          expect(result.link).toContain(`start=${expectedStart}`);
        }
      }
    });
  });

  it("should preserve other URL parameters", () => {
    const url =
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90&feature=youtu.be&list=PLtest";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toContain("start=90");
      expect(result.link).toContain("enablejsapi=1");
    }
  });
});

describe("Google Drive video embedding", () => {
  it.each([
    {
      url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?usp=sharing",
      expectedLink:
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview",
    },
    {
      url: "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      expectedLink:
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview",
    },
    {
      url: "https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      expectedLink:
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview",
    },
  ])("should normalize Google Drive link: $url", ({ url, expectedLink }) => {
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(expectedLink);
    }
    expect(result?.intrinsicSize).toEqual({ w: 560, h: 315 });
  });

  it("should preserve resourcekey when available", () => {
    const url =
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?resourcekey=0-abcdef123456";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview?resourcekey=0-abcdef123456",
      );
    }
  });

  it("should preserve timestamp when available", () => {
    const url =
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?t=9";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview?t=9",
      );
    }
  });

  it("should preserve resourcekey and timestamp together", () => {
    const url =
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?resourcekey=0-abcdef123456&t=9";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview?resourcekey=0-abcdef123456&t=9",
      );
    }
  });

  it("should validate Google Drive domain by default", () => {
    expect(
      embeddableURLValidator(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view",
        undefined,
      ),
    ).toBe(true);
  });
});

describe("getEmbedLink providers", () => {
  it("returns null for empty input", () => {
    expect(getEmbedLink(null)).toBe(null);
    expect(getEmbedLink(undefined)).toBe(null);
    expect(getEmbedLink("")).toBe(null);
  });

  it("serves repeated lookups from the cache", () => {
    const url = "https://www.youtube.com/watch?v=cacheTest01";
    const first = getEmbedLink(url);
    const cached = getEmbedLink(url);
    expect(cached).toEqual(first);
    expect(getEmbedLink(url)).toBe(cached);
  });

  it("embeds YouTube playlists via videoseries", () => {
    const result = getEmbedLink(
      "https://www.youtube.com/playlist?list=PLabc123",
    );
    expect(result?.type).toBe("video");
    expect(result?.type === "video" && result.link).toBe(
      "https://www.youtube.com/embed/videoseries?list=PLabc123&enablejsapi=1",
    );
    expect(result?.intrinsicSize).toEqual({ w: 560, h: 315 });
    expect(result?.sandbox.allowSameOrigin).toBe(true);
  });

  it("uses a portrait size for YouTube shorts", () => {
    const result = getEmbedLink("https://youtube.com/shorts/short001");
    expect(result?.type === "video" && result.link).toBe(
      "https://www.youtube.com/embed/short001?enablejsapi=1",
    );
    expect(result?.intrinsicSize).toEqual({ w: 315, h: 560 });
  });

  it("embeds numeric Vimeo ids without an error", () => {
    const result = getEmbedLink("https://vimeo.com/123456789");
    expect(result?.type).toBe("video");
    expect(result?.type === "video" && result.link).toBe(
      "https://player.vimeo.com/video/123456789?api=1",
    );
    expect(result?.error).toBeUndefined();
    expect(result?.sandbox.allowSameOrigin).toBe(true);
  });

  it("flags non-numeric Vimeo ids with a URIError", () => {
    const result = getEmbedLink("https://vimeo.com/not-a-video");
    expect(result?.type).toBe("video");
    expect(result?.error).toBeInstanceOf(URIError);
  });

  it("wraps Figma links in the Figma embed URL", () => {
    const figma = "https://www.figma.com/file/abc/Design";
    const result = getEmbedLink(figma);
    expect(result?.type).toBe("generic");
    expect(result?.type === "generic" && result.link).toBe(
      `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(
        figma,
      )}`,
    );
    expect(result?.intrinsicSize).toEqual({ w: 550, h: 550 });
  });

  it("rewrites val.town /v/ links to /embed/", () => {
    const result = getEmbedLink("https://www.val.town/v/user.myVal");
    expect(result?.type === "generic" && result.link).toBe(
      "https://www.val.town/embed/user.myVal",
    );
    const embed = getEmbedLink("https://val.town/embed/user.otherVal");
    expect(embed?.type === "generic" && embed.link).toBe(
      "https://val.town/embed/user.otherVal",
    );
  });

  it("adds embed=true to Microsoft Forms links", () => {
    const plain = getEmbedLink("https://forms.microsoft.com/r/abc");
    expect(plain?.type === "generic" && plain.link).toBe(
      "https://forms.microsoft.com/r/abc?embed=true",
    );
    const withQuery = getEmbedLink("https://forms.microsoft.com/r/abc?x=1");
    expect(withQuery?.type === "generic" && withQuery.link).toBe(
      "https://forms.microsoft.com/r/abc?x=1&embed=true",
    );
    const alreadyEmbedded = getEmbedLink(
      "https://forms.microsoft.com/r/def?embed=true",
    );
    expect(alreadyEmbedded?.type === "generic" && alreadyEmbedded.link).toBe(
      "https://forms.microsoft.com/r/def?embed=true",
    );
  });

  it("renders tweets (twitter.com and x.com) as a themed srcdoc", () => {
    const result = getEmbedLink("https://x.com/someone/status/1234567890");
    expect(result?.type).toBe("document");
    expect(result?.intrinsicSize).toEqual({ w: 480, h: 480 });
    const html = result?.type === "document" ? result.srcdoc("dark") : "";
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain("https://twitter.com/x/status/1234567890");
    expect(html.startsWith("<html><body>")).toBe(true);
  });

  it("renders Reddit posts as a themed srcdoc", () => {
    const result = getEmbedLink(
      "https://www.reddit.com/r/excalidraw/comments/abc123/my_post/",
    );
    expect(result?.type).toBe("document");
    const html = result?.type === "document" ? result.srcdoc("light") : "";
    expect(html).toContain('data-embed-theme="light"');
    expect(html).toContain(
      "https://reddit.com/r/excalidraw/comments/abc123/my_post",
    );
  });

  it("renders GitHub gists via the gist script", () => {
    const result = getEmbedLink("https://gist.github.com/someone/abcdef12");
    expect(result?.type).toBe("document");
    expect(result?.intrinsicSize).toEqual({ w: 550, h: 720 });
    const html = result?.type === "document" ? result.srcdoc("light") : "";
    expect(html).toContain(
      '<script src="https://gist.github.com/someone/abcdef12.js"></script>',
    );
    expect(result?.sandbox.allowSameOrigin).toBe(false);
  });

  it("falls back to a generic embed for unknown links", () => {
    const result = getEmbedLink("https://example.com/page");
    expect(result).toEqual({
      link: "https://example.com/page",
      intrinsicSize: { w: 560, h: 840 },
      type: "generic",
      sandbox: { allowSameOrigin: false },
    });
  });

  it("allows same-origin for wildcard-listed subdomains", () => {
    const result = getEmbedLink("https://app.simplepdf.eu/editor");
    expect(result?.sandbox.allowSameOrigin).toBe(true);
  });

  it("ignores non-Drive hosts and invalid Drive file ids", () => {
    const invalid = getEmbedLink("https://drive.google.com/open?id=bad$id");
    expect(invalid?.type).toBe("generic");
    expect(invalid?.type === "generic" && invalid.link).toBe(
      "https://drive.google.com/open?id=bad$id",
    );
  });
});

describe("maybeParseEmbedSrc", () => {
  it("extracts the tweet URL from a twitter blockquote embed", () => {
    expect(
      maybeParseEmbedSrc(
        '<blockquote class="twitter-tweet"><p>hi</p><a href="https://twitter.com/u/status/42?ref=x">x</a></blockquote>',
      ),
    ).toBe("https://twitter.com/u/status/42?ref=x");
  });

  it("extracts the post URL from a reddit blockquote embed", () => {
    expect(
      maybeParseEmbedSrc(
        '<blockquote class="reddit-embed-bq" href="https://www.reddit.com/r/a/comments/b/c/">x</blockquote>',
      ),
    ).toBe("https://www.reddit.com/r/a/comments/b/c/");
  });

  it("extracts the gist URL from a gist script tag", () => {
    expect(
      maybeParseEmbedSrc(
        '<script src="https://gist.github.com/user/abc123.js"></script>',
      ),
    ).toBe("https://gist.github.com/user/abc123");
  });

  it("normalizes giphy links to the embed URL", () => {
    expect(maybeParseEmbedSrc("https://giphy.com/gifs/AbC123")).toBe(
      "https://giphy.com/embed/AbC123",
    );
    expect(maybeParseEmbedSrc("https://giphy.com/embed/XyZ789?x=1")).toBe(
      "https://giphy.com/embed/XyZ789",
    );
  });

  it("extracts the src from a generic iframe snippet", () => {
    expect(
      maybeParseEmbedSrc(
        '<iframe width="560" src="https://example.com/embed/1" frameborder="0"></iframe>',
      ),
    ).toBe("https://example.com/embed/1");
  });

  it("returns plain strings unchanged", () => {
    expect(maybeParseEmbedSrc("https://example.com")).toBe(
      "https://example.com",
    );
  });
});

describe("embeddableURLValidator", () => {
  it("rejects empty URLs", () => {
    expect(embeddableURLValidator(null, undefined)).toBe(false);
    expect(embeddableURLValidator("", true)).toBe(false);
  });

  it("uses the default allow-list when no validator is given", () => {
    expect(
      embeddableURLValidator("https://www.figma.com/file/x", undefined),
    ).toBe(true);
    expect(
      embeddableURLValidator("https://foo.simplepdf.eu/x", undefined),
    ).toBe(true);
    expect(embeddableURLValidator("https://evil.example.com", undefined)).toBe(
      false,
    );
    expect(embeddableURLValidator("not a url", undefined)).toBe(false);
  });

  it("respects a boolean validator", () => {
    expect(embeddableURLValidator("https://evil.example.com", true)).toBe(true);
    expect(embeddableURLValidator("https://youtube.com/watch?v=x", false)).toBe(
      false,
    );
  });

  it("respects a function validator and falls back when it returns undefined", () => {
    expect(embeddableURLValidator("https://youtube.com", () => false)).toBe(
      false,
    );
    expect(embeddableURLValidator("https://evil.example.com", () => true)).toBe(
      true,
    );
    expect(embeddableURLValidator("https://youtube.com", () => undefined)).toBe(
      true,
    );
    expect(
      embeddableURLValidator("https://evil.example.com", () => undefined),
    ).toBe(false);
  });

  it("respects a RegExp validator", () => {
    expect(embeddableURLValidator("https://a.test/x", /a\.test/)).toBe(true);
    expect(embeddableURLValidator("https://youtube.com", /a\.test/)).toBe(
      false,
    );
  });

  it("matches an array of hostnames", () => {
    const allowed = ["www.example.com", "other.org"];
    expect(embeddableURLValidator("https://example.com/page", allowed)).toBe(
      true,
    );
    expect(embeddableURLValidator("https://other.org/x", allowed)).toBe(true);
    expect(embeddableURLValidator("https://youtube.com", allowed)).toBe(false);
  });

  it("matches an array of RegExps", () => {
    const allowed = [/^https:\/\/cdn\./, /\.example\.net\//];
    expect(embeddableURLValidator("https://cdn.other.com/x", allowed)).toBe(
      true,
    );
    expect(embeddableURLValidator("https://a.example.net/x", allowed)).toBe(
      true,
    );
    expect(embeddableURLValidator("https://youtube.com", allowed)).toBe(false);
  });
});

describe("createPlaceholderEmbeddableLabel", () => {
  it("labels empty embeddables and centers the text on the element", () => {
    const element = newEmbeddableElement({
      type: "embeddable",
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      strokeColor: "#ff0000",
    });
    const label = createPlaceholderEmbeddableLabel(
      element,
    ) as ExcalidrawTextElement;
    expect(label.type).toBe("text");
    expect(label.originalText.replace(/\n/g, "")).toBe("Empty Web-Embed");
    expect(label.strokeColor).toBe("#ff0000");
    expect(label.textAlign).toBe("center");
    expect(label.verticalAlign).toBe(VERTICAL_ALIGN.MIDDLE);
    expect(label.fontFamily).toBe(FONT_FAMILY.Helvetica);
  });

  it("uses the link as label and black for transparent strokes", () => {
    const element = newEmbeddableElement({
      type: "embeddable",
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      strokeColor: "transparent",
      link: "https://example.com",
    });
    const label = createPlaceholderEmbeddableLabel(
      element,
    ) as ExcalidrawTextElement;
    expect(label.originalText.replace(/\n/g, "")).toBe("https://example.com");
    expect(label.strokeColor).toBe("black");
  });

  it("labels iframe elements and scales the font with width", () => {
    const narrow = newIframeElement({
      type: "iframe",
      x: 0,
      y: 0,
      width: 150,
      height: 100,
    });
    const wide = newIframeElement({
      type: "iframe",
      x: 0,
      y: 0,
      width: 600,
      height: 100,
    });
    const narrowLabel = createPlaceholderEmbeddableLabel(
      narrow,
    ) as ExcalidrawTextElement;
    const wideLabel = createPlaceholderEmbeddableLabel(
      wide,
    ) as ExcalidrawTextElement;
    expect(wideLabel.originalText.replace(/\n/g, "")).toBe("IFrame element");
    expect(wideLabel.fontSize).toBeGreaterThan(narrowLabel.fontSize);
    expect(wideLabel.fontSize).toBeCloseTo(600 / "IFrame element".length);
  });
});
