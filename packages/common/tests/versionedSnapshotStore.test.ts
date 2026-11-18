import { VersionedSnapshotStore } from "../src/versionedSnapshotStore";

describe("VersionedSnapshotStore", () => {
  it("starts at version 0 with the initial value", () => {
    const store = new VersionedSnapshotStore(1);
    expect(store.getSnapshot()).toEqual({ version: 0, value: 1 });
  });

  it("bumps the version and notifies subscribers on change", () => {
    const store = new VersionedSnapshotStore(1);
    const subscriber = vi.fn();
    store.subscribe(subscriber);

    expect(store.set(2)).toBe(true);
    expect(store.getSnapshot()).toEqual({ version: 1, value: 2 });
    expect(subscriber).toHaveBeenCalledWith({ version: 1, value: 2 });
  });

  it("ignores equal values", () => {
    const store = new VersionedSnapshotStore(1);
    const subscriber = vi.fn();
    store.subscribe(subscriber);

    expect(store.set(1)).toBe(false);
    expect(store.getSnapshot().version).toBe(0);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("uses a custom equality function", () => {
    const store = new VersionedSnapshotStore(
      { id: 1, label: "a" },
      (prev, next) => prev.id === next.id,
    );

    expect(store.set({ id: 1, label: "b" })).toBe(false);
    expect(store.getSnapshot().value.label).toBe("a");
    expect(store.set({ id: 2, label: "b" })).toBe(true);
    expect(store.getSnapshot()).toEqual({
      version: 1,
      value: { id: 2, label: "b" },
    });
  });

  it("update() derives the next value from the previous one", () => {
    const store = new VersionedSnapshotStore(1);

    expect(store.update((prev) => prev + 1)).toBe(true);
    expect(store.getSnapshot()).toEqual({ version: 1, value: 2 });
    expect(store.update((prev) => prev)).toBe(false);
  });

  it("stops notifying after unsubscribe", () => {
    const store = new VersionedSnapshotStore(1);
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);

    unsubscribe();
    store.set(2);

    expect(subscriber).not.toHaveBeenCalled();
  });

  it("pull() resolves immediately when the version differs", async () => {
    const store = new VersionedSnapshotStore("a");

    await expect(store.pull()).resolves.toEqual({ version: 0, value: "a" });

    store.set("b");
    await expect(store.pull(0)).resolves.toEqual({ version: 1, value: "b" });
  });

  it("pull() waits for the next change when already up to date", async () => {
    const store = new VersionedSnapshotStore("a");
    let resolved = false;

    const pending = store.pull(0).then((snapshot) => {
      resolved = true;
      return snapshot;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    store.set("b");

    await expect(pending).resolves.toEqual({ version: 1, value: "b" });

    // waiters are one-shot
    const subscriber = vi.fn();
    store.subscribe(subscriber);
    store.set("c");
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});
