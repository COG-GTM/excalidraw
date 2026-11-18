import { Debug } from "../debug";

describe("Debug", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "setTimeout",
        "clearTimeout",
        "Date",
        "requestAnimationFrame",
        "cancelAnimationFrame",
      ],
    });
  });

  afterEach(() => {
    // let the perf recording stop itself so static state resets
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("logs aggregated times once per second and stops when idle", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    Debug.logTime(undefined, "agg");
    Debug.logTime(5, "agg");
    Debug.logTime(3, "agg");

    expect(info).toHaveBeenCalledWith(
      "%c(starting perf recording)",
      "color: lime",
    );

    vi.advanceTimersByTime(1000);

    expect(info).toHaveBeenCalledWith("agg", 8, [3, 5]);

    vi.advanceTimersByTime(1000);

    expect(info).toHaveBeenCalledWith(
      "%c(stopping perf recording)",
      "color: red",
    );
  });

  it("logs average frame times", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    Debug.logTimeAverage(undefined, "avg");
    vi.advanceTimersByTime(500);
    // called within the idle window, so recording keeps going after the tick
    Debug.logTimeAverage(4, "avg");
    vi.advanceTimersByTime(500);

    const call = info.mock.calls.find(([name]) => name === "avg");
    expect(call).toBeDefined();
    expect(call![1]).toMatch(/^- 1 calls - .*ms\/frame across \d+ frames/);

    // second interval averages with the previous value
    Debug.logTimeAverage(6, "avg");
    vi.advanceTimersByTime(1000);
    expect(info.mock.calls.filter(([name]) => name === "avg")).toHaveLength(2);
  });

  it("does not log times when DEBUG_LOG_TIMES is disabled", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    Debug.DEBUG_LOG_TIMES = false;

    try {
      Debug.logTime(undefined, "off");
      Debug.logTime(1, "off");
      vi.advanceTimersByTime(1000);
      expect(info.mock.calls.some(([name]) => name === "off")).toBe(false);
    } finally {
      Debug.DEBUG_LOG_TIMES = true;
    }
  });

  it("wraps functions and returns their result", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const time = vi.spyOn(console, "time").mockImplementation(() => {});
    const timeEnd = vi.spyOn(console, "timeEnd").mockImplementation(() => {});

    const add = (a: number, b: number) => a + b;

    expect(Debug.logTimeWrap(add, "wrap")(1, 2)).toBe(3);
    expect(Debug.logTimeAverageWrap(add, "wrapAvg")(2, 3)).toBe(5);
    expect(Debug.perfWrap(add, "perf")(3, 4)).toBe(7);
    expect(time).toHaveBeenCalledWith("perf");
    expect(timeEnd).toHaveBeenCalledWith("perf");
  });

  it("logChanged reports deep changes between calls", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    Debug.logChanged("obj", { a: 1, b: { c: [1, 2] }, d: null });
    expect(info).not.toHaveBeenCalled();

    Debug.logChanged("obj", { a: 1, b: { c: [1, 2] }, d: null });
    expect(info).not.toHaveBeenCalled();

    Debug.logChanged("obj", {
      a: 2,
      b: { c: [1, 3] },
      d: {},
      e: true,
    });
    expect(info).toHaveBeenCalledWith("[obj] changed:", {
      a: { prev: 1, next: 2 },
      b: { prev: { c: [1, 2] }, next: { c: [1, 3] } },
      d: { prev: null, next: {} },
      e: { prev: undefined, next: true },
    });

    info.mockClear();
    Debug.logChanged("obj", {
      a: 2,
      b: { c: { 0: 1, 1: 3 } },
      d: { x: 1 },
      e: true,
    });
    expect(info).toHaveBeenCalledWith("[obj] changed:", {
      b: { prev: { c: [1, 3] }, next: { c: { 0: 1, 1: 3 } } },
      d: { prev: {}, next: { x: 1 } },
    });
  });
});
