import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, LineSegment, LocalPoint } from "@excalidraw/math";

import { getBindingSideMidPoint } from "../src/binding";
import { getElementBounds } from "../src/bounds";
import {
  getFlipAdjustedCropPosition,
  getUncroppedImageElement,
  getUncroppedWidthAndHeight,
} from "../src/cropElement";
import {
  createPlaceholderEmbeddableLabel,
  maybeParseEmbedSrc,
} from "../src/embeddable";
import {
  filterElementsEligibleAsFrameChildren,
  getElementsInNewFrame,
  getElementsIntersectingFrame,
  getElementsOverlappingFrame,
  groupByFrameLikes,
  groupsAreAtLeastIntersectingTheFrame,
  groupsAreCompletelyOutOfFrame,
} from "../src/frame";
import { getFreedrawOutlineAsSegments } from "../src/renderElement";
import { toggleLinePolygonState } from "../src/shape";
import {
  debugClear,
  debugCloseFrame,
  debugDrawBounds,
  debugDrawCubicBezier,
  debugDrawHitVolume,
  debugDrawLine,
  debugDrawPoint,
  debugDrawPoints,
  debugDrawPolygon,
} from "../src/visualdebug";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawIframeLikeElement,
  ExcalidrawImageElement,
  ExcalidrawLineElement,
  FixedPoint,
  FixedPointBinding,
  NonDeletedExcalidrawElement,
} from "../src/types";

const gp = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);
const lp = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

describe("visualdebug", () => {
  beforeEach(() => {
    window.visualDebug = { data: [] };
  });
  afterAll(() => {
    delete window.visualDebug;
  });

  it("collects debug primitives into frames", () => {
    debugDrawPoint(gp(10, 10), { color: "red", permanent: true });
    debugDrawPoint(gp(10, 10), { fuzzy: true });
    debugDrawLine([gp(0, 0), gp(10, 10)] as LineSegment<GlobalPoint>);
    debugDrawLine(
      [
        [gp(0, 0), gp(10, 10)],
        [gp(10, 10), gp(20, 0)],
      ] as LineSegment<GlobalPoint>[],
      { color: "blue" },
    );
    debugDrawCubicBezier([gp(0, 0), gp(5, 5), gp(10, 5), gp(15, 0)] as any, {
      color: "green",
    });
    debugDrawPolygon([gp(0, 0), gp(5, 5)]);
    debugDrawBounds([0, 0, 10, 10]);
    debugDrawBounds([
      [0, 0, 10, 10],
      [5, 5, 20, 20],
    ]);
    debugDrawPoints(
      { x: 1, y: 1, points: [lp(0, 0), lp(10, 10)] },
      { color: "pink" },
    );

    const frame = window.visualDebug!.data[0];
    expect(frame.length).toBeGreaterThan(10);
    expect(frame[0]).toMatchObject({ color: "red", permanent: true });

    debugCloseFrame();
    expect(window.visualDebug!.data).toHaveLength(2);

    debugClear();
    expect(window.visualDebug!.data).toEqual([]);
  });

  it("debugDrawHitVolume draws shapes but skips open lines", () => {
    const rect = API.createElement({ type: "rectangle", width: 50 });
    debugDrawHitVolume(rect, arrayToMap([rect]), { rays: 8, fill: true });
    expect(window.visualDebug!.data[0].length).toBeGreaterThan(0);

    debugClear();
    const line = API.createElement({
      type: "line",
      points: [lp(0, 0), lp(10, 10)],
    });
    debugDrawHitVolume(line, arrayToMap([line]));
    expect(window.visualDebug!.data).toEqual([]);
  });
});

describe("getBindingSideMidPoint", () => {
  const fixedPoints: FixedPoint[] = [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
    [0.05, 0.05],
    [0.95, 0.05],
    [0.95, 0.95],
    [0.05, 0.95],
    [0.8, 0.1],
    [0.9, 0.2],
    [0.2, 0.9],
    [0.1, 0.8],
  ].map(([x, y]) => [x, y] as FixedPoint);

  const binding = (elementId: string, fixedPoint: FixedPoint) =>
    ({ elementId, fixedPoint, mode: "orbit" } as FixedPointBinding);

  it.each(["rectangle", "diamond", "ellipse"] as const)(
    "returns a side midpoint near the %s outline",
    (type) => {
      const el = API.createElement({
        type,
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      });
      const map = arrayToMap([el]);
      const [x1, y1, x2, y2] = getElementBounds(el, map);

      for (const fp of fixedPoints) {
        const mid = getBindingSideMidPoint(binding(el.id, fp), map);
        expect(mid).not.toBe(null);
        expect(mid![0]).toBeGreaterThanOrEqual(x1 - 1);
        expect(mid![0]).toBeLessThanOrEqual(x2 + 1);
        expect(mid![1]).toBeGreaterThanOrEqual(y1 - 1);
        expect(mid![1]).toBeLessThanOrEqual(y2 + 1);
      }
    },
  );

  it("handles rotated elements", () => {
    const el = API.createElement({
      type: "diamond",
      width: 100,
      height: 100,
      angle: Math.PI / 4,
    });
    const map = arrayToMap([el]);
    for (const fp of fixedPoints) {
      expect(getBindingSideMidPoint(binding(el.id, fp), map)).not.toBe(null);
    }
  });

  it("returns null for missing, deleted or non-bindable elements", () => {
    const deleted = API.createElement({ type: "rectangle", isDeleted: true });
    const line = API.createElement({ type: "line" });
    const map = arrayToMap([deleted, line]);

    expect(getBindingSideMidPoint(binding("missing", [0.5, 0]), map)).toBe(
      null,
    );
    expect(getBindingSideMidPoint(binding(deleted.id, [0.5, 0]), map)).toBe(
      null,
    );
    expect(getBindingSideMidPoint(binding(line.id, [0.5, 0]), map)).toBe(null);
  });
});

describe("crop helpers", () => {
  const crop = {
    x: 10,
    y: 20,
    width: 50,
    height: 40,
    naturalWidth: 200,
    naturalHeight: 100,
  };
  const createImage = (scale: [number, number] = [1, 1]) =>
    ({
      ...API.createElement({
        type: "image",
        x: 0,
        y: 0,
        width: 100,
        height: 80,
      }),
      crop,
      scale,
    } as ExcalidrawImageElement);

  it("getUncroppedWidthAndHeight scales by the crop ratio", () => {
    expect(getUncroppedWidthAndHeight(createImage())).toEqual({
      width: 400,
      height: 200,
    });
    const uncropped = API.createElement({
      type: "image",
      width: 30,
      height: 20,
    }) as ExcalidrawImageElement;
    expect(getUncroppedWidthAndHeight(uncropped)).toEqual({
      width: 30,
      height: 20,
    });
  });

  it("getUncroppedImageElement expands to the full image", () => {
    const image = createImage();
    const res = getUncroppedImageElement(image, arrayToMap([image]));
    expect(res.width).toBeCloseTo(400);
    expect(res.height).toBeCloseTo(200);
    expect(res.x).toBeCloseTo(-20);
    expect(res.y).toBeCloseTo(-40);
    expect(res.crop).toBe(null);

    const plain = API.createElement({
      type: "image",
    }) as ExcalidrawImageElement;
    expect(getUncroppedImageElement(plain, arrayToMap([plain]))).toBe(plain);
  });

  it("getFlipAdjustedCropPosition accounts for flips", () => {
    // scaled to the uncropped size (400x200)
    expect(getFlipAdjustedCropPosition(createImage())).toEqual({
      x: 20,
      y: 40,
    });
    expect(getFlipAdjustedCropPosition(createImage(), true)).toEqual({
      x: 10,
      y: 20,
    });

    const flipped = getFlipAdjustedCropPosition(createImage([-1, -1]), true)!;
    expect(flipped.x).toBeCloseTo(200 - 50 - 10);
    expect(flipped.y).toBeCloseTo(100 - 40 - 20);

    const plain = API.createElement({
      type: "image",
    }) as ExcalidrawImageElement;
    expect(getFlipAdjustedCropPosition(plain)).toBe(null);
  });
});

describe("embeddable helpers", () => {
  it("createPlaceholderEmbeddableLabel picks a label per element", () => {
    const iframe = API.createElement({
      type: "iframe",
      width: 400,
      height: 300,
    }) as unknown as ExcalidrawIframeLikeElement;
    const empty = API.createElement({
      type: "embeddable",
      width: 400,
      height: 300,
    }) as unknown as ExcalidrawIframeLikeElement;
    const linked = {
      ...API.createElement({
        type: "embeddable",
        width: 400,
        height: 300,
      }),
      link: "https://example.com",
    } as unknown as ExcalidrawIframeLikeElement;

    expect(createPlaceholderEmbeddableLabel(iframe)).toMatchObject({
      type: "text",
      text: "IFrame element",
    });
    expect(createPlaceholderEmbeddableLabel(empty)).toMatchObject({
      text: "Empty Web-Embed",
    });
    expect(createPlaceholderEmbeddableLabel(linked)).toMatchObject({
      text: "https://example.com",
    });
  });

  it("maybeParseEmbedSrc extracts urls from embed snippets", () => {
    expect(
      maybeParseEmbedSrc(
        `<blockquote class="twitter-tweet"><a href="https://twitter.com/x/status/1">x</a></blockquote>`,
      ),
    ).toBe("https://twitter.com/x/status/1");
    expect(
      maybeParseEmbedSrc(
        `<blockquote class="reddit-embed-bq"><a href="https://www.reddit.com/r/a/comments/b">x</a></blockquote>`,
      ),
    ).toBe("https://www.reddit.com/r/a/comments/b");
    expect(
      maybeParseEmbedSrc(
        `<script src="https://gist.github.com/user/abc.js"></script>`,
      ),
    ).toBe("https://gist.github.com/user/abc");
    expect(maybeParseEmbedSrc("https://giphy.com/gifs/abc123")).toBe(
      "https://giphy.com/embed/abc123",
    );
    expect(
      maybeParseEmbedSrc(`<iframe src="https://example.com/embed"></iframe>`),
    ).toBe("https://example.com/embed");
    expect(maybeParseEmbedSrc("https://example.com")).toBe(
      "https://example.com",
    );
  });
});

describe("frame helpers", () => {
  const frame = API.createElement({
    type: "frame",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  }) as ExcalidrawFrameLikeElement;
  const otherFrame = API.createElement({
    type: "frame",
    x: 1000,
    y: 0,
    width: 100,
    height: 100,
  }) as ExcalidrawFrameLikeElement;
  const inside = API.createElement({ x: 10, y: 10, width: 20, height: 20 });
  const crossing = API.createElement({
    x: 190,
    y: 10,
    width: 50,
    height: 20,
  });
  const outside = API.createElement({ x: 500, y: 500, width: 20, height: 20 });
  const groupIn1 = API.createElement({
    x: 50,
    y: 50,
    width: 10,
    height: 10,
    groupIds: ["gIn"],
  });
  const groupIn2 = API.createElement({
    x: 70,
    y: 50,
    width: 10,
    height: 10,
    groupIds: ["gIn"],
  });
  const groupPartial1 = API.createElement({
    x: 50,
    y: 150,
    width: 10,
    height: 10,
    groupIds: ["gPartial"],
  });
  const groupPartial2 = API.createElement({
    x: 600,
    y: 150,
    width: 10,
    height: 10,
    groupIds: ["gPartial"],
  });
  const childOfOther = API.createElement({
    x: 1010,
    y: 10,
    width: 10,
    height: 10,
    frameId: otherFrame.id,
  });

  const elements = [
    frame,
    otherFrame,
    inside,
    crossing,
    outside,
    groupIn1,
    groupIn2,
    groupPartial1,
    groupPartial2,
    childOfOther,
  ] as NonDeletedExcalidrawElement[];
  const map = arrayToMap(elements);

  it("getElementsIntersectingFrame", () => {
    expect(getElementsIntersectingFrame(elements, frame)).toContain(crossing);
    expect(getElementsIntersectingFrame(elements, frame)).not.toContain(inside);
  });

  it("group helpers relative to a frame", () => {
    expect(groupsAreAtLeastIntersectingTheFrame(elements, ["gIn"], frame)).toBe(
      true,
    );
    expect(groupsAreAtLeastIntersectingTheFrame(elements, [], frame)).toBe(
      true,
    );
    expect(groupsAreCompletelyOutOfFrame(elements, ["gIn"], frame)).toBe(false);
    expect(groupsAreCompletelyOutOfFrame(elements, [], frame)).toBe(true);
  });

  it("groupByFrameLikes groups children by frame", () => {
    const grouped = groupByFrameLikes([
      { ...inside, frameId: frame.id },
      childOfOther,
      outside,
    ]);
    expect(grouped.get(frame.id)).toHaveLength(1);
    expect(grouped.get(otherFrame.id)).toEqual([childOfOther]);
  });

  it("getElementsInNewFrame omits partial groups", () => {
    const res = getElementsInNewFrame(elements, frame, map);
    expect(res).toContain(inside);
    expect(res).toContain(groupIn1);
    expect(res).toContain(groupIn2);
    expect(res).not.toContain(groupPartial1);
    expect(res).not.toContain(outside);
  });

  it("filterElementsEligibleAsFrameChildren excludes frames and their children", () => {
    const res = filterElementsEligibleAsFrameChildren(elements, frame);
    expect(res).not.toContain(otherFrame);
    expect(res).not.toContain(childOfOther);
    expect(res).not.toContain(frame);
    expect(res).toContain(inside);
  });

  it("getElementsOverlappingFrame", () => {
    const res = getElementsOverlappingFrame(elements, frame, map);
    expect(res).toContain(inside);
    expect(res).toContain(crossing);
    expect(res).not.toContain(outside);
  });
});

describe("shape helpers", () => {
  it("toggleLinePolygonState closes and reopens lines", () => {
    const open = API.createElement({
      type: "line",
      points: [lp(0, 0), lp(100, 0), lp(100, 100)],
    }) as ExcalidrawLineElement;

    const closed = toggleLinePolygonState(open, true)!;
    expect(closed.polygon).toBe(true);
    expect(closed.points).toHaveLength(4);
    expect(closed.points[3]).toEqual(lp(0, 0));

    const nearlyClosed = API.createElement({
      type: "line",
      points: [lp(0, 0), lp(100, 0), lp(100, 100), lp(1, 1)],
    }) as ExcalidrawLineElement;
    const merged = toggleLinePolygonState(nearlyClosed, true)!;
    expect(merged.points).toHaveLength(4);
    expect(merged.points[3]).toEqual(lp(0, 0));

    const reopened = toggleLinePolygonState(nearlyClosed, false)!;
    expect(reopened.polygon).toBe(false);
    expect(reopened.points).toEqual(nearlyClosed.points);

    const tooShort = API.createElement({
      type: "line",
      points: [lp(0, 0), lp(10, 0)],
    }) as ExcalidrawLineElement;
    expect(toggleLinePolygonState(tooShort, true)).toBe(null);
  });

  it("getFreedrawOutlineAsSegments returns closed segments", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      points: [lp(0, 0), lp(10, 5), lp(20, 0), lp(30, 10)],
    }) as ExcalidrawFreeDrawElement;
    const outline: [number, number][] = [
      [0, 0],
      [30, 0],
      [30, 10],
      [0, 10],
    ];

    const segments = getFreedrawOutlineAsSegments(
      freedraw,
      outline,
      arrayToMap([freedraw]),
    );
    expect(segments.length).toBeGreaterThanOrEqual(outline.length - 1);

    const rotated = getFreedrawOutlineAsSegments(
      { ...freedraw, angle: Math.PI / 2 } as ExcalidrawFreeDrawElement,
      outline,
      arrayToMap([freedraw]),
    );
    expect(rotated.length).toBe(segments.length);
  });
});
