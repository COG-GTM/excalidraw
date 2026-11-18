import { AppEventBus } from "../src/appEventBus";

type TestEvents = {
  ready: [api: number];
  loaded: [a: number, b: string];
  closed: [];
  pointerUp: [pointerId: string];
  viewState: [zoom: number];
};

const behavior = {
  ready: { cardinality: "once", replay: "last" },
  loaded: { cardinality: "once", replay: "last" },
  closed: { cardinality: "once", replay: "none" },
  pointerUp: { cardinality: "many", replay: "none" },
  viewState: { cardinality: "many", replay: "last" },
} as const;

const createBus = () => new AppEventBus<TestEvents, typeof behavior>(behavior);

describe("AppEventBus (extra)", () => {
  it("resolves a pending Promise subscriber when the event is emitted", async () => {
    const bus = createBus();
    const pending = bus.on("ready");

    bus.emit("ready", 7);

    await expect(pending).resolves.toBe(7);
  });

  it("resolves multi-argument payloads as a tuple", async () => {
    const bus = createBus();
    const pending = bus.on("loaded");

    bus.emit("loaded", 1, "a");

    await expect(pending).resolves.toEqual([1, "a"]);
    await expect(bus.on("loaded")).resolves.toEqual([1, "a"]);
  });

  it("throws when awaiting events that are not once+replay", () => {
    const bus = createBus();

    expect(() => (bus.on as any)("pointerUp")).toThrow(
      'Event "pointerUp" requires a callback',
    );
    expect(() => (bus.on as any)("closed")).toThrow(
      'Event "closed" requires a callback',
    );
  });

  it("clears once-event subscribers after emitting", () => {
    const bus = createBus();
    const callback = vi.fn();

    bus.on("closed", callback);
    bus.emit("closed");

    expect(callback).toHaveBeenCalledTimes(1);
    // late subscribers of non-replayed once events are not called
    const late = vi.fn();
    bus.on("closed", late);
    expect(late).not.toHaveBeenCalled();
  });

  it("unsubscribes stream subscribers", () => {
    const bus = createBus();
    const callback = vi.fn();

    const unsubscribe = bus.on("pointerUp", callback);
    bus.emit("pointerUp", "a");
    unsubscribe();
    bus.emit("pointerUp", "b");

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("a");
  });

  it("clears subscribers even when one throws", () => {
    const bus = createBus();
    const callback = vi.fn(() => {
      throw new Error("boom");
    });

    bus.on("closed", callback);
    expect(() => bus.emit("closed")).toThrow("boom");
  });

  it("clear() resets cached payloads, once-tracking and subscribers", async () => {
    const bus = createBus();
    const callback = vi.fn();

    bus.on("pointerUp", callback);
    bus.emit("ready", 1);
    bus.emit("viewState", 2);

    bus.clear();

    bus.emit("pointerUp", "x");
    expect(callback).not.toHaveBeenCalled();

    const late = vi.fn();
    bus.on("viewState", late);
    await Promise.resolve();
    expect(late).not.toHaveBeenCalled();

    // once event can be emitted again after clear
    expect(() => bus.emit("ready", 2)).not.toThrow();
    await expect(bus.on("ready")).resolves.toBe(2);
  });
});
