import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "./appState";
import {
  SnapCache,
  areRoughlyEqual,
  getElementsCorners,
  getReferenceSnapPoints,
  getSnapDistance,
  getSnapLinesAtPointer,
  getVisibleGaps,
  isActiveToolNonLinearSnappable,
  isGridModeEnabled,
  isSnappingEnabled,
  snapDraggedElements,
  snapNewElement,
  snapResizingElements,
} from "./snapping";
import { API } from "./tests/helpers/api";

import type { GapSnapLine, PointSnapLine, PointerSnapLine } from "./snapping";
import type {
  AppClassProperties,
  AppState,
  KeyboardModifiersObject,
} from "./types";

const noModifiers: KeyboardModifiersObject = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
};

const withCtrl: KeyboardModifiersObject = { ...noModifiers, ctrlKey: true };

const makeAppState = (overrides: Partial<AppState> = {}): AppState =>
  ({
    ...getDefaultAppState(),
    width: 2000,
    height: 2000,
    offsetLeft: 0,
    offsetTop: 0,
    objectsSnapModeEnabled: true,
    ...overrides,
  } as AppState);

const makeApp = (
  stateOverrides: Partial<AppState> = {},
  props: { gridModeEnabled?: boolean } = {},
) =>
  ({
    state: makeAppState(stateOverrides),
    props,
  } as unknown as AppClassProperties);

const rect = (
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
  extra: Record<string, unknown> = {},
) =>
  API.createElement({
    type: "rectangle",
    id,
    x,
    y,
    width,
    height,
    ...extra,
  }) as NonDeletedExcalidrawElement;

const selectIds = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, true as const]));

/** primes the SnapCache the same way App does at drag/resize start */
const primeSnapCache = (
  elements: NonDeletedExcalidrawElement[],
  selected: NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const elementsMap = arrayToMap(elements);
  SnapCache.setReferenceSnapPoints(
    getReferenceSnapPoints(elements, selected, appState, elementsMap),
  );
  SnapCache.setVisibleGaps(
    getVisibleGaps(elements, selected, appState, elementsMap),
  );
};

afterEach(() => {
  SnapCache.destroy();
});

describe("getSnapDistance", () => {
  it("scales the base snap distance inversely with zoom", () => {
    expect(getSnapDistance(1)).toBe(8);
    expect(getSnapDistance(2)).toBe(4);
    expect(getSnapDistance(0.5)).toBe(16);
  });
});

describe("areRoughlyEqual", () => {
  it("uses a default precision of 0.01", () => {
    expect(areRoughlyEqual(1, 1.005)).toBe(true);
    expect(areRoughlyEqual(1, 1.02)).toBe(false);
  });

  it("accepts a custom precision", () => {
    expect(areRoughlyEqual(1, 1.5, 0.5)).toBe(true);
    expect(areRoughlyEqual(1, 1.6, 0.5)).toBe(false);
  });
});

describe("SnapCache", () => {
  it("stores and clears reference points and visible gaps", () => {
    const points = [pointFrom<GlobalPoint>(1, 2)];
    const gaps = { horizontalGaps: [], verticalGaps: [] };

    SnapCache.setReferenceSnapPoints(points);
    SnapCache.setVisibleGaps(gaps);
    expect(SnapCache.getReferenceSnapPoints()).toBe(points);
    expect(SnapCache.getVisibleGaps()).toBe(gaps);

    SnapCache.destroy();
    expect(SnapCache.getReferenceSnapPoints()).toBeNull();
    expect(SnapCache.getVisibleGaps()).toBeNull();
  });
});

describe("isGridModeEnabled", () => {
  it("prefers the host prop over app state", () => {
    expect(isGridModeEnabled(makeApp({ gridModeEnabled: true }))).toBe(true);
    expect(
      isGridModeEnabled(
        makeApp({ gridModeEnabled: true }, { gridModeEnabled: false }),
      ),
    ).toBe(false);
    expect(
      isGridModeEnabled(
        makeApp({ gridModeEnabled: false }, { gridModeEnabled: true }),
      ),
    ).toBe(true);
  });
});

describe("isSnappingEnabled", () => {
  const selectedElements = [rect("r", 0, 0)];

  it("is on when object snapping is enabled and ctrl is not held", () => {
    const app = makeApp({ objectsSnapModeEnabled: true });
    expect(
      isSnappingEnabled({ app, event: noModifiers, selectedElements }),
    ).toBe(true);
  });

  it("ctrl temporarily inverts object snapping", () => {
    expect(
      isSnappingEnabled({
        app: makeApp({ objectsSnapModeEnabled: true }),
        event: withCtrl,
        selectedElements,
      }),
    ).toBe(false);
    expect(
      isSnappingEnabled({
        app: makeApp({ objectsSnapModeEnabled: false }),
        event: withCtrl,
        selectedElements,
      }),
    ).toBe(true);
    expect(
      isSnappingEnabled({
        app: makeApp({ objectsSnapModeEnabled: false }),
        event: noModifiers,
        selectedElements,
      }),
    ).toBe(false);
  });

  it("ctrl does not enable object snapping while grid mode is on", () => {
    expect(
      isSnappingEnabled({
        app: makeApp({ objectsSnapModeEnabled: false, gridModeEnabled: true }),
        event: withCtrl,
        selectedElements,
      }),
    ).toBe(false);
  });

  it("is off for the lasso tool unless the selection is being dragged", () => {
    const lassoTool = {
      ...getDefaultAppState().activeTool,
      type: "lasso",
    } as AppState["activeTool"];

    expect(
      isSnappingEnabled({
        app: makeApp({
          activeTool: lassoTool,
          selectedElementsAreBeingDragged: false,
        }),
        event: noModifiers,
        selectedElements,
      }),
    ).toBe(false);
    expect(
      isSnappingEnabled({
        app: makeApp({
          activeTool: lassoTool,
          selectedElementsAreBeingDragged: true,
        }),
        event: noModifiers,
        selectedElements,
      }),
    ).toBe(true);
  });

  it("without an event, falls back to the mode but never snaps a lone arrow", () => {
    const noEvent = null as unknown as KeyboardModifiersObject;
    const arrow = API.createElement({
      type: "arrow",
    }) as NonDeletedExcalidrawElement;

    expect(
      isSnappingEnabled({
        app: makeApp({ objectsSnapModeEnabled: true }),
        event: noEvent,
        selectedElements: [arrow],
      }),
    ).toBe(false);
    expect(
      isSnappingEnabled({
        app: makeApp({ objectsSnapModeEnabled: true }),
        event: noEvent,
        selectedElements,
      }),
    ).toBe(true);
    expect(
      isSnappingEnabled({
        app: makeApp({ objectsSnapModeEnabled: false }),
        event: noEvent,
        selectedElements,
      }),
    ).toBe(false);
  });
});

describe("getElementsCorners", () => {
  it("returns the four corners plus the center of a rectangle", () => {
    const r = rect("r", 10, 20, 100, 50);
    expect(getElementsCorners([r], arrayToMap([r]))).toEqual([
      [10, 20],
      [110, 20],
      [10, 70],
      [110, 70],
      [60, 45],
    ]);
  });

  it("omits the center and applies the drag offset", () => {
    const r = rect("r", 10, 20, 100, 50);
    expect(
      getElementsCorners([r], arrayToMap([r]), {
        omitCenter: true,
        dragOffset: { x: 5, y: -5 },
      }),
    ).toEqual([
      [15, 15],
      [115, 15],
      [15, 65],
      [115, 65],
    ]);
  });

  it("uses edge midpoints for ellipses and diamonds", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    });
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    });
    const expected = [
      [0, 30],
      [50, 0],
      [100, 30],
      [50, 60],
      [50, 30],
    ];

    expect(getElementsCorners([ellipse], arrayToMap([ellipse]))).toEqual(
      expected,
    );
    expect(
      getElementsCorners([diamond], arrayToMap([diamond]), {
        omitCenter: true,
      }),
    ).toEqual(expected.slice(0, 4));
  });

  it("uses bounding-box corners for an ellipse when requested", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    });
    expect(
      getElementsCorners([ellipse], arrayToMap([ellipse]), {
        boundingBoxCorners: true,
        omitCenter: true,
      }),
    ).toEqual([
      [0, 0],
      [100, 0],
      [0, 60],
      [100, 60],
    ]);
  });

  it("rotates corners around the element center", () => {
    const r = rect("r", 0, 0, 100, 50, { angle: Math.PI / 2 });
    const corners = getElementsCorners([r], arrayToMap([r]));

    // a 100x50 box centered at (50, 25), rotated 90deg, spans x 25..75, y -25..75
    const xs = corners.slice(0, 4).map((p) => p[0]);
    const ys = corners.slice(0, 4).map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(25);
    expect(Math.max(...xs)).toBeCloseTo(75);
    expect(Math.min(...ys)).toBeCloseTo(-25);
    expect(Math.max(...ys)).toBeCloseTo(75);
    expect(corners[4]).toEqual([50, 25]);
  });

  it("uses the common bounding box for multiple elements", () => {
    const a = rect("a", 0, 0, 100, 100);
    const b = rect("b", 200, 50, 100, 100);
    expect(
      getElementsCorners([a, b], arrayToMap([a, b]), {
        dragOffset: { x: 10, y: 10 },
      }),
    ).toEqual([
      [10, 10],
      [310, 10],
      [10, 160],
      [310, 160],
      [160, 85],
    ]);
  });

  it("returns no points for an empty selection", () => {
    expect(getElementsCorners([], new Map())).toEqual([]);
  });
});

describe("getVisibleGaps", () => {
  it("finds horizontal gaps between vertically overlapping elements", () => {
    const a = rect("a", 0, 0);
    const b = rect("b", 200, 50);
    // c does not overlap a/b vertically
    const c = rect("c", 250, 500);
    const elements = [a, b, c];

    const { horizontalGaps, verticalGaps } = getVisibleGaps(
      elements,
      [],
      makeAppState(),
      arrayToMap(elements),
    );

    expect(horizontalGaps).toHaveLength(1);
    expect(horizontalGaps[0]).toMatchObject({
      startBounds: [0, 0, 100, 100],
      endBounds: [200, 50, 300, 150],
      startSide: [
        [100, 0],
        [100, 100],
      ],
      endSide: [
        [200, 50],
        [200, 150],
      ],
      length: 100,
      overlap: [50, 100],
    });

    // c sits below b and overlaps it horizontally
    expect(verticalGaps).toHaveLength(1);
    expect(verticalGaps[0]).toMatchObject({
      startBounds: [200, 50, 300, 150],
      endBounds: [250, 500, 350, 600],
      length: 350,
      overlap: [250, 300],
    });
  });

  it("finds vertical gaps and excludes selected elements", () => {
    const a = rect("a", 0, 0);
    const b = rect("b", 20, 300);
    const selected = rect("s", 0, 150, 100, 50);
    const elements = [a, b, selected];

    const { horizontalGaps, verticalGaps } = getVisibleGaps(
      elements,
      [selected],
      makeAppState(),
      arrayToMap(elements),
    );

    expect(horizontalGaps).toEqual([]);
    expect(verticalGaps).toHaveLength(1);
    expect(verticalGaps[0]).toMatchObject({
      startSide: [
        [0, 100],
        [100, 100],
      ],
      endSide: [
        [20, 300],
        [120, 300],
      ],
      length: 200,
      overlap: [20, 100],
    });
  });

  it("treats a group as a single reference box", () => {
    const a1 = rect("a1", 0, 0, 40, 100, { groupIds: ["g"] });
    const a2 = rect("a2", 60, 0, 40, 100, { groupIds: ["g"] });
    const b = rect("b", 200, 0);
    const elements = [a1, a2, b];

    const { horizontalGaps } = getVisibleGaps(
      elements,
      [],
      makeAppState(),
      arrayToMap(elements),
    );

    expect(horizontalGaps).toHaveLength(1);
    expect(horizontalGaps[0].startBounds).toEqual([0, 0, 100, 100]);
    expect(horizontalGaps[0].length).toBe(100);
  });

  it("ignores elements outside the viewport", () => {
    const a = rect("a", 0, 0);
    const b = rect("b", 5000, 0);
    const elements = [a, b];

    expect(
      getVisibleGaps(elements, [], makeAppState(), arrayToMap(elements))
        .horizontalGaps,
    ).toEqual([]);
  });
});

describe("getReferenceSnapPoints", () => {
  it("returns corners of non-selected visible elements only", () => {
    const a = rect("a", 0, 0);
    const selected = rect("s", 300, 300);
    const elements = [a, selected];

    expect(
      getReferenceSnapPoints(
        elements,
        [selected],
        makeAppState(),
        arrayToMap(elements),
      ),
    ).toEqual([
      [0, 0],
      [100, 0],
      [0, 100],
      [100, 100],
      [50, 50],
    ]);
  });
});

describe("snapDraggedElements", () => {
  it("returns no snap when snapping is disabled or nothing is selected", () => {
    const a = rect("a", 0, 0);
    const s = rect("s", 0, 200);
    const elements = [a, s];

    const disabled = makeApp({
      objectsSnapModeEnabled: false,
      selectedElementIds: selectIds("s"),
    });
    expect(
      snapDraggedElements(
        elements,
        { x: 5, y: 0 },
        disabled,
        noModifiers,
        arrayToMap(elements),
      ),
    ).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });

    const nothingSelected = makeApp({ selectedElementIds: {} });
    expect(
      snapDraggedElements(
        elements,
        { x: 5, y: 0 },
        nothingSelected,
        noModifiers,
        arrayToMap(elements),
      ),
    ).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });
  });

  it("snaps to the nearest reference point and creates point snap lines", () => {
    const a = rect("a", 0, 0);
    const s = rect("s", 0, 200);
    const elements = [a, s];
    const app = makeApp({ selectedElementIds: selectIds("s") });
    primeSnapCache(elements, [s], app.state);

    const { snapOffset, snapLines } = snapDraggedElements(
      elements,
      { x: 5, y: 0 },
      app,
      noModifiers,
      arrayToMap(elements),
    );

    expect(snapOffset).toEqual({ x: -5, y: 0 });
    const pointLines = snapLines.filter(
      (line): line is PointSnapLine => line.type === "points",
    );
    // left edge, center and right edge all line up vertically
    expect(pointLines.map((line) => line.points[0][0]).sort()).toEqual([
      0, 100, 50,
    ]);
    expect(pointLines[0].points).toEqual([
      [0, 0],
      [0, 100],
      [0, 200],
      [0, 300],
    ]);
  });

  it("does not snap when the nearest point is beyond the snap distance", () => {
    const a = rect("a", 0, 0);
    const s = rect("s", 0, 200);
    const elements = [a, s];
    const app = makeApp({ selectedElementIds: selectIds("s") });
    primeSnapCache(elements, [s], app.state);

    const { snapOffset, snapLines } = snapDraggedElements(
      elements,
      { x: 20, y: 0 },
      app,
      noModifiers,
      arrayToMap(elements),
    );

    expect(snapOffset).toEqual({ x: 0, y: 0 });
    expect(snapLines).toEqual([]);
  });

  it("respects zoom when computing the snap distance", () => {
    const a = rect("a", 0, 0);
    const s = rect("s", 0, 200);
    const elements = [a, s];
    const app = makeApp({
      selectedElementIds: selectIds("s"),
      zoom: { value: 2 as AppState["zoom"]["value"] },
    });
    primeSnapCache(elements, [s], app.state);

    // 5 > 8 / 2
    expect(
      snapDraggedElements(
        elements,
        { x: 5, y: 0 },
        app,
        noModifiers,
        arrayToMap(elements),
      ).snapOffset,
    ).toEqual({ x: 0, y: 0 });
  });

  describe("gap snapping", () => {
    const gapSnap = (
      selected: NonDeletedExcalidrawElement,
      dragOffset: { x: number; y: number },
      references: NonDeletedExcalidrawElement[],
    ) => {
      const elements = [...references, selected];
      const app = makeApp({ selectedElementIds: selectIds(selected.id) });
      primeSnapCache(elements, [selected], app.state);
      const result = snapDraggedElements(
        elements,
        dragOffset,
        app,
        noModifiers,
        arrayToMap(elements),
      );
      return {
        ...result,
        gapLines: result.snapLines.filter(
          (line): line is GapSnapLine => line.type === "gap",
        ),
      };
    };

    const horizontalRefs = () => [rect("a", 0, 0), rect("b", 200, 0)];
    const verticalRefs = () => [rect("a", 0, 0), rect("b", 0, 200)];

    it("centers the selection inside a horizontal gap", () => {
      const { snapOffset, gapLines } = gapSnap(
        rect("s", 120, 0, 50, 100),
        { x: 0, y: 0 },
        horizontalRefs(),
      );

      expect(snapOffset.x).toBe(5);
      expect(gapLines).toEqual([
        {
          type: "gap",
          direction: "horizontal",
          points: [
            [100, 50],
            [125, 50],
          ],
        },
        {
          type: "gap",
          direction: "horizontal",
          points: [
            [175, 50],
            [200, 50],
          ],
        },
      ]);
    });

    it("matches the gap to the right of the last element", () => {
      const { snapOffset, gapLines } = gapSnap(
        rect("s", 405, 0, 50, 100),
        { x: 0, y: 0 },
        horizontalRefs(),
      );

      expect(snapOffset.x).toBe(-5);
      expect(gapLines.map((line) => line.points)).toEqual([
        [
          [100, 50],
          [200, 50],
        ],
        [
          [300, 50],
          [400, 50],
        ],
      ]);
    });

    it("matches the gap to the left of the first element", () => {
      const { snapOffset, gapLines } = gapSnap(
        rect("s", -153, 0, 50, 100),
        { x: 0, y: 0 },
        horizontalRefs(),
      );

      expect(snapOffset.x).toBe(3);
      expect(gapLines.map((line) => line.points)).toEqual([
        [
          [-100, 50],
          [0, 50],
        ],
        [
          [100, 50],
          [200, 50],
        ],
      ]);
    });

    it("centers the selection inside a vertical gap", () => {
      const { snapOffset, gapLines } = gapSnap(
        rect("s", 0, 120, 100, 50),
        { x: 0, y: 0 },
        verticalRefs(),
      );

      expect(snapOffset.y).toBe(5);
      expect(gapLines).toEqual([
        {
          type: "gap",
          direction: "vertical",
          points: [
            [50, 100],
            [50, 125],
          ],
        },
        {
          type: "gap",
          direction: "vertical",
          points: [
            [50, 175],
            [50, 200],
          ],
        },
      ]);
    });

    it("matches the gap below the last element", () => {
      const { snapOffset, gapLines } = gapSnap(
        rect("s", 0, 405, 100, 50),
        { x: 0, y: 0 },
        verticalRefs(),
      );

      expect(snapOffset.y).toBe(-5);
      expect(gapLines.map((line) => line.points)).toEqual([
        [
          [50, 100],
          [50, 200],
        ],
        [
          [50, 300],
          [50, 400],
        ],
      ]);
    });

    it("matches the gap above the first element", () => {
      const { snapOffset, gapLines } = gapSnap(
        rect("s", 0, -153, 100, 50),
        { x: 0, y: 0 },
        verticalRefs(),
      );

      expect(snapOffset.y).toBe(3);
      expect(gapLines.map((line) => line.points)).toEqual([
        [
          [50, -100],
          [50, 0],
        ],
        [
          [50, 100],
          [50, 200],
        ],
      ]);
    });

    it("ignores gaps the selection does not overlap", () => {
      const { snapOffset, gapLines } = gapSnap(
        rect("s", 120, 500, 50, 100),
        { x: 0, y: 0 },
        horizontalRefs(),
      );

      expect(snapOffset).toEqual({ x: 0, y: 0 });
      expect(gapLines).toEqual([]);
    });
  });
});

describe("snapResizingElements", () => {
  const setup = (selectedProps: Record<string, unknown> = {}) => {
    const a = rect("a", 0, 0);
    const s = rect("s", 103, 103, 100, 100, selectedProps);
    const elements = [a, s];
    const app = makeApp({ selectedElementIds: selectIds("s") });
    primeSnapCache(elements, [s], app.state);
    return { app, s };
  };

  it.each([
    ["e", { x: 0, y: -3 }],
    ["w", { x: -3, y: -3 }],
    ["n", { x: -3, y: -3 }],
    ["s", { x: -3, y: 0 }],
    ["ne", { x: 0, y: -3 }],
    ["nw", { x: -3, y: -3 }],
    ["se", { x: 0, y: 0 }],
    ["sw", { x: -3, y: 0 }],
  ] as const)(
    "snaps only the points moved by the %s handle",
    (handle, expected) => {
      const { app, s } = setup();
      const { snapOffset } = snapResizingElements(
        [s],
        [s],
        app,
        noModifiers,
        { x: 0, y: 0 },
        handle,
      );
      expect(snapOffset).toEqual(expected);
    },
  );

  it("applies the drag offset to the edges moved by the handle", () => {
    const { app, s } = setup();
    // the east edge moves from 203 to 103, 3px from the reference edge at 100
    expect(
      snapResizingElements([s], [s], app, noModifiers, { x: -100, y: 0 }, "e")
        .snapOffset.x,
    ).toBe(-3);
    // the south edge moves from 203 to 98
    expect(
      snapResizingElements([s], [s], app, noModifiers, { x: 0, y: -105 }, "s")
        .snapOffset.y,
    ).toBe(2);
  });

  it("creates snap lines from the latest (already snapped) elements", () => {
    const { app, s } = setup();
    const snapped = { ...s, x: 100, y: 100, width: 103, height: 103 };
    const { snapLines } = snapResizingElements(
      [snapped],
      [s],
      app,
      noModifiers,
      { x: 0, y: 0 },
      "nw",
    );

    expect(snapLines).toEqual([
      {
        type: "points",
        points: [
          [100, 0],
          [100, 100],
          [100, 203],
        ],
      },
      {
        type: "points",
        points: [
          [0, 100],
          [100, 100],
          [203, 100],
        ],
      },
    ]);
  });

  it("does not snap rotated single elements, empty selections or when disabled", () => {
    const rotated = setup({ angle: Math.PI / 4 });
    const none = { snapOffset: { x: 0, y: 0 }, snapLines: [] };

    expect(
      snapResizingElements(
        [rotated.s],
        [rotated.s],
        rotated.app,
        noModifiers,
        { x: 0, y: 0 },
        "nw",
      ),
    ).toEqual(none);

    const { app } = setup();
    expect(
      snapResizingElements([], [], app, noModifiers, { x: 0, y: 0 }, "nw"),
    ).toEqual(none);

    const { s } = setup();
    expect(
      snapResizingElements(
        [s],
        [s],
        makeApp({ objectsSnapModeEnabled: false }),
        noModifiers,
        { x: 0, y: 0 },
        "nw",
      ),
    ).toEqual(none);
  });
});

describe("snapNewElement", () => {
  it("snaps the creation origin to nearby reference points", () => {
    const a = rect("a", 0, 0);
    const n = rect("n", 103, 103, 50, 50);
    const elements = [a, n];
    const app = makeApp({ selectedElementIds: {} });
    primeSnapCache(elements, [n], app.state);

    const { snapOffset } = snapNewElement(
      n,
      app,
      noModifiers,
      { x: 100, y: 100 },
      { x: 3, y: 2 },
      arrayToMap(elements),
    );

    expect(snapOffset).toEqual({ x: -3, y: -2 });
  });

  it("creates snap lines from the new element's bounding box", () => {
    const a = rect("a", 0, 0);
    const n = rect("n", 100, 200, 50, 50);
    const elements = [a, n];
    const app = makeApp({ selectedElementIds: {} });
    primeSnapCache(elements, [n], app.state);

    const { snapOffset, snapLines } = snapNewElement(
      n,
      app,
      noModifiers,
      { x: 100, y: 200 },
      { x: 0, y: 0 },
      arrayToMap(elements),
    );

    expect(snapOffset).toEqual({ x: 0, y: 0 });
    expect(snapLines).toEqual([
      {
        type: "points",
        points: [
          [100, 0],
          [100, 100],
          [100, 200],
          [100, 250],
        ],
      },
    ]);
  });

  it("returns no snap when snapping is disabled", () => {
    const n = rect("n", 103, 103, 50, 50);
    expect(
      snapNewElement(
        n,
        makeApp({ objectsSnapModeEnabled: false }),
        noModifiers,
        { x: 103, y: 103 },
        { x: 0, y: 0 },
        arrayToMap([n]),
      ),
    ).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });
  });
});

describe("getSnapLinesAtPointer", () => {
  it("snaps the pointer to the nearest corner on each axis", () => {
    const a = rect("a", 0, 0);
    const elements = [a];
    const { originOffset, snapLines } = getSnapLinesAtPointer(
      elements,
      makeApp(),
      { x: 102, y: 500 },
      noModifiers,
      arrayToMap(elements),
    );

    expect(originOffset).toEqual({ x: -2, y: 0 });
    const lines = snapLines as PointerSnapLine[];
    expect(lines.every((line) => line.direction === "vertical")).toBe(true);
    expect(lines.map((line) => line.points)).toEqual([
      [
        [100, 0],
        [100, 500],
      ],
      [
        [100, 100],
        [100, 500],
      ],
    ]);
  });

  it("produces horizontal lines when the pointer is near a corner's y", () => {
    const a = rect("a", 0, 0);
    const elements = [a];
    const { originOffset, snapLines } = getSnapLinesAtPointer(
      elements,
      makeApp(),
      { x: 500, y: 47 },
      noModifiers,
      arrayToMap(elements),
    );

    expect(originOffset).toEqual({ x: 0, y: 3 });
    expect(snapLines).toEqual([
      {
        type: "pointer",
        points: [
          [50, 50],
          [500, 50],
        ],
        direction: "horizontal",
      },
    ]);
  });

  it("returns nothing when snapping is disabled", () => {
    const a = rect("a", 0, 0);
    expect(
      getSnapLinesAtPointer(
        [a],
        makeApp({ objectsSnapModeEnabled: false }),
        { x: 101, y: 101 },
        noModifiers,
        arrayToMap([a]),
      ),
    ).toEqual({ originOffset: { x: 0, y: 0 }, snapLines: [] });
  });
});

describe("isActiveToolNonLinearSnappable", () => {
  it("is true for box-like tools and false for linear/freehand tools", () => {
    for (const tool of [
      "rectangle",
      "ellipse",
      "diamond",
      "frame",
      "magicframe",
      "image",
      "text",
    ] as const) {
      expect(isActiveToolNonLinearSnappable(tool)).toBe(true);
    }
    for (const tool of ["arrow", "line", "freedraw", "selection"] as const) {
      expect(isActiveToolNonLinearSnappable(tool)).toBe(false);
    }
  });
});
