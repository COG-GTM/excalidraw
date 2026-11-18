import { KEYS, arrayToMap } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

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
import { act, render } from "./tests/test-utils";

import { Excalidraw } from "./index";

import type { AppClassProperties, KeyboardModifiersObject } from "./types";

const { h } = window;

const noModifiers: KeyboardModifiersObject = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
};
const withCtrlOrCmd: KeyboardModifiersObject = {
  ...noModifiers,
  [KEYS.CTRL_OR_CMD]: true,
};

const fakeApp = (
  state: Record<string, unknown>,
  props: Record<string, unknown> = {},
) =>
  ({
    state: {
      activeTool: { type: "selection" },
      selectedElementsAreBeingDragged: false,
      objectsSnapModeEnabled: false,
      gridModeEnabled: false,
      ...state,
    },
    props,
  } as unknown as AppClassProperties);

const rect = (
  props: Omit<Partial<ExcalidrawElement>, "type"> & { id: string },
) =>
  API.createElement({ type: "rectangle", width: 100, height: 100, ...props });

describe("snapping helpers", () => {
  it("getSnapDistance scales inversely with zoom", () => {
    expect(getSnapDistance(1)).toBe(8);
    expect(getSnapDistance(2)).toBe(4);
    expect(getSnapDistance(0.5)).toBe(16);
  });

  it("SnapCache stores and clears reference points and gaps", () => {
    const gaps = { horizontalGaps: [], verticalGaps: [] };
    SnapCache.setReferenceSnapPoints([[1, 2] as any]);
    SnapCache.setVisibleGaps(gaps);
    expect(SnapCache.getReferenceSnapPoints()).toEqual([[1, 2]]);
    expect(SnapCache.getVisibleGaps()).toBe(gaps);

    SnapCache.destroy();
    expect(SnapCache.getReferenceSnapPoints()).toBeNull();
    expect(SnapCache.getVisibleGaps()).toBeNull();
  });

  it("isGridModeEnabled prefers the prop over state", () => {
    expect(isGridModeEnabled(fakeApp({ gridModeEnabled: true }))).toBe(true);
    expect(
      isGridModeEnabled(
        fakeApp({ gridModeEnabled: true }, { gridModeEnabled: false }),
      ),
    ).toBe(false);
    expect(
      isGridModeEnabled(
        fakeApp({ gridModeEnabled: false }, { gridModeEnabled: true }),
      ),
    ).toBe(true);
  });

  describe("isSnappingEnabled", () => {
    const selectedElements = [rect({ id: "r" })];

    it("follows objectsSnapModeEnabled, inverted by Ctrl/Cmd", () => {
      const snapOn = fakeApp({ objectsSnapModeEnabled: true });
      const snapOff = fakeApp({ objectsSnapModeEnabled: false });

      expect(
        isSnappingEnabled({
          app: snapOn,
          event: noModifiers,
          selectedElements,
        }),
      ).toBe(true);
      expect(
        isSnappingEnabled({
          app: snapOn,
          event: withCtrlOrCmd,
          selectedElements,
        }),
      ).toBe(false);
      expect(
        isSnappingEnabled({
          app: snapOff,
          event: noModifiers,
          selectedElements,
        }),
      ).toBe(false);
      expect(
        isSnappingEnabled({
          app: snapOff,
          event: withCtrlOrCmd,
          selectedElements,
        }),
      ).toBe(true);
    });

    it("does not snap with Ctrl/Cmd while grid mode is on", () => {
      expect(
        isSnappingEnabled({
          app: fakeApp({ gridModeEnabled: true }),
          event: withCtrlOrCmd,
          selectedElements,
        }),
      ).toBe(false);
    });

    it("only snaps with the lasso tool while dragging", () => {
      const lasso = { type: "lasso" };
      expect(
        isSnappingEnabled({
          app: fakeApp({ activeTool: lasso, objectsSnapModeEnabled: true }),
          event: noModifiers,
          selectedElements,
        }),
      ).toBe(false);
      expect(
        isSnappingEnabled({
          app: fakeApp({
            activeTool: lasso,
            objectsSnapModeEnabled: true,
            selectedElementsAreBeingDragged: true,
          }),
          event: noModifiers,
          selectedElements,
        }),
      ).toBe(true);
    });

    it("without an event, never snaps a single arrow", () => {
      const app = fakeApp({ objectsSnapModeEnabled: true });
      expect(
        isSnappingEnabled({
          app,
          event: null as any,
          selectedElements: [API.createElement({ type: "arrow" })],
        }),
      ).toBe(false);
      expect(
        isSnappingEnabled({ app, event: null as any, selectedElements }),
      ).toBe(true);
      expect(
        isSnappingEnabled({
          app: fakeApp({ objectsSnapModeEnabled: false }),
          event: null as any,
          selectedElements,
        }),
      ).toBe(false);
    });
  });

  it("areRoughlyEqual", () => {
    expect(areRoughlyEqual(1, 1.005)).toBe(true);
    expect(areRoughlyEqual(1, 1.02)).toBe(false);
    expect(areRoughlyEqual(1, 1.5, 0.5)).toBe(true);
  });

  it("isActiveToolNonLinearSnappable", () => {
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

describe("getElementsCorners", () => {
  const toArrays = (points: readonly (readonly number[])[]) =>
    points.map((p) => [p[0], p[1]]);

  it("returns corners and center of a single rectangle", () => {
    const element = rect({ id: "r", x: 10, y: 20, width: 100, height: 50 });
    const map = arrayToMap([element]);

    expect(toArrays(getElementsCorners([element], map))).toEqual([
      [10, 20],
      [110, 20],
      [10, 70],
      [110, 70],
      [60, 45],
    ]);
    expect(
      toArrays(
        getElementsCorners([element], map, {
          omitCenter: true,
          dragOffset: { x: 5, y: -5 },
        }),
      ),
    ).toEqual([
      [15, 15],
      [115, 15],
      [15, 65],
      [115, 65],
    ]);
  });

  it("uses side midpoints for ellipses and diamonds unless bounding box corners are requested", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    });
    const map = arrayToMap([ellipse]);

    expect(toArrays(getElementsCorners([ellipse], map))).toEqual([
      [0, 30],
      [50, 0],
      [100, 30],
      [50, 60],
      [50, 30],
    ]);
    expect(
      toArrays(getElementsCorners([ellipse], map, { omitCenter: true })),
    ).toHaveLength(4);
    expect(
      toArrays(
        getElementsCorners([ellipse], map, {
          boundingBoxCorners: true,
          omitCenter: true,
        }),
      ),
    ).toEqual([
      [0, 0],
      [100, 0],
      [0, 60],
      [100, 60],
    ]);
  });

  it("rotates corners around the element center", () => {
    const element = rect({
      id: "r",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      angle: (Math.PI / 2) as any,
    });
    const [topLeft, topRight, , , center] = getElementsCorners(
      [element],
      arrayToMap([element]),
    );
    expect(center[0]).toBeCloseTo(50);
    expect(center[1]).toBeCloseTo(25);
    expect(topLeft[0]).toBeCloseTo(75);
    expect(topLeft[1]).toBeCloseTo(-25);
    expect(topRight[0]).toBeCloseTo(75);
    expect(topRight[1]).toBeCloseTo(75);
  });

  it("uses the common bounds for multiple elements", () => {
    const a = rect({ id: "a", x: 0, y: 0 });
    const b = rect({ id: "b", x: 200, y: 100 });
    const map = arrayToMap([a, b]);

    expect(toArrays(getElementsCorners([a, b], map))).toEqual([
      [0, 0],
      [300, 0],
      [0, 200],
      [300, 200],
      [150, 100],
    ]);
    expect(
      toArrays(
        getElementsCorners([a, b], map, {
          omitCenter: true,
          dragOffset: { x: 10, y: 10 },
        }),
      ),
    ).toEqual([
      [10, 10],
      [310, 10],
      [10, 210],
      [310, 210],
    ]);
  });

  it("returns nothing for no elements", () => {
    expect(getElementsCorners([], new Map() as any)).toEqual([]);
  });
});

describe("snapping within the editor", () => {
  const a = () => rect({ id: "a", x: 0, y: 0 });
  const b = () => rect({ id: "b", x: 200, y: 0 });

  beforeEach(async () => {
    await render(<Excalidraw />);
    API.setAppState({ objectsSnapModeEnabled: true });
  });

  afterEach(() => {
    SnapCache.destroy();
  });

  // jsdom reports a tiny viewport, so use a large one for visibility checks
  const viewportState = () => ({
    ...h.state,
    width: 2000,
    height: 2000,
    scrollX: 0,
    scrollY: 0,
  });

  const prepareSnapCache = (selectedIds: string[]) => {
    const elements = h.app.scene.getNonDeletedElements();
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    const elementsMap = h.app.scene.getNonDeletedElementsMap();
    SnapCache.setReferenceSnapPoints(
      getReferenceSnapPoints(elements, selected, viewportState(), elementsMap),
    );
    SnapCache.setVisibleGaps(
      getVisibleGaps(elements, selected, viewportState(), elementsMap),
    );
  };

  it("getReferenceSnapPoints and getVisibleGaps ignore selected elements", () => {
    const c = rect({ id: "c", x: 400, y: 0 });
    API.setElements([a(), b(), c]);
    const elements = h.app.scene.getNonDeletedElements();
    const elementsMap = h.app.scene.getNonDeletedElementsMap();

    const points = getReferenceSnapPoints(
      elements,
      [elements[2]],
      viewportState(),
      elementsMap,
    );
    // 5 points per reference element (4 corners + center), "c" excluded
    expect(points).toHaveLength(10);
    expect(points.some((p) => p[0] >= 400)).toBe(false);

    const { horizontalGaps, verticalGaps } = getVisibleGaps(
      elements,
      [],
      viewportState(),
      elementsMap,
    );
    expect(verticalGaps).toEqual([]);
    expect(horizontalGaps.map((gap) => gap.length)).toEqual([100, 300, 100]);
    expect(horizontalGaps[0].overlap).toEqual([0, 100]);
  });

  it("finds vertical gaps between stacked elements", () => {
    API.setElements([
      rect({ id: "top", x: 0, y: 0 }),
      rect({ id: "bottom", x: 50, y: 150 }),
    ]);
    const { horizontalGaps, verticalGaps } = getVisibleGaps(
      h.app.scene.getNonDeletedElements(),
      [],
      viewportState(),
      h.app.scene.getNonDeletedElementsMap(),
    );
    expect(horizontalGaps).toEqual([]);
    expect(verticalGaps).toHaveLength(1);
    expect(verticalGaps[0].length).toBe(50);
    expect(verticalGaps[0].overlap).toEqual([50, 100]);
  });

  it("snapDraggedElements snaps to nearby points", () => {
    const moving = rect({ id: "moving", x: 200, y: 3 });
    API.setElements([a(), moving]);
    API.setSelectedElements([moving]);
    prepareSnapCache(["moving"]);

    const { snapOffset, snapLines } = snapDraggedElements(
      [...h.elements],
      { x: 0, y: -1 },
      h.app,
      noModifiers,
      h.app.scene.getNonDeletedElementsMap(),
    );

    expect(snapOffset).toEqual({ x: 0, y: -2 });
    expect(snapLines.length).toBeGreaterThan(0);
    expect(snapLines.every((line) => line.type === "points")).toBe(true);
  });

  it("snapDraggedElements snaps to equal gaps", () => {
    const moving = rect({ id: "moving", x: 405, y: 0 });
    API.setElements([a(), b(), moving]);
    API.setSelectedElements([moving]);
    prepareSnapCache(["moving"]);

    const { snapOffset, snapLines } = snapDraggedElements(
      [...h.elements],
      { x: 0, y: 0 },
      h.app,
      noModifiers,
      h.app.scene.getNonDeletedElementsMap(),
    );

    expect(snapOffset).toEqual({ x: -5, y: 0 });
    expect(snapLines.some((line) => line.type === "gap")).toBe(true);
  });

  it("snapDraggedElements snaps to the middle of a gap", () => {
    // "moving" (width 100) centered between "a" and "c" → gaps of 100
    const c = rect({ id: "c", x: 400, y: 0 });
    const moving = rect({ id: "moving", x: 202, y: 0 });
    API.setElements([a(), c, moving]);
    API.setSelectedElements([moving]);
    prepareSnapCache(["moving"]);

    const { snapOffset, snapLines } = snapDraggedElements(
      [...h.elements],
      { x: 0, y: 0 },
      h.app,
      noModifiers,
      h.app.scene.getNonDeletedElementsMap(),
    );

    expect(snapOffset.x).toBe(-2);
    expect(snapLines.some((line) => line.type === "gap")).toBe(true);
  });

  it("snapDraggedElements is a no-op when snapping is disabled or nothing is selected", () => {
    const moving = rect({ id: "moving", x: 200, y: 3 });
    API.setElements([a(), moving]);
    prepareSnapCache(["moving"]);

    const noSelection = snapDraggedElements(
      [...h.elements],
      { x: 0, y: -1 },
      h.app,
      noModifiers,
      h.app.scene.getNonDeletedElementsMap(),
    );
    expect(noSelection).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });

    API.setSelectedElements([moving]);
    const disabled = snapDraggedElements(
      [...h.elements],
      { x: 0, y: -1 },
      h.app,
      withCtrlOrCmd,
      h.app.scene.getNonDeletedElementsMap(),
    );
    expect(disabled).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });
  });

  it("snapResizingElements snaps the dragged handle", () => {
    const resizing = rect({ id: "resizing", x: 0, y: 200, width: 95 });
    API.setElements([a(), resizing]);
    prepareSnapCache(["resizing"]);
    const [element] = h.app.scene
      .getNonDeletedElements()
      .filter((el) => el.id === "resizing");

    const result = snapResizingElements(
      [element],
      [element],
      h.app,
      noModifiers,
      { x: 2, y: 0 },
      "e",
    );
    expect(result.snapOffset).toEqual({ x: 3, y: 0 });

    for (const handle of ["w", "n", "s", "ne", "nw", "se", "sw"] as const) {
      expect(
        snapResizingElements(
          [element],
          [element],
          h.app,
          noModifiers,
          { x: 0, y: 0 },
          handle,
        ).snapOffset,
      ).toBeDefined();
    }
  });

  it("snapResizingElements is a no-op for rotated single elements or disabled snapping", () => {
    const rotated = rect({ id: "rotated", x: 0, y: 200, angle: 1 as any });
    API.setElements([a(), rotated]);
    prepareSnapCache(["rotated"]);
    const [element] = h.app.scene
      .getNonDeletedElements()
      .filter((el) => el.id === "rotated");

    expect(
      snapResizingElements(
        [element],
        [element],
        h.app,
        noModifiers,
        { x: 2, y: 0 },
        "e",
      ),
    ).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });

    expect(
      snapResizingElements([], [], h.app, noModifiers, { x: 2, y: 0 }, "e"),
    ).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });
  });

  it("snapNewElement snaps the creation origin", () => {
    API.setElements([a()]);
    prepareSnapCache([]);
    const newElement = rect({ id: "new", x: 98, y: 300, width: 0, height: 0 });

    const result = snapNewElement(
      newElement,
      h.app,
      noModifiers,
      { x: 98, y: 300 },
      { x: 0, y: 0 },
      arrayToMap([newElement]),
    );
    expect(result.snapOffset).toEqual({ x: 2, y: 0 });

    expect(
      snapNewElement(
        newElement,
        h.app,
        withCtrlOrCmd,
        { x: 98, y: 300 },
        { x: 0, y: 0 },
        arrayToMap([newElement]),
      ),
    ).toEqual({ snapOffset: { x: 0, y: 0 }, snapLines: [] });
  });

  it("getSnapLinesAtPointer returns pointer snap lines to nearby corners", () => {
    API.setElements([a()]);
    const elements = h.app.scene.getNonDeletedElements();
    const elementsMap = h.app.scene.getNonDeletedElementsMap();

    const { originOffset, snapLines } = getSnapLinesAtPointer(
      elements,
      h.app,
      { x: 103, y: 47 },
      noModifiers,
      elementsMap,
    );
    expect(originOffset).toEqual({ x: -3, y: 3 });
    expect(snapLines.every((line) => line.type === "pointer")).toBe(true);
    expect(
      snapLines.filter((line) => line.direction === "vertical"),
    ).toHaveLength(2);
    expect(
      snapLines.filter((line) => line.direction === "horizontal"),
    ).toHaveLength(1);

    expect(
      getSnapLinesAtPointer(
        elements,
        h.app,
        { x: 500, y: 500 },
        noModifiers,
        elementsMap,
      ),
    ).toEqual({ originOffset: { x: 0, y: 0 }, snapLines: [] });

    act(() => {
      API.setAppState({ objectsSnapModeEnabled: false });
    });
    expect(
      getSnapLinesAtPointer(
        elements,
        h.app,
        { x: 103, y: 47 },
        noModifiers,
        elementsMap,
      ),
    ).toEqual({ originOffset: { x: 0, y: 0 }, snapLines: [] });
  });
});
