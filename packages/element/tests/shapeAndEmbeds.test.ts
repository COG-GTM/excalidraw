import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { LocalPoint } from "@excalidraw/math";

import { cropElement } from "../src/cropElement";
import { getEmbedLink, embeddableURLValidator } from "../src/embeddable";
import { ShapeCache } from "../src/shape";

import type {
  Arrowhead,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawRectangleElement,
} from "../src/types";

const lp = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

const renderConfig = {
  isExporting: true,
  canvasBackgroundColor: "#ffffff",
  embedsValidationStatus: new Map(),
  theme: "light" as const,
};

const generate = (element: ExcalidrawElement) =>
  ShapeCache.generateElementShape(element as any, renderConfig);

describe("ShapeCache.generateElementShape", () => {
  const arrowheads: Arrowhead[] = [
    "arrow",
    "bar",
    "circle",
    "circle_outline",
    "triangle",
    "triangle_outline",
    "diamond",
    "diamond_outline",
    "cardinality_one",
    "cardinality_many",
    "cardinality_one_or_many",
    "cardinality_exactly_one",
    "cardinality_zero_or_one",
    "cardinality_zero_or_many",
  ] as Arrowhead[];

  it.each(arrowheads)("generates %s arrowheads", (arrowhead) => {
    for (const elbowed of [false, true]) {
      for (const roundness of [null, { type: 2 }] as const) {
        const arrow = API.createElement({
          type: "arrow",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          elbowed,
          roundness: elbowed ? null : roundness,
          points: elbowed
            ? [lp(0, 0), lp(100, 0), lp(100, 100), lp(200, 100)]
            : [lp(0, 0), lp(100, 50), lp(200, 100)],
          startArrowhead: arrowhead,
          endArrowhead: arrowhead,
          strokeWidth: 4,
          strokeStyle: "dashed",
        });
        const shape = generate(arrow);
        expect(Array.isArray(shape)).toBe(true);
        expect((shape as unknown[]).length).toBeGreaterThan(1);
      }
    }
  });

  it("generates shapes for every element type and style", () => {
    const types = [
      "rectangle",
      "diamond",
      "ellipse",
      "line",
      "freedraw",
      "text",
      "image",
      "frame",
      "magicframe",
      "embeddable",
      "iframe",
    ] as const;

    for (const type of types) {
      for (const strokeStyle of ["solid", "dashed", "dotted"] as const) {
        for (const fillStyle of [
          "solid",
          "hachure",
          "cross-hatch",
          "zigzag",
        ] as const) {
          for (const roundness of [null, { type: 3 }] as const) {
            const element = API.createElement({
              type: type as any,
              x: 0,
              y: 0,
              width: 120,
              height: 80,
              strokeStyle,
              fillStyle,
              roughness: 2,
              backgroundColor: "#ff0000",
              roundness,
              ...(type === "line" || type === "freedraw"
                ? {
                    points: [lp(0, 0), lp(40, 60), lp(80, 10), lp(120, 80)],
                  }
                : {}),
            });
            expect(() => generate(element)).not.toThrow();
          }
        }
      }
    }
  });

  it("generates closed polygon lines and tiny elements", () => {
    const polygon = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      polygon: true,
      backgroundColor: "#00ff00",
      points: [lp(0, 0), lp(100, 0), lp(50, 80), lp(0, 0)],
    });
    expect(generate(polygon)).toBeTruthy();

    const dot = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      points: [lp(0, 0)],
    });
    expect(() => generate(dot)).not.toThrow();

    const zero = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      points: [lp(0, 0), lp(0, 0)],
    });
    expect(() => generate(zero)).not.toThrow();
  });

  it("caches non-exporting shapes per element and theme", () => {
    const rect = API.createElement({
      type: "rectangle",
      width: 10,
    }) as ExcalidrawRectangleElement;
    const config = { ...renderConfig, isExporting: false };
    const first = ShapeCache.generateElementShape(rect, config);
    expect(ShapeCache.get(rect, "light")).toBe(first);
    expect(ShapeCache.get(rect, "dark")).toBeUndefined();
    ShapeCache.delete(rect);
    expect(ShapeCache.get(rect, null)).toBeUndefined();
    ShapeCache.generateElementShape(rect, config);
    ShapeCache.destroy();
    expect(ShapeCache.get(rect, null)).toBeUndefined();
  });
});

describe("getEmbedLink providers", () => {
  it.each([
    ["https://vimeo.com/123456789", "video"],
    ["https://player.vimeo.com/video/123456789", "video"],
    ["https://www.figma.com/file/abc/Design", "generic"],
    ["https://gist.github.com/user/0123abcd", "document"],
    ["https://forms.microsoft.com/r/abc", "generic"],
    ["https://twitter.com/user/status/1234567890", "document"],
    ["https://x.com/user/status/1234567890", "document"],
    ["https://val.town/v/user.myVal", "generic"],
    ["https://giphy.com/gifs/abc123", "generic"],
    [
      "https://www.reddit.com/r/excalidraw/comments/abc123/some_title/",
      "document",
    ],
    ["https://www.youtube.com/shorts/abcdef12345", "video"],
    ["https://www.youtube.com/playlist?list=PL12345", "video"],
    ["https://excalidraw.com/#room=abc,def", "generic"],
    ["https://example.com/page", "generic"],
  ])("parses %s", (url, type) => {
    const link = getEmbedLink(url);
    expect(link).not.toBe(null);
    expect(link!.type).toBe(type);
    // second call is served from cache
    expect(getEmbedLink(url)).toEqual(link);
  });

  it("parses html embed snippets", () => {
    const gist = getEmbedLink(
      '<script src="https://gist.github.com/user/0123abcd.js"></script>',
    );
    expect(gist).not.toBe(null);

    const tweet = getEmbedLink(
      '<blockquote class="twitter-tweet"><a href="https://twitter.com/user/status/123">x</a></blockquote>',
    );
    expect(tweet).not.toBe(null);

    const reddit = getEmbedLink(
      '<blockquote class="reddit-embed-bq"><a href="https://www.reddit.com/r/a/comments/b/c/">x</a></blockquote>',
    );
    expect(reddit).not.toBe(null);

    const iframe = getEmbedLink(
      '<iframe src="https://www.youtube.com/embed/abcdef12345"></iframe>',
    );
    expect(iframe).not.toBe(null);
  });

  it("returns null for empty links", () => {
    expect(getEmbedLink(null)).toBe(null);
    expect(getEmbedLink("")).toBe(null);
  });

  it("validates embeddable urls", () => {
    expect(
      embeddableURLValidator("https://www.youtube.com/watch?v=abc", undefined),
    ).toBe(true);
    expect(embeddableURLValidator("https://evil.example/", undefined)).toBe(
      false,
    );
    expect(embeddableURLValidator(undefined, undefined)).toBe(false);
    expect(embeddableURLValidator("https://evil.example/", () => true)).toBe(
      true,
    );
    expect(
      embeddableURLValidator("https://evil.example/", ["evil.example"]),
    ).toBe(true);
    expect(embeddableURLValidator("https://evil.example/", [/evil/])).toBe(
      true,
    );
    expect(
      embeddableURLValidator("https://evil.example/", () => undefined),
    ).toBe(false);
  });
});

describe("cropElement", () => {
  const handles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;

  const createImage = (
    overrides: Partial<ExcalidrawImageElement> = {},
  ): ExcalidrawImageElement =>
    ({
      ...API.createElement({
        type: "image",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
      }),
      ...overrides,
    } as ExcalidrawImageElement);

  const variants: Partial<ExcalidrawImageElement>[] = [
    {},
    { angle: (Math.PI / 6) as any },
    { scale: [-1, -1] },
    {
      crop: {
        x: 20,
        y: 10,
        width: 300,
        height: 150,
        naturalWidth: 400,
        naturalHeight: 200,
      },
      width: 150,
      height: 75,
    },
  ];

  it.each(handles)("crops with the %s handle", (handle) => {
    for (const overrides of variants) {
      const image = createImage(overrides);
      const map = new Map([[image.id, image]]);
      for (const [px, py] of [
        [60, 30],
        [150, 80],
        [-50, -50],
        [400, 300],
      ]) {
        for (const ratio of [undefined, 1]) {
          const res = cropElement(image, map, handle, 400, 200, px, py, ratio);
          expect(Number.isFinite(res.width)).toBe(true);
          expect(Number.isFinite(res.height)).toBe(true);
          expect(res.width).toBeGreaterThan(0);
          expect(res.height).toBeGreaterThan(0);
        }
      }
    }
  });
});
