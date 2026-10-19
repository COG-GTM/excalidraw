import React from "react";

import { THEME } from "@excalidraw/common";

import { act, fireEvent, render } from "@testing-library/react";

import { TopPicks } from "../components/ColorPicker/TopPicks";
import {
  ColorPickerDnDContext,
  useTopPicksDnD,
} from "../components/ColorPicker/topPicksDnD";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { render as renderExcalidraw } from "./test-utils";

import type { RenderResult } from "@testing-library/react";

const PICKS = ["#111111", "#222222", "#333333", "#444444", "#555555"];

// strip layout (see `getRect`): slot i spans [i * SLOT_SPAN, i * SLOT_SPAN +
// SLOT_SIZE] horizontally, the strip spans all slots, and the source swatch
// sits well below the strip's (padded) hit area
const SLOT_SIZE = 20;
const SLOT_SPAN = 30;
const slotCenterX = (index: number) => index * SLOT_SPAN + SLOT_SIZE / 2;
const STRIP_Y = 10;
const SWATCH = { x: 10, y: 200 };

const GHOST_SELECTOR = ".excalidraw-color-dnd-ghost";
const BODY_CLASS = "excalidraw-color-dnd-active";

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => {},
  } as DOMRect);

const getRect = (el: Element): DOMRect => {
  if (el instanceof HTMLElement) {
    if (el.dataset.topPickIndex !== undefined) {
      return rect(
        Number(el.dataset.topPickIndex) * SLOT_SPAN,
        0,
        SLOT_SIZE,
        SLOT_SIZE,
      );
    }
    if (el.classList.contains("color-picker__top-picks")) {
      const slots = el.querySelectorAll("[data-top-pick-index]").length;
      return rect(0, 0, (slots - 1) * SLOT_SPAN + SLOT_SIZE, SLOT_SIZE);
    }
    if (el.dataset.testid === "swatch") {
      return rect(SWATCH.x - 10, SWATCH.y - 10, 20, 20);
    }
  }
  return rect(0, 0, 0, 0);
};

// jsdom has no PointerEvent — a MouseEvent carrying a `pointerId` is all the
// hook (and React's pointer event plumbing) reads
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}

const dispatchPointer = (
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: EventTarget,
  x: number,
  y: number,
  init: PointerEventInit = {},
) => {
  act(() => {
    target.dispatchEvent(
      new TestPointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        ...init,
      }),
    );
  });
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const Harness = ({
  picks,
  onPicksChange,
  onChange = () => {},
  enabled = true,
  swatchColor = "#abcdef",
}: {
  picks: readonly string[];
  onPicksChange: (picks: string[]) => void;
  onChange?: (color: string) => void;
  enabled?: boolean;
  swatchColor?: string | null;
}) => {
  const dnd = useTopPicksDnD({ enabled, picks, onPicksChange });
  return (
    <ColorPickerDnDContext.Provider value={dnd}>
      <TopPicks
        theme={THEME.LIGHT}
        type="elementStroke"
        activeColor={null}
        topPicks={picks}
        onChange={onChange}
      />
      <button
        type="button"
        data-testid="swatch"
        onPointerDown={(event) => dnd.startSwatchDrag(event, swatchColor)}
      />
      <output data-testid="drag-state">
        {dnd.dragState ? JSON.stringify(dnd.dragState) : ""}
      </output>
    </ColorPickerDnDContext.Provider>
  );
};

/** stateful host persisting picks like `ColorPicker` does */
const StatefulHarness = ({
  initialPicks,
  onPicksChange,
}: {
  initialPicks: readonly string[];
  onPicksChange: (picks: string[]) => void;
}) => {
  const [picks, setPicks] = React.useState(initialPicks);
  return (
    <Harness
      picks={picks}
      onPicksChange={(next) => {
        onPicksChange(next);
        setPicks(next);
      }}
    />
  );
};

const getPick = (index: number) =>
  document.querySelector<HTMLElement>(`[data-top-pick-index="${index}"]`)!;
const getSwatch = (result: RenderResult) => result.getByTestId("swatch");
const getDragState = (result: RenderResult) => {
  const text = result.getByTestId("drag-state").textContent;
  return text ? JSON.parse(text) : null;
};
const getGhost = () => document.querySelector<HTMLElement>(GHOST_SELECTOR);

/** press on `source`, wait past the activation delay and move to (x, y) */
const startDrag = (source: HTMLElement, x: number, y: number) => {
  const sourceRect = getRect(source);
  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;
  dispatchPointer("pointerdown", source, startX, startY);
  advance(150);
  dispatchPointer("pointermove", source.ownerDocument.body, x, y);
};

const drag = (source: HTMLElement, x: number, y: number) => {
  startDrag(source, x, y);
  dispatchPointer("pointerup", source.ownerDocument.body, x, y);
};

const mockDnDEnvironment = () => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return getRect(this);
    },
  );
};

const restoreDnDEnvironment = () => {
  // flush ghost release animations so nothing leaks into the next test
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
};

beforeAll(() => {
  (window as any).PointerEvent = TestPointerEvent;
});

afterAll(() => {
  delete (window as any).PointerEvent;
});

describe("useTopPicksDnD", () => {
  beforeEach(mockDnDEnvironment);
  afterEach(restoreDnDEnvironment);

  describe("swatch drag (pin a color)", () => {
    it("replaces the hovered slot with the dragged color", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      startDrag(getSwatch(result), slotCenterX(2), STRIP_Y);

      expect(getDragState(result)).toEqual({
        color: "#abcdef",
        origin: { kind: "swatch" },
        overIndex: 2,
        duplicateIndex: null,
        slotSpan: SLOT_SPAN,
      });
      expect(getPick(2)).toHaveClass("is-dnd-target");
      expect(getPick(1)).not.toHaveClass("is-dnd-target");
      expect(getGhost()).toHaveClass("excalidraw-color-dnd-ghost--over");
      expect(document.body).toHaveClass(BODY_CLASS);

      dispatchPointer("pointerup", document.body, slotCenterX(2), STRIP_Y);

      expect(onPicksChange).toHaveBeenCalledTimes(1);
      expect(onPicksChange).toHaveBeenCalledWith([
        "#111111",
        "#222222",
        "#abcdef",
        "#444444",
        "#555555",
      ]);
      expect(getDragState(result)).toBe(null);
      expect(document.body).not.toHaveClass(BODY_CLASS);
    });

    it("snaps to the nearest slot, including within the padded strip edges", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      // just past the right edge of the strip — still within the hit padding
      drag(getSwatch(result), getRect(getPick(4)).right + 5, STRIP_Y);

      expect(onPicksChange).toHaveBeenCalledWith([
        "#111111",
        "#222222",
        "#333333",
        "#444444",
        "#abcdef",
      ]);
    });

    it("blocks dropping a color that is already pinned (notation-insensitive)", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness
          picks={["#ffffff", ...PICKS.slice(1)]}
          onPicksChange={onPicksChange}
          swatchColor="white"
        />,
      );

      startDrag(getSwatch(result), slotCenterX(3), STRIP_Y);

      expect(getDragState(result)).toMatchObject({
        overIndex: null,
        duplicateIndex: 0,
      });
      expect(getPick(0)).toHaveClass("is-dnd-duplicate");
      expect(getPick(3)).not.toHaveClass("is-dnd-target");
      expect(getGhost()).toHaveClass("excalidraw-color-dnd-ghost--blocked");

      dispatchPointer("pointerup", document.body, slotCenterX(3), STRIP_Y);

      expect(onPicksChange).not.toHaveBeenCalled();
    });

    it("does nothing when dropped outside the strip", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      startDrag(getSwatch(result), slotCenterX(2), STRIP_Y);
      expect(getDragState(result)?.overIndex).toBe(2);

      // leaving the strip clears the hovered slot
      dispatchPointer("pointermove", document.body, slotCenterX(2), 120);
      expect(getDragState(result)?.overIndex).toBe(null);
      expect(getGhost()).not.toHaveClass("excalidraw-color-dnd-ghost--over");

      dispatchPointer("pointerup", document.body, slotCenterX(2), 120);

      expect(onPicksChange).not.toHaveBeenCalled();
      // the ghost animates back and is removed afterwards
      expect(getGhost()).toHaveClass("excalidraw-color-dnd-ghost--dropping");
      advance(400);
      expect(getGhost()).toBe(null);
    });

    it("ignores swatches without a color", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness
          picks={PICKS}
          onPicksChange={onPicksChange}
          swatchColor={null}
        />,
      );

      drag(getSwatch(result), slotCenterX(1), STRIP_Y);

      expect(getGhost()).toBe(null);
      expect(onPicksChange).not.toHaveBeenCalled();
    });
  });

  describe("pick drag (reorder)", () => {
    it("moves the dragged pick to the hovered slot and previews the result", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      startDrag(getPick(0), slotCenterX(3), STRIP_Y);

      expect(getDragState(result)).toMatchObject({
        color: "#111111",
        origin: { kind: "pick", index: 0 },
        overIndex: 3,
      });
      expect(getPick(0)).toHaveClass("is-dnd-source");
      // live preview: the source jumps to slot 3, slots 1..3 shift left one
      expect(getPick(0).style.transform).toBe(`translateX(${3 * SLOT_SPAN}px)`);
      expect(getPick(1).style.transform).toBe(`translateX(-${SLOT_SPAN}px)`);
      expect(getPick(3).style.transform).toBe(`translateX(-${SLOT_SPAN}px)`);
      expect(getPick(4).style.transform).toBe("");

      dispatchPointer("pointerup", document.body, slotCenterX(3), STRIP_Y);

      expect(onPicksChange).toHaveBeenCalledTimes(1);
      expect(onPicksChange).toHaveBeenCalledWith([
        "#222222",
        "#333333",
        "#444444",
        "#111111",
        "#555555",
      ]);
    });

    it("moves a pick towards the start of the strip", () => {
      const onPicksChange = vi.fn();
      render(<Harness picks={PICKS} onPicksChange={onPicksChange} />);

      drag(getPick(4), slotCenterX(1), STRIP_Y);

      expect(onPicksChange).toHaveBeenCalledWith([
        "#111111",
        "#555555",
        "#222222",
        "#333333",
        "#444444",
      ]);
    });

    it("does not commit when dropped back onto its own slot", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      // move away (activates the drag), then come back
      startDrag(getPick(2), slotCenterX(4), STRIP_Y);
      dispatchPointer("pointermove", document.body, slotCenterX(2), STRIP_Y);
      expect(getDragState(result)?.overIndex).toBe(2);
      expect(getPick(2).style.transform).toBe("");

      dispatchPointer("pointerup", document.body, slotCenterX(2), STRIP_Y);

      expect(onPicksChange).not.toHaveBeenCalled();
    });

    it("allows reordering a pick whose color equals the dragged one (no duplicate block)", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      startDrag(getPick(1), slotCenterX(0), STRIP_Y);

      expect(getDragState(result)).toMatchObject({
        overIndex: 0,
        duplicateIndex: null,
      });
    });

    it("persists consecutive reorders against the latest picks", () => {
      const onPicksChange = vi.fn();
      render(
        <StatefulHarness initialPicks={PICKS} onPicksChange={onPicksChange} />,
      );

      drag(getPick(0), slotCenterX(4), STRIP_Y);
      advance(400);
      drag(getPick(0), slotCenterX(4), STRIP_Y);

      expect(onPicksChange).toHaveBeenNthCalledWith(2, [
        "#333333",
        "#444444",
        "#555555",
        "#111111",
        "#222222",
      ]);
      expect(
        Array.from(document.querySelectorAll("[data-top-pick-index]")).map(
          (el) => el.getAttribute("title"),
        ),
      ).toEqual(["#333333", "#444444", "#555555", "#111111", "#222222"]);
    });
  });

  describe("activation thresholds", () => {
    it("a press-and-release without moving stays a click", () => {
      const onPicksChange = vi.fn();
      const onChange = vi.fn();
      const result = render(
        <Harness
          picks={PICKS}
          onPicksChange={onPicksChange}
          onChange={onChange}
        />,
      );

      const pick = getPick(1);
      dispatchPointer("pointerdown", pick, slotCenterX(1), STRIP_Y);
      advance(300);
      dispatchPointer(
        "pointermove",
        document.body,
        slotCenterX(1) + 5,
        STRIP_Y,
      );
      dispatchPointer("pointerup", document.body, slotCenterX(1) + 5, STRIP_Y);
      act(() => {
        pick.click();
      });

      expect(getDragState(result)).toBe(null);
      expect(getGhost()).toBe(null);
      expect(onPicksChange).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith("#222222");
    });

    it("suppresses the click that follows a completed drag", () => {
      const onChange = vi.fn();
      render(
        <Harness picks={PICKS} onPicksChange={() => {}} onChange={onChange} />,
      );

      const pick = getPick(0);
      drag(pick, slotCenterX(2), STRIP_Y);
      act(() => {
        pick.click();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("a fast flick only activates once the time threshold has elapsed", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      dispatchPointer("pointerdown", getSwatch(result), SWATCH.x, SWATCH.y);
      advance(20);
      dispatchPointer("pointermove", document.body, slotCenterX(1), STRIP_Y);

      // spatial threshold crossed, temporal one not yet
      expect(getDragState(result)).toBe(null);
      expect(getGhost()).toBe(null);

      // pointer held still — the delayed activation kicks in
      advance(100);
      expect(getDragState(result)).toMatchObject({ overIndex: 1 });
      expect(getGhost()).not.toBe(null);

      dispatchPointer("pointerup", document.body, slotCenterX(1), STRIP_Y);
      expect(onPicksChange).toHaveBeenCalledWith([
        "#111111",
        "#abcdef",
        "#333333",
        "#444444",
        "#555555",
      ]);
    });

    it("a fast release before the time threshold stays a click", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      dispatchPointer("pointerdown", getSwatch(result), SWATCH.x, SWATCH.y);
      advance(20);
      dispatchPointer("pointermove", document.body, slotCenterX(1), STRIP_Y);
      dispatchPointer("pointerup", document.body, slotCenterX(1), STRIP_Y);
      advance(200);

      expect(getDragState(result)).toBe(null);
      expect(getGhost()).toBe(null);
      expect(onPicksChange).not.toHaveBeenCalled();
    });

    it("wiggling out and back inside the tolerance cancels the delayed activation", () => {
      const result = render(<Harness picks={PICKS} onPicksChange={() => {}} />);

      dispatchPointer("pointerdown", getSwatch(result), SWATCH.x, SWATCH.y);
      advance(20);
      dispatchPointer("pointermove", document.body, SWATCH.x + 30, SWATCH.y);
      advance(20);
      dispatchPointer("pointermove", document.body, SWATCH.x + 2, SWATCH.y);
      advance(200);

      expect(getDragState(result)).toBe(null);
      expect(getGhost()).toBe(null);
    });

    it("ignores moves of other pointers", () => {
      const result = render(<Harness picks={PICKS} onPicksChange={() => {}} />);

      dispatchPointer("pointerdown", getSwatch(result), SWATCH.x, SWATCH.y);
      advance(150);
      dispatchPointer("pointermove", document.body, slotCenterX(1), STRIP_Y, {
        pointerId: 2,
      });

      expect(getDragState(result)).toBe(null);
    });

    it("ignores non-primary buttons", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      dispatchPointer("pointerdown", getSwatch(result), SWATCH.x, SWATCH.y, {
        button: 2,
      });
      advance(150);
      dispatchPointer("pointermove", document.body, slotCenterX(1), STRIP_Y);
      dispatchPointer("pointerup", document.body, slotCenterX(1), STRIP_Y);

      expect(getGhost()).toBe(null);
      expect(onPicksChange).not.toHaveBeenCalled();
    });

    it("does nothing when disabled", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} enabled={false} />,
      );

      drag(getSwatch(result), slotCenterX(1), STRIP_Y);

      expect(getGhost()).toBe(null);
      expect(document.body).not.toHaveClass(BODY_CLASS);
      expect(onPicksChange).not.toHaveBeenCalled();
    });
  });

  describe("cancellation", () => {
    it("Escape cancels an active drag without committing", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      startDrag(getSwatch(result), slotCenterX(2), STRIP_Y);
      expect(getDragState(result)).not.toBe(null);

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
        );
      });

      expect(getDragState(result)).toBe(null);
      expect(document.body).not.toHaveClass(BODY_CLASS);

      dispatchPointer("pointerup", document.body, slotCenterX(2), STRIP_Y);
      expect(onPicksChange).not.toHaveBeenCalled();

      advance(400);
      expect(getGhost()).toBe(null);
    });

    it("pointercancel cancels an active drag without committing", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      startDrag(getPick(0), slotCenterX(3), STRIP_Y);
      dispatchPointer("pointercancel", document.body, slotCenterX(3), STRIP_Y);

      expect(getDragState(result)).toBe(null);
      // the reorder preview is settled
      expect(getPick(0).style.transform).toBe("");

      dispatchPointer("pointerup", document.body, slotCenterX(3), STRIP_Y);
      expect(onPicksChange).not.toHaveBeenCalled();
    });

    it("unmounting mid-drag tears down the ghost and listeners", () => {
      const onPicksChange = vi.fn();
      const result = render(
        <Harness picks={PICKS} onPicksChange={onPicksChange} />,
      );

      startDrag(getSwatch(result), slotCenterX(2), STRIP_Y);
      expect(getGhost()).not.toBe(null);

      result.unmount();

      expect(getGhost()).toBe(null);
      expect(document.body).not.toHaveClass(BODY_CLASS);

      dispatchPointer("pointerup", document.body, slotCenterX(2), STRIP_Y);
      expect(onPicksChange).not.toHaveBeenCalled();
    });
  });
});

describe("ColorPicker top picks customization", () => {
  const { h } = window;

  const getStrokePicker = () =>
    document
      .querySelector('[data-openpopup="elementStroke"]')!
      .closest<HTMLElement>(".color-picker-container")!;
  const getStrokePick = (index: number) =>
    getStrokePicker().querySelector<HTMLElement>(
      `[data-top-pick-index="${index}"]`,
    )!;
  const getStrokePickColors = () =>
    Array.from(
      getStrokePicker().querySelectorAll("[data-top-pick-index]"),
      (el) => el.getAttribute("title"),
    );

  beforeAll(() => {
    // radix context menu (strip reset) needs a ResizeObserver
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(async () => {
    await renderExcalidraw(<Excalidraw />);
    // shape tools show the styles panel with the stroke color picker
    UI.clickTool("rectangle");
    mockDnDEnvironment();
  });

  afterEach(restoreDnDEnvironment);

  it("persists a reorder to appState.colorTopPicks", () => {
    const defaults = getStrokePickColors();
    expect(h.state.colorTopPicks.elementStroke).toBe(null);

    drag(getStrokePick(0), slotCenterX(2), STRIP_Y);

    const expected = [
      defaults[1],
      defaults[2],
      defaults[0],
      ...defaults.slice(3),
    ];
    expect(h.state.colorTopPicks.elementStroke).toEqual(expected);
    expect(getStrokePickColors()).toEqual(expected);
    // other pickers' customizations are untouched
    expect(h.state.colorTopPicks.elementBackground).toBe(null);
  });

  it("pins the active color dragged from the trigger", () => {
    act(() => {
      API.setAppState({ currentItemStrokeColor: "#abcdef" });
    });
    const defaults = getStrokePickColors();

    drag(
      getStrokePicker().querySelector<HTMLElement>(
        '[data-openpopup="elementStroke"]',
      )!,
      slotCenterX(1),
      STRIP_Y,
    );

    const expected = [...defaults];
    expected[1] = "#abcdef";
    expect(h.state.colorTopPicks.elementStroke).toEqual(expected);
    expect(getStrokePickColors()).toEqual(expected);
  });

  it("resets the customized strip from its context menu", () => {
    const defaults = getStrokePickColors();
    drag(getStrokePick(0), slotCenterX(4), STRIP_Y);
    expect(h.state.colorTopPicks.elementStroke).not.toBe(null);
    act(() => {
      vi.runOnlyPendingTimers();
    });

    fireEvent.contextMenu(getStrokePick(2));
    const resetItem = document.querySelector<HTMLElement>(
      ".color-picker__context-menu-item",
    )!;
    expect(resetItem).toHaveTextContent("Reset to default top picks");
    expect(resetItem).not.toHaveAttribute("data-disabled");
    fireEvent.click(resetItem);

    expect(h.state.colorTopPicks.elementStroke).toBe(null);
    expect(getStrokePickColors()).toEqual(defaults);
  });
});
