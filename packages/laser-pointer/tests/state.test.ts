import { LaserPointer } from "../src";
import { dist } from "../src/math";

import type { LaserPointerOptions, SizeMappingDetails } from "../src";
import type { Point } from "../src/math";

const makePointer = (
  points: Point[],
  options: Partial<LaserPointerOptions> = {},
) => {
  const lp = new LaserPointer({ streamline: 0, simplify: 0, ...options });
  points.forEach((p) => lp.addPoint(p));
  return lp;
};

const bounds = (ps: Point[]) => ({
  minX: Math.min(...ps.map((p) => p[0])),
  maxX: Math.max(...ps.map((p) => p[0])),
  minY: Math.min(...ps.map((p) => p[1])),
  maxY: Math.max(...ps.map((p) => p[1])),
});

const expectFinite = (ps: Point[]) => {
  ps.forEach((p) => p.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
};

const expectClosed = (ps: Point[]) => {
  expect(ps[ps.length - 1][0]).toBeCloseTo(ps[0][0], 10);
  expect(ps[ps.length - 1][1]).toBeCloseTo(ps[0][1], 10);
};

describe("LaserPointer options", () => {
  it("uses the defaults when no options are passed", () => {
    const lp = new LaserPointer({});
    expect(lp.options).toEqual(LaserPointer.defaults);
    expect(lp.options).not.toBe(LaserPointer.defaults);
  });

  it("merges overrides without mutating the defaults", () => {
    const lp = new LaserPointer({ size: 7, keepHead: true });
    expect(lp.options.size).toBe(7);
    expect(lp.options.keepHead).toBe(true);
    expect(lp.options.streamline).toBe(LaserPointer.defaults.streamline);
    expect(LaserPointer.defaults.size).toBe(2);
    expect(LaserPointer.defaults.keepHead).toBe(false);
  });

  it("halves corner detection sensitivity above speed 35", () => {
    const { cornerDetectionVariance } = LaserPointer.constants;
    expect(cornerDetectionVariance(10)).toBe(1);
    expect(cornerDetectionVariance(35)).toBe(1);
    expect(cornerDetectionVariance(36)).toBe(0.5);
  });
});

describe("LaserPointer.addPoint", () => {
  it("records original points and skips consecutive duplicates", () => {
    const lp = makePointer([
      [0, 0, 1],
      [0, 0, 0.5],
      [5, 0, 1],
      [5, 0, 1],
      [0, 0, 1],
    ]);
    expect(lp.originalPoints).toEqual([
      [0, 0, 1],
      [5, 0, 1],
      [0, 0, 1],
    ]);
  });

  it("keeps raw input in originalPoints even when streamlining", () => {
    const lp = makePointer(
      [
        [0, 0, 1],
        [10, 0, 1],
      ],
      { streamline: 0.5 },
    );
    expect(lp.originalPoints).toEqual([
      [0, 0, 1],
      [10, 0, 1],
    ]);
  });

  it("streamlines new points toward the previous point", () => {
    const size = 1;
    const raw = makePointer(
      [
        [0, 0, 1],
        [10, 0, 1],
      ],
      { size },
    ).getStrokeOutline();
    const smoothed = makePointer(
      [
        [0, 0, 1],
        [10, 0, 1],
      ],
      { size, streamline: 0.5 },
    ).getStrokeOutline();

    expect(bounds(raw).maxX).toBeCloseTo(10 + size, 5);
    expect(bounds(smoothed).maxX).toBeCloseTo(5 + size, 5);
  });

  it("stabilizes the tail once it grows past maxTailLength", () => {
    const lp = makePointer(
      [
        [0, 0, 1],
        [10, 0, 1],
        [20, 0, 1],
        [30, 0, 1],
      ],
      { simplify: 1, simplifyPhase: "tail" },
    );
    // tail is still short: no stabilization yet
    expect(lp.originalPoints).toHaveLength(4);
    // a long jump exceeds the tail limit and triggers stabilizeTail
    expect(() => lp.addPoint([100, 0, 1])).toThrow("Not implemented yet");
  });
});

describe("LaserPointer.close / stabilizeTail", () => {
  it("throws for the unimplemented tail simplify phase", () => {
    const lp = makePointer(
      [
        [0, 0, 1],
        [5, 5, 1],
      ],
      { simplify: 0.5, simplifyPhase: "tail" },
    );
    expect(() => lp.close()).toThrow("Not implemented yet");
  });

  it("does not throw for the tail phase when simplify is 0", () => {
    const lp = makePointer(
      [
        [0, 0, 1],
        [5, 5, 1],
      ],
      { simplify: 0, simplifyPhase: "tail" },
    );
    expect(() => lp.close()).not.toThrow();
  });

  it("keeps the outline unchanged after closing", () => {
    const lp = makePointer([
      [0, 0, 1],
      [20, 0, 1],
      [40, 10, 1],
      [60, 0, 1],
    ]);
    const before = lp.getStrokeOutline();
    lp.close();
    expect(lp.getStrokeOutline()).toEqual(before);
    lp.addPoint([80, 10, 1]);
    expect(lp.getStrokeOutline().length).toBeGreaterThan(0);
  });
});

describe("LaserPointer.getStrokeOutline", () => {
  it("returns an empty outline before any point is added", () => {
    expect(new LaserPointer({}).getStrokeOutline()).toEqual([]);
  });

  describe("single point", () => {
    it("returns a closed circle of radius size around the point", () => {
      const outline = makePointer([[10, 20, 1]], {
        size: 3,
      }).getStrokeOutline();
      expect(outline).toHaveLength(33);
      outline.forEach((p) => {
        expect(dist(p, [10, 20, 0])).toBeCloseTo(3, 10);
      });
      expectClosed(outline);
    });

    it("uses sizeOverride instead of options.size", () => {
      const outline = makePointer([[0, 0, 1]], { size: 3 }).getStrokeOutline(6);
      outline.forEach((p) => expect(dist(p, [0, 0, 0])).toBeCloseTo(6, 10));
    });

    it("scales the radius with sizeMapping and passes the pressure", () => {
      const sizeMapping = vi.fn(
        ({ pressure }: SizeMappingDetails) => pressure * 2,
      );
      const outline = makePointer([[0, 0, 0.75]], {
        size: 2,
        sizeMapping,
      }).getStrokeOutline();
      expect(sizeMapping).toHaveBeenCalledWith({
        pressure: 0.75,
        runningLength: 0,
        currentIndex: 0,
        totalLength: 1,
      });
      outline.forEach((p) => expect(dist(p, [0, 0, 0])).toBeCloseTo(3, 10));
    });

    it("returns nothing when the size is below 0.5", () => {
      expect(
        makePointer([[0, 0, 1]], { size: 0.4 }).getStrokeOutline(),
      ).toEqual([]);
    });
  });

  describe("two points", () => {
    it("returns a closed capsule around both points", () => {
      const size = 2;
      const outline = makePointer(
        [
          [0, 0, 1],
          [10, 0, 1],
        ],
        { size },
      ).getStrokeOutline();

      expect(outline.length).toBeGreaterThan(30);
      expect(outline[outline.length - 1]).toBe(outline[0]);
      outline.forEach((p) => {
        const d = Math.min(dist(p, [0, 0, 0]), dist(p, [10, 0, 0]));
        expect(d).toBeCloseTo(size, 10);
      });
      const b = bounds(outline);
      expect(b.minX).toBeCloseTo(-size, 5);
      expect(b.maxX).toBeCloseTo(10 + size, 5);
      expect(b.maxY).toBeCloseTo(size, 5);
      expect(b.minY).toBeCloseTo(-size, 5);
    });

    it("returns nothing when either end is below 0.5", () => {
      const sizeMapping = ({ pressure }: SizeMappingDetails) => pressure;
      expect(
        makePointer(
          [
            [0, 0, 0.1],
            [10, 0, 1],
          ],
          { size: 1, sizeMapping },
        ).getStrokeOutline(),
      ).toEqual([]);
      expect(
        makePointer(
          [
            [0, 0, 1],
            [10, 0, 0.1],
          ],
          { size: 1, sizeMapping },
        ).getStrokeOutline(),
      ).toEqual([]);
    });

    it("collapses collinear input to two points with input simplification", () => {
      const points: Point[] = [
        [0, 0, 1],
        [5, 0, 1],
        [10, 0, 1],
      ];
      const simplified = makePointer(points, {
        size: 2,
        simplify: 0.5,
        simplifyPhase: "input",
      }).getStrokeOutline();
      const twoPoint = makePointer(
        [
          [0, 0, 1],
          [10, 0, 1],
        ],
        { size: 2 },
      ).getStrokeOutline();
      expect(simplified).toEqual(twoPoint);
    });
  });

  describe("three or more points", () => {
    const line: Point[] = [
      [0, 0, 1],
      [10, 0, 1],
      [20, 0, 1],
      [30, 0, 1],
    ];

    it("returns a closed outline enclosing a straight stroke", () => {
      const size = 2;
      const outline = makePointer(line, { size }).getStrokeOutline();
      expectFinite(outline);
      expectClosed(outline);
      const b = bounds(outline);
      expect(b.minX).toBeCloseTo(-size, 5);
      expect(b.maxX).toBeCloseTo(30 + size, 5);
      expect(b.minY).toBeCloseTo(-size, 5);
      expect(b.maxY).toBeCloseTo(size, 5);
    });

    it("reports index, running length and total length to sizeMapping", () => {
      const calls: SizeMappingDetails[] = [];
      makePointer(line, {
        sizeMapping: (d) => {
          calls.push(d);
          return 1;
        },
      }).getStrokeOutline();

      expect(calls).toContainEqual({
        pressure: 1,
        currentIndex: 1,
        runningLength: 10,
        totalLength: 4,
      });
      expect(calls).toContainEqual({
        pressure: 1,
        currentIndex: 2,
        runningLength: 20,
        totalLength: 4,
      });
      // start cap
      expect(calls).toContainEqual({
        pressure: 1,
        currentIndex: 0,
        runningLength: 0,
        totalLength: 4,
      });
    });

    it("scales the outline with sizeOverride", () => {
      const outline = makePointer(line, { size: 2 }).getStrokeOutline(5);
      const b = bounds(outline);
      expect(b.maxY).toBeCloseTo(5, 5);
      expect(b.minX).toBeCloseTo(-5, 5);
    });

    it("rounds sharp left and right corners", () => {
      const size = 2;
      const left = makePointer(
        [
          [0, 0, 1],
          [20, 0, 1],
          [0, 5, 1],
        ],
        { size },
      ).getStrokeOutline();
      const right = makePointer(
        [
          [0, 0, 1],
          [20, 0, 1],
          [0, -5, 1],
        ],
        { size },
      ).getStrokeOutline();

      for (const outline of [left, right]) {
        expectFinite(outline);
        expectClosed(outline);
        // the rounded corner reaches size past the turning point
        expect(bounds(outline).maxX).toBeCloseTo(20 + size, 1);
      }
      // mirrored input produces a mirrored outline
      expect(bounds(left).maxY).toBeCloseTo(-bounds(right).minY, 5);
      expect(left.length).toBe(right.length);
    });

    it("handles a full reversal without producing NaN", () => {
      const outline = makePointer(
        [
          [0, 0, 1],
          [10, 0, 1],
          [5, 0, 1],
        ],
        { size: 2 },
      ).getStrokeOutline();
      expectFinite(outline);
      expect(bounds(outline).maxX).toBeCloseTo(12, 1);
    });

    it("treats fast strokes with a tighter corner threshold", () => {
      // 60 degree turn: a corner when slow (< 75deg), not when fast (< 37.5deg)
      const turn = (step: number): Point[] => {
        const pts: Point[] = [];
        for (let i = 0; i <= 4; i++) {
          pts.push([i * step, 0, 1]);
        }
        const last = pts[pts.length - 1];
        pts.push([
          last[0] - step * Math.cos(Math.PI / 3),
          step * Math.sin(Math.PI / 3),
          1,
        ]);
        return pts;
      };
      const slow = makePointer(turn(5), { size: 1 }).getStrokeOutline();
      const fast = makePointer(turn(200), { size: 1 }).getStrokeOutline();
      expectFinite(slow);
      expectFinite(fast);
      // only the slow stroke gets the extra rounded-corner arc points
      expect(slow.length).toBeGreaterThan(fast.length + 5);
    });

    it("skips invisible leading points with a zero size", () => {
      const sizeMapping = ({ currentIndex }: SizeMappingDetails) =>
        currentIndex === 1 ? 0 : 1;
      const outline = makePointer(
        [
          [0, 0, 1],
          [10, 0, 1],
          [20, 0, 1],
          [30, 0, 1],
          [40, 0, 1],
        ],
        { size: 2, sizeMapping },
      ).getStrokeOutline();
      // the stroke now starts at the third point
      expect(bounds(outline).minX).toBeCloseTo(18, 5);
      expect(bounds(outline).maxX).toBeCloseTo(42, 5);
    });

    it("returns nothing when every inner point is invisible", () => {
      expect(
        makePointer(line, { sizeMapping: () => 0 }).getStrokeOutline(),
      ).toEqual([]);
    });

    it("keeps a head circle at the last point with keepHead", () => {
      const outline = makePointer(line, {
        size: 3,
        keepHead: true,
        sizeMapping: () => 0,
      }).getStrokeOutline();
      expect(outline).toHaveLength(33);
      outline.forEach((p) => expect(dist(p, [30, 0, 0])).toBeCloseTo(3, 10));
    });

    it("uses options.size for the end cap with keepHead", () => {
      // sizes taper to 0.5 along the stroke, but keepHead keeps a full end cap
      const sizeMapping = ({ currentIndex }: SizeMappingDetails) =>
        currentIndex === 0 ? 1 : 0.5;
      const plain = makePointer(line, { size: 4, sizeMapping });
      const head = makePointer(line, { size: 4, sizeMapping, keepHead: true });
      expect(bounds(plain.getStrokeOutline()).maxX).toBeCloseTo(32, 5);
      expect(bounds(head.getStrokeOutline()).maxX).toBeCloseTo(34, 5);
    });

    it("uses a flat start when the start cap is tiny", () => {
      const sizeMapping = ({ currentIndex }: SizeMappingDetails) =>
        currentIndex === 0 ? 0.01 : 1;
      const outline = makePointer(line, {
        size: 2,
        sizeMapping,
      }).getStrokeOutline();
      expect(outline[0]).toEqual(line[0]);
      expect(outline[outline.length - 1]).toEqual(line[0]);
      expect(bounds(outline).minX).toBe(0);
    });

    it("simplifies the output outline", () => {
      const raw = makePointer(line, { size: 2 }).getStrokeOutline();
      const simplified = makePointer(line, {
        size: 2,
        simplify: 0.5,
        simplifyPhase: "output",
      }).getStrokeOutline();
      expect(simplified.length).toBeLessThan(raw.length);
      expect(simplified[0]).toEqual(raw[0]);
      expect(simplified[simplified.length - 1]).toEqual(raw[raw.length - 1]);
      const rb = bounds(raw);
      const sb = bounds(simplified);
      expect(sb.minX).toBeCloseTo(rb.minX, 0);
      expect(sb.maxX).toBeCloseTo(rb.maxX, 0);
    });

    it("does not simplify the output for the input phase", () => {
      const zigzag: Point[] = [
        [0, 0, 1],
        [10, 10, 1],
        [20, 0, 1],
        [30, 10, 1],
      ];
      const inputPhase = makePointer(zigzag, {
        size: 2,
        simplify: 0.5,
        simplifyPhase: "input",
      }).getStrokeOutline();
      const none = makePointer(zigzag, { size: 2 }).getStrokeOutline();
      expect(inputPhase).toEqual(none);
    });
  });
});
