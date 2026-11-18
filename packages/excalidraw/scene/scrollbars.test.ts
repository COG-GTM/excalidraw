import { arrayToMap } from "@excalidraw/common";

import { defaultLang, languages, setLanguage } from "../i18n";
import { API } from "../tests/helpers/api";

import {
  SCROLLBAR_MARGIN,
  SCROLLBAR_WIDTH,
  getScrollBars,
  isOverScrollBars,
} from "./scrollbars";

import type { InteractiveCanvasAppState } from "../types";
import type { RenderableElementsMap } from "./types";

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 800;

const getAppState = (
  overrides: Partial<InteractiveCanvasAppState> = {},
): InteractiveCanvasAppState =>
  ({
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    ...overrides,
  } as InteractiveCanvasAppState);

const elementsMap = () =>
  arrayToMap([
    API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }),
  ]) as unknown as RenderableElementsMap;

describe("getScrollBars", () => {
  afterEach(async () => {
    await setLanguage(defaultLang);
  });

  it("returns no scrollbars when there are no elements", () => {
    expect(
      getScrollBars(
        new Map() as RenderableElementsMap,
        VIEWPORT_WIDTH,
        VIEWPORT_HEIGHT,
        getAppState(),
      ),
    ).toEqual({ horizontal: null, vertical: null });
  });

  it("returns no scrollbars when the viewport contains all elements", () => {
    expect(
      getScrollBars(
        elementsMap(),
        VIEWPORT_WIDTH,
        VIEWPORT_HEIGHT,
        getAppState(),
      ),
    ).toEqual({ horizontal: null, vertical: null });
  });

  it("computes the horizontal scrollbar when scrolled past the content", () => {
    // viewport spans x: 500..1500, content spans x: 0..100
    const { horizontal, vertical } = getScrollBars(
      elementsMap(),
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      getAppState({ scrollX: -500 }),
    );

    expect(vertical).toBeNull();
    expect(horizontal).not.toBeNull();

    const extendedSceneWidth = 1500;
    const scrollWidthOffset = SCROLLBAR_MARGIN * 2 + SCROLLBAR_WIDTH * 2;
    expect(horizontal!.x).toBeCloseTo(
      SCROLLBAR_MARGIN +
        SCROLLBAR_WIDTH +
        (500 / extendedSceneWidth) * VIEWPORT_WIDTH,
    );
    expect(horizontal!.y).toBe(
      VIEWPORT_HEIGHT - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
    );
    expect(horizontal!.width).toBeCloseTo(
      VIEWPORT_WIDTH * (VIEWPORT_WIDTH / extendedSceneWidth) -
        scrollWidthOffset,
    );
    expect(horizontal!.height).toBe(SCROLLBAR_WIDTH);
    expect(horizontal!.deltaMultiplier).toBeCloseTo(2.25);
  });

  it("computes the vertical scrollbar on the right in LTR", () => {
    const { horizontal, vertical } = getScrollBars(
      elementsMap(),
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      getAppState({ scrollY: -400 }),
    );

    expect(horizontal).toBeNull();
    expect(vertical).not.toBeNull();

    const extendedSceneHeight = 1200;
    expect(vertical!.x).toBe(
      VIEWPORT_WIDTH - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
    );
    expect(vertical!.y).toBeCloseTo(
      SCROLLBAR_MARGIN +
        SCROLLBAR_WIDTH +
        (400 / extendedSceneHeight) * VIEWPORT_HEIGHT,
    );
    expect(vertical!.width).toBe(SCROLLBAR_WIDTH);
    expect(vertical!.height).toBeCloseTo(
      VIEWPORT_HEIGHT * (VIEWPORT_HEIGHT / extendedSceneHeight) -
        (SCROLLBAR_MARGIN * 2 + SCROLLBAR_WIDTH * 2),
    );
    expect(vertical!.deltaMultiplier).toBeCloseTo(
      extendedSceneHeight /
        (VIEWPORT_HEIGHT * (VIEWPORT_HEIGHT / extendedSceneHeight)),
    );
  });

  it("places the vertical scrollbar on the left in RTL", async () => {
    await setLanguage(languages.find((lang) => lang.rtl)!);
    const { vertical } = getScrollBars(
      elementsMap(),
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      getAppState({ scrollY: -400 }),
    );
    expect(vertical!.x).toBe(SCROLLBAR_MARGIN);
  });

  it("uses the viewport-based multiplier when content exceeds the viewport", () => {
    const largeElements = arrayToMap([
      API.createElement({
        type: "rectangle",
        x: -1000,
        y: -1000,
        width: 3000,
        height: 3000,
      }),
    ]) as unknown as RenderableElementsMap;

    const { horizontal, vertical } = getScrollBars(
      largeElements,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      getAppState({ zoom: { value: 2 } as any }),
    );

    // viewport (with zoom) is fully inside the elements bbox
    const scrollWidthOffset = SCROLLBAR_MARGIN * 2 + SCROLLBAR_WIDTH * 2;
    expect(horizontal!.width).toBeCloseTo(
      VIEWPORT_WIDTH * (VIEWPORT_WIDTH / 2 / 3000) - scrollWidthOffset,
    );
    expect(horizontal!.deltaMultiplier).toBeCloseTo(
      VIEWPORT_WIDTH / (VIEWPORT_WIDTH * (VIEWPORT_WIDTH / 2 / 3000)),
    );
    expect(vertical!.deltaMultiplier).toBeCloseTo(
      VIEWPORT_HEIGHT / (VIEWPORT_HEIGHT * (VIEWPORT_HEIGHT / 2 / 3000)),
    );
  });
});

describe("isOverScrollBars", () => {
  const scrollBars = {
    horizontal: { x: 10, y: 790, width: 200, height: 6, deltaMultiplier: 1 },
    vertical: { x: 990, y: 10, width: 6, height: 300, deltaMultiplier: 1 },
  };

  it("detects the horizontal scrollbar", () => {
    expect(isOverScrollBars(scrollBars, 100, 792)).toEqual({
      isOverEither: true,
      isOverHorizontal: true,
      isOverVertical: false,
    });
  });

  it("detects the vertical scrollbar (inclusive edges)", () => {
    expect(isOverScrollBars(scrollBars, 996, 310)).toEqual({
      isOverEither: true,
      isOverHorizontal: false,
      isOverVertical: true,
    });
  });

  it("returns false outside of the scrollbars or when they are missing", () => {
    expect(isOverScrollBars(scrollBars, 500, 500).isOverEither).toBe(false);
    expect(
      isOverScrollBars({ horizontal: null, vertical: null }, 100, 792),
    ).toEqual({
      isOverEither: false,
      isOverHorizontal: false,
      isOverVertical: false,
    });
  });
});
