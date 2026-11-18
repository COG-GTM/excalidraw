import { PromisePool } from "../src/promise-pool";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("PromisePool", () => {
  it("collects results ordered by index, not by completion", async () => {
    const delays = [30, 5, 15];
    const started: number[] = [];

    function* source() {
      for (let i = 0; i < delays.length; i++) {
        started.push(i);
        yield delay(delays[i]).then(() => [i, `value-${i}`] as const);
      }
    }

    const pool = new PromisePool<string>(source(), 2);

    await expect(pool.all()).resolves.toEqual([
      "value-0",
      "value-1",
      "value-2",
    ]);
    expect(started).toEqual([0, 1, 2]);
  });

  it("respects the concurrency limit", async () => {
    const counter = { running: 0, maxRunning: 0 };

    const task = (i: number) => {
      counter.running++;
      counter.maxRunning = Math.max(counter.maxRunning, counter.running);
      return delay(5).then(() => {
        counter.running--;
        return [i, i * 2] as const;
      });
    };

    function* source() {
      for (let i = 0; i < 5; i++) {
        yield task(i);
      }
    }

    const pool = new PromisePool<number>(source(), 2);

    await expect(pool.all()).resolves.toEqual([0, 2, 4, 6, 8]);
    expect(counter.maxRunning).toBe(2);
  });

  it("skips promises resolving to nothing", async () => {
    function* source() {
      yield Promise.resolve([0, "a"] as const);
      yield Promise.resolve();
      yield Promise.resolve([2, "c"] as const);
    }

    const pool = new PromisePool<string>(source(), 3);

    await expect(pool.all()).resolves.toEqual(["a", "c"]);
  });

  it("rejects when a source promise rejects", async () => {
    function* source() {
      yield Promise.resolve([0, "a"] as const);
      yield Promise.reject(new Error("boom"));
    }

    const pool = new PromisePool<string>(source(), 1);

    await expect(pool.all()).rejects.toThrow("boom");
  });
});
