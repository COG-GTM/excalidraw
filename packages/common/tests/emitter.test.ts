import { Emitter } from "../src/emitter";

describe("Emitter", () => {
  it("calls subscribers with the payload and supports chaining", () => {
    const emitter = new Emitter<[number, string]>();
    const a = vi.fn();
    const b = vi.fn();

    emitter.on(a, b);

    expect(emitter.trigger(1, "x")).toBe(emitter);
    expect(a).toHaveBeenCalledWith(1, "x");
    expect(b).toHaveBeenCalledWith(1, "x");
  });

  it("accepts arrays of handlers and ignores non-function values", () => {
    const emitter = new Emitter<[]>();
    const a = vi.fn();
    const b = vi.fn();

    emitter.on([a, b, null as any, undefined as any]);

    expect(emitter.subscribers).toEqual([a, b]);
  });

  it("unsubscribes via the returned callback", () => {
    const emitter = new Emitter<[]>();
    const a = vi.fn();
    const b = vi.fn();

    const unsubscribeA = emitter.on(a);
    emitter.on(b);
    unsubscribeA();
    emitter.trigger();

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("removes handlers via off()", () => {
    const emitter = new Emitter<[]>();
    const a = vi.fn();
    const b = vi.fn();

    emitter.on(a, b);
    emitter.off([a]);
    emitter.trigger();

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("calls once() handlers only on the first trigger", () => {
    const emitter = new Emitter<[number]>();
    const handler = vi.fn();

    emitter.once(handler);
    emitter.trigger(1);
    emitter.trigger(2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
    expect(emitter.subscribers).toHaveLength(0);
  });

  it("can detach once() handlers before they fire", () => {
    const emitter = new Emitter<[]>();
    const handler = vi.fn();

    const detach = emitter.once(handler);
    detach();
    emitter.trigger();

    expect(handler).not.toHaveBeenCalled();
  });

  it("clear() removes all subscribers", () => {
    const emitter = new Emitter<[]>();
    const handler = vi.fn();

    emitter.on(handler);
    emitter.clear();
    emitter.trigger();

    expect(handler).not.toHaveBeenCalled();
    expect(emitter.subscribers).toEqual([]);
  });
});
