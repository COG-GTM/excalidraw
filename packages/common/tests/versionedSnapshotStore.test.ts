import { VersionedSnapshotStore } from "@excalidraw/common";

describe("VersionedSnapshotStore", () => {
  it("exposes the initial value at version 0", () => {
    const store = new VersionedSnapshotStore({ count: 1 });
    expect(store.getSnapshot()).toEqual({ version: 0, value: { count: 1 } });
  });

  it("bumps the version and stores the value on set", () => {
    const store = new VersionedSnapshotStore(1);
    expect(store.set(2)).toBe(true);
    expect(store.getSnapshot()).toEqual({ version: 1, value: 2 });
    expect(store.set(3)).toBe(true);
    expect(store.getSnapshot()).toEqual({ version: 2, value: 3 });
  });

  it("ignores equal values using Object.is by default", () => {
    const store = new VersionedSnapshotStore(NaN);
    const subscriber = vi.fn();
    store.subscribe(subscriber);

    expect(store.set(NaN)).toBe(false);
    expect(store.getSnapshot().version).toBe(0);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("uses a custom equality function when provided", () => {
    const store = new VersionedSnapshotStore(
      { id: "a", label: "first" },
      (prev, next) => prev.id === next.id,
    );

    expect(store.set({ id: "a", label: "second" })).toBe(false);
    expect(store.getSnapshot().value.label).toBe("first");

    expect(store.set({ id: "b", label: "third" })).toBe(true);
    expect(store.getSnapshot()).toEqual({
      version: 1,
      value: { id: "b", label: "third" },
    });
  });

  it("update() derives the next value from the previous one", () => {
    const store = new VersionedSnapshotStore(10);
    expect(store.update((prev) => prev + 5)).toBe(true);
    expect(store.getSnapshot()).toEqual({ version: 1, value: 15 });
    expect(store.update((prev) => prev)).toBe(false);
    expect(store.getSnapshot().version).toBe(1);
  });

  it("notifies subscribers on change until they unsubscribe", () => {
    const store = new VersionedSnapshotStore("a");
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);

    store.set("b");
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenLastCalledWith({ version: 1, value: "b" });

    unsubscribe();
    store.set("c");
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("pull() resolves immediately when the version differs", async () => {
    const store = new VersionedSnapshotStore("a");
    await expect(store.pull()).resolves.toEqual({ version: 0, value: "a" });

    store.set("b");
    await expect(store.pull(0)).resolves.toEqual({ version: 1, value: "b" });
  });

  it("pull() waits for the next change when already at that version", async () => {
    const store = new VersionedSnapshotStore("a");
    let resolved: unknown = null;
    const pending = store.pull(0).then((snapshot) => {
      resolved = snapshot;
      return snapshot;
    });

    await Promise.resolve();
    expect(resolved).toBe(null);

    // equal value does not wake waiters
    store.set("a");
    await Promise.resolve();
    expect(resolved).toBe(null);

    store.set("b");
    await expect(pending).resolves.toEqual({ version: 1, value: "b" });
  });

  it("wakes every waiter once and clears them after a change", async () => {
    const store = new VersionedSnapshotStore(0);
    const first = store.pull(0);
    const second = store.pull(0);

    store.set(1);
    await expect(Promise.all([first, second])).resolves.toEqual([
      { version: 1, value: 1 },
      { version: 1, value: 1 },
    ]);

    // new pull at the current version must wait for the next change again
    let settled = false;
    const third = store.pull(1).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    store.set(2);
    await third;
    expect(settled).toBe(true);
  });
});
