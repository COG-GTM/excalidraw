import { PromisePool } from "@excalidraw/common";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("PromisePool", () => {
  it("returns results ordered by index, not completion order", async () => {
    const durations = [30, 5, 15];
    function* source() {
      for (const [index, ms] of durations.entries()) {
        yield delay(ms).then(() => [index, `job-${index}`] as const);
      }
    }

    const results = await new PromisePool<string>(source(), 3).all();
    expect(results).toEqual(["job-0", "job-1", "job-2"]);
  });

  it("never runs more than `concurrency` jobs at once", async () => {
    const tracker = { running: 0, maxRunning: 0 };
    const runJob = async (index: number) => {
      tracker.running++;
      tracker.maxRunning = Math.max(tracker.maxRunning, tracker.running);
      await delay(5);
      tracker.running--;
      return [index, index * 2] as const;
    };

    function* source() {
      for (let index = 0; index < 6; index++) {
        yield runJob(index);
      }
    }

    const results = await new PromisePool<number>(source(), 2).all();
    expect(tracker.maxRunning).toBe(2);
    expect(results).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("skips jobs that resolve without a result", async () => {
    function* source() {
      yield Promise.resolve([0, "a"] as const);
      yield Promise.resolve();
      yield Promise.resolve([2, "c"] as const);
    }

    const results = await new PromisePool<string>(source(), 1).all();
    expect(results).toEqual(["a", "c"]);
  });

  it("resolves with an empty array for an empty source", async () => {
    function* source(): Generator<Promise<readonly [number, string]>> {}

    await expect(new PromisePool<string>(source(), 4).all()).resolves.toEqual(
      [],
    );
  });

  it("rejects when a job rejects", async () => {
    function* source() {
      yield Promise.resolve([0, "ok"] as const);
      yield Promise.reject(new Error("boom"));
    }

    await expect(new PromisePool<string>(source(), 1).all()).rejects.toThrow(
      "boom",
    );
  });
});
