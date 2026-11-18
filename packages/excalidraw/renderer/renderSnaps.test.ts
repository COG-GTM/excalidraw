import { THEME } from "@excalidraw/common";
import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import { renderSnaps } from "./renderSnaps";

import type { SnapLine } from "../snapping";
import type { InteractiveCanvasAppState } from "../types";

const createContext = () => {
  const strokeStyles: string[] = [];
  const lineWidths: number[] = [];
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    set strokeStyle(value: string) {
      strokeStyles.push(value);
    },
    set lineWidth(value: number) {
      lineWidths.push(value);
    },
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    mocks: context,
    strokeStyles,
    lineWidths,
  };
};

const getAppState = (
  snapLines: SnapLine[],
  overrides: Partial<InteractiveCanvasAppState> = {},
) =>
  ({
    snapLines,
    theme: THEME.LIGHT,
    zenModeEnabled: false,
    zoom: { value: 1 },
    scrollX: 10,
    scrollY: 20,
    ...overrides,
  } as InteractiveCanvasAppState);

const p = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

describe("renderSnaps", () => {
  it("does nothing without snap lines", () => {
    const { context, mocks } = createContext();
    renderSnaps(context, getAppState([]));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.translate).not.toHaveBeenCalled();
  });

  it("renders points snap lines with a line and crosses", () => {
    const { context, mocks, strokeStyles, lineWidths } = createContext();
    renderSnaps(
      context,
      getAppState([{ type: "points", points: [p(0, 0), p(0, 50), p(0, 100)] }]),
    );

    expect(mocks.translate).toHaveBeenCalledWith(10, 20);
    expect(strokeStyles).toEqual(["#ff6b6b"]);
    expect(lineWidths).toEqual([1]);
    // line from first to last point
    expect(mocks.lineTo).toHaveBeenCalledWith(0, 0);
    expect(mocks.lineTo).toHaveBeenCalledWith(0, 100);
    // one stroke for the line + one per cross
    expect(mocks.stroke).toHaveBeenCalledTimes(4);
    // cross arms of size 2 around the middle point
    expect(mocks.moveTo).toHaveBeenCalledWith(-2, 48);
    expect(mocks.lineTo).toHaveBeenCalledWith(2, 52);
    expect(mocks.save).toHaveBeenCalledTimes(4);
    expect(mocks.restore).toHaveBeenCalledTimes(4);
  });

  it("renders only crosses in zen mode with larger, zoom-adjusted sizes", () => {
    const { context, mocks, strokeStyles, lineWidths } = createContext();
    renderSnaps(
      context,
      getAppState([{ type: "points", points: [p(0, 0), p(0, 100)] }], {
        zenModeEnabled: true,
        theme: THEME.DARK,
        zoom: { value: 2 } as InteractiveCanvasAppState["zoom"],
      }),
    );

    // zen mode keeps the light color even in dark theme
    expect(strokeStyles).toEqual(["#ff6b6b"]);
    expect(lineWidths).toEqual([0.75]);
    expect(mocks.stroke).toHaveBeenCalledTimes(2);
    expect(mocks.moveTo).toHaveBeenCalledWith(-1.5, -1.5);
  });

  it("uses the dark color in dark theme", () => {
    const { context, strokeStyles } = createContext();
    renderSnaps(
      context,
      getAppState(
        [
          {
            type: "pointer",
            points: [p(0, 0), p(10, 0)],
            direction: "horizontal",
          },
        ],
        {
          theme: THEME.DARK,
        },
      ),
    );
    expect(strokeStyles).toEqual(["#ff0000"]);
  });

  it("renders pointer snap lines", () => {
    const { context, mocks } = createContext();
    renderSnaps(
      context,
      getAppState([
        { type: "pointer", points: [p(5, 5), p(50, 5)], direction: "vertical" },
      ]),
    );
    // cross + line
    expect(mocks.stroke).toHaveBeenCalledTimes(2);
    expect(mocks.lineTo).toHaveBeenCalledWith(50, 5);

    const zen = createContext();
    renderSnaps(
      zen.context,
      getAppState(
        [
          {
            type: "pointer",
            points: [p(5, 5), p(50, 5)],
            direction: "vertical",
          },
        ],
        { zenModeEnabled: true },
      ),
    );
    expect(zen.mocks.stroke).toHaveBeenCalledTimes(1);
  });

  it("renders horizontal and vertical gap lines", () => {
    const horizontal = createContext();
    renderSnaps(
      horizontal.context,
      getAppState([
        {
          type: "gap",
          direction: "horizontal",
          points: [p(0, 10), p(100, 10)],
        },
      ]),
    );
    // (1) start tick, (3) two middle ticks, (4) end tick, (2) connecting line
    expect(horizontal.mocks.stroke).toHaveBeenCalledTimes(5);
    expect(horizontal.mocks.lineTo).toHaveBeenCalledWith(0, 2);
    expect(horizontal.mocks.lineTo).toHaveBeenCalledWith(0, 18);
    expect(horizontal.mocks.lineTo).toHaveBeenCalledWith(48, 6);
    expect(horizontal.mocks.lineTo).toHaveBeenCalledWith(52, 14);

    const vertical = createContext();
    renderSnaps(
      vertical.context,
      getAppState([
        { type: "gap", direction: "vertical", points: [p(10, 0), p(10, 100)] },
      ]),
    );
    expect(vertical.mocks.stroke).toHaveBeenCalledTimes(5);
    expect(vertical.mocks.lineTo).toHaveBeenCalledWith(2, 0);
    expect(vertical.mocks.lineTo).toHaveBeenCalledWith(6, 48);
    expect(vertical.mocks.lineTo).toHaveBeenCalledWith(14, 52);

    const zen = createContext();
    renderSnaps(
      zen.context,
      getAppState(
        [
          {
            type: "gap",
            direction: "horizontal",
            points: [p(0, 10), p(100, 10)],
          },
          {
            type: "gap",
            direction: "vertical",
            points: [p(10, 0), p(10, 100)],
          },
        ],
        { zenModeEnabled: true },
      ),
    );
    // only the two middle ticks for each gap
    expect(zen.mocks.stroke).toHaveBeenCalledTimes(4);
  });
});
