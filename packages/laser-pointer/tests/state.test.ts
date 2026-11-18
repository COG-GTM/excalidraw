import { LaserPointer } from "@excalidraw/laser-pointer";

import type { Point } from "@excalidraw/laser-pointer";
import type {
  LaserPointerOptions,
  SizeMappingDetails,
} from "@excalidraw/laser-pointer";

import { dist, distancePointToSegment } from "../src/math";

const createPointer = (
  points: Point[],
  options: Partial<LaserPointerOptions> = {},
) => {
  const pointer = new LaserPointer({
    streamline: 0,
    simplify: 0,
    ...options,
  });
  for (const point of points) {
    pointer.addPoint(point);
  }
  return pointer;
};

/** distance from `point` to the closest segment of the `path` polyline */
const distanceToPath = (point: Point, path: Point[]) => {
  if (path.length === 1) {
    return dist(point, path[0]);
  }
  let min = Infinity;
  for (let i = 1; i < path.length; i++) {
    min = Math.min(min, distancePointToSegment(point, path[i - 1], path[i]));
  }
  return min;
};

const expectOutlineAroundPath = (
  outline: Point[],
  path: Point[],
  size: number,
) => {
  expect(outline.length).toBeGreaterThan(0);
  for (const point of outline) {
    expect(Number.isFinite(point[0])).toBe(true);
    expect(Number.isFinite(point[1])).toBe(true);
    expect(distanceToPath(point, path)).toBeLessThanOrEqual(size + 1e-6);
  }
};

const expectClosed = (outline: Point[]) => {
  expect(outline[0]).toEqual(outline[outline.length - 1]);
};

describe("LaserPointer", () => {
  describe("options", () => {
    it("uses the static defaults", () => {
      const pointer = new LaserPointer({});
      expect(pointer.options).toEqual(LaserPointer.defaults);
      expect(pointer.options).not.toBe(LaserPointer.defaults);
      expect(LaserPointer.defaults).toMatchObject({
        size: 2,
        streamline: 0.45,
        simplify: 0.1,
        simplifyPhase: "output",
        keepHead: false,
      });
      expect(
        LaserPointer.defaults.sizeMapping({
          pressure: 0.5,
          runningLength: 10,
          currentIndex: 1,
          totalLength: 3,
        }),
      ).toBe(1);
    });

    it("merges provided options over the defaults", () => {
      const sizeMapping = () => 0.5;
      const pointer = new LaserPointer({
        size: 7,
        keepHead: true,
        sizeMapping,
      });
      expect(pointer.options.size).toBe(7);
      expect(pointer.options.keepHead).toBe(true);
      expect(pointer.options.sizeMapping).toBe(sizeMapping);
      expect(pointer.options.streamline).toBe(LaserPointer.defaults.streamline);
    });

    it("exposes corner detection constants", () => {
      expect(LaserPointer.constants.cornerDetectionMaxAngle).toBe(75);
      expect(LaserPointer.constants.maxTailLength).toBe(50);
      expect(LaserPointer.constants.cornerDetectionVariance(10)).toBe(1);
      expect(LaserPointer.constants.cornerDetectionVariance(35)).toBe(1);
      expect(LaserPointer.constants.cornerDetectionVariance(36)).toBe(0.5);
    });
  });

  describe("addPoint", () => {
    it("records original points", () => {
      const pointer = createPointer([
        [0, 0, 1],
        [10, 0, 1],
      ]);
      expect(pointer.originalPoints).toEqual([
        [0, 0, 1],
        [10, 0, 1],
      ]);
    });

    it("ignores a point at the same position as the previous one", () => {
      const pointer = createPointer([
        [0, 0, 1],
        [0, 0, 0.5],
        [10, 0, 1],
        [10, 0, 1],
      ]);
      expect(pointer.originalPoints).toEqual([
        [0, 0, 1],
        [10, 0, 1],
      ]);
    });

    it("accepts a previously visited position when it is not consecutive", () => {
      const pointer = createPointer([
        [0, 0, 1],
        [10, 0, 1],
        [0, 0, 1],
      ]);
      expect(pointer.originalPoints).toHaveLength(3);
    });

    it("pulls points towards the previous point when streamlining", () => {
      const raw = createPointer(
        [
          [0, 0, 1],
          [10, 0, 1],
        ],
        { streamline: 0, size: 1 },
      ).getStrokeOutline();
      const streamlined = createPointer(
        [
          [0, 0, 1],
          [10, 0, 1],
        ],
        { streamline: 0.5, size: 1 },
      ).getStrokeOutline();

      const maxX = (outline: Point[]) =>
        Math.max(...outline.map((point) => point[0]));

      // raw: the end cap reaches 10 + size
      expect(maxX(raw)).toBeCloseTo(11, 5);
      // streamlined: the second point is lerped halfway to x = 5
      expect(maxX(streamlined)).toBeCloseTo(6, 5);
    });

    it("keeps streamlined original points untouched", () => {
      const pointer = createPointer(
        [
          [0, 0, 1],
          [10, 0, 1],
        ],
        { streamline: 0.5 },
      );
      expect(pointer.originalPoints).toEqual([
        [0, 0, 1],
        [10, 0, 1],
      ]);
    });

    it("stabilizes the tail once it gets longer than maxTailLength", () => {
      const pointer = createPointer([[0, 0, 1]]);
      const stabilizeTail = vi.spyOn(pointer, "stabilizeTail");

      pointer.addPoint([10, 0, 1]);
      expect(stabilizeTail).not.toHaveBeenCalled();

      pointer.addPoint([100, 0, 1]);
      expect(stabilizeTail).toHaveBeenCalledTimes(1);
    });
  });

  describe("stabilizeTail / close", () => {
    it("throws for the unimplemented tail simplify phase", () => {
      const pointer = createPointer([[0, 0, 1]], {
        simplify: 0.1,
        simplifyPhase: "tail",
      });
      expect(() => pointer.stabilizeTail()).toThrow("Not implemented yet");
      expect(() => pointer.close()).toThrow("Not implemented yet");
    });

    it("does not throw for the tail phase when simplify is disabled", () => {
      const pointer = createPointer(
        [
          [0, 0, 1],
          [10, 0, 1],
        ],
        { simplify: 0, simplifyPhase: "tail" },
      );
      expect(() => pointer.close()).not.toThrow();
    });

    it("does not change the outline when closing", () => {
      const points: Point[] = [
        [0, 0, 1],
        [10, 0, 1],
        [20, 5, 1],
        [30, 0, 1],
      ];
      const before = createPointer(points).getStrokeOutline();
      const pointer = createPointer(points);
      pointer.close();
      expect(pointer.getStrokeOutline()).toEqual(before);
    });
  });

  describe("getStrokeOutline", () => {
    it("returns an empty outline before any point is added", () => {
      expect(new LaserPointer({}).getStrokeOutline()).toEqual([]);
    });

    describe("single point", () => {
      it("returns a closed circle around the point", () => {
        const outline = createPointer([[5, 5, 1]], {
          size: 3,
        }).getStrokeOutline();

        // 0..2PI in PI/16 steps, plus a closing point
        expect(outline.length).toBeGreaterThanOrEqual(33);
        for (const point of outline) {
          expect(dist(point, [5, 5, 0])).toBeCloseTo(3, 9);
        }
        expect(outline[0][0]).toBeCloseTo(8);
        expect(outline[0][1]).toBeCloseTo(5);
        expect(outline[outline.length - 1][0]).toBeCloseTo(8);
        expect(outline[outline.length - 1][1]).toBeCloseTo(5);
      });

      it("uses sizeOverride instead of options.size", () => {
        const outline = createPointer([[0, 0, 1]], {
          size: 3,
        }).getStrokeOutline(10);
        for (const point of outline) {
          expect(dist(point, [0, 0, 0])).toBeCloseTo(10, 9);
        }
      });

      it("scales the size with sizeMapping", () => {
        const outline = createPointer([[0, 0, 1]], {
          size: 4,
          sizeMapping: () => 0.5,
        }).getStrokeOutline();
        for (const point of outline) {
          expect(dist(point, [0, 0, 0])).toBeCloseTo(2, 9);
        }
      });

      it("returns nothing when the size is below 0.5", () => {
        expect(
          createPointer([[0, 0, 1]], { size: 0.4 }).getStrokeOutline(),
        ).toEqual([]);
      });

      it("simplifies the output", () => {
        const pointer = createPointer([[0, 0, 1]], { size: 3 });
        const full = pointer.getStrokeOutline();

        pointer.options.simplify = 1;
        const simplified = pointer.getStrokeOutline();
        // single point outlines are returned before output simplification
        expect(simplified).toEqual(full);
      });
    });

    describe("two points", () => {
      const points: Point[] = [
        [0, 0, 1],
        [20, 0, 1],
      ];

      it("returns a closed capsule around the segment", () => {
        const outline = createPointer(points, { size: 2 }).getStrokeOutline();
        expectClosed(outline);
        expectOutlineAroundPath(outline, points, 2);

        const xs = outline.map((point) => point[0]);
        const ys = outline.map((point) => point[1]);
        expect(Math.min(...xs)).toBeCloseTo(-2, 5);
        expect(Math.max(...xs)).toBeCloseTo(22, 5);
        expect(Math.min(...ys)).toBeCloseTo(-2, 5);
        expect(Math.max(...ys)).toBeCloseTo(2, 5);
      });

      it("returns nothing when either end is below 0.5", () => {
        expect(createPointer(points, { size: 0.4 }).getStrokeOutline()).toEqual(
          [],
        );
        expect(
          createPointer(points, {
            size: 2,
            sizeMapping: ({ pressure }) => pressure,
          }).getStrokeOutline(),
        ).not.toEqual([]);
        expect(
          createPointer(
            [
              [0, 0, 1],
              [20, 0, 0.1],
            ],
            { size: 2, sizeMapping: ({ pressure }) => pressure },
          ).getStrokeOutline(),
        ).toEqual([]);
        expect(
          createPointer(
            [
              [0, 0, 0.1],
              [20, 0, 1],
            ],
            { size: 2, sizeMapping: ({ pressure }) => pressure },
          ).getStrokeOutline(),
        ).toEqual([]);
      });
    });

    describe("three or more points", () => {
      it("outlines a straight stroke within size of the path", () => {
        const points: Point[] = [
          [0, 0, 1],
          [10, 0, 1],
          [20, 0, 1],
          [30, 0, 1],
        ];
        const outline = createPointer(points, { size: 2 }).getStrokeOutline();

        expectClosed(outline);
        expectOutlineAroundPath(outline, points, 2);

        const xs = outline.map((point) => point[0]);
        const ys = outline.map((point) => point[1]);
        expect(Math.min(...xs)).toBeCloseTo(-2, 5);
        expect(Math.max(...xs)).toBeCloseTo(32, 5);
        expect(Math.min(...ys)).toBeCloseTo(-2, 5);
        expect(Math.max(...ys)).toBeCloseTo(2, 5);
      });

      it("outlines a sharp counter-clockwise corner", () => {
        const points: Point[] = [
          [0, 0, 1],
          [100, 0, 1],
          [0, 10, 1],
        ];
        const outline = createPointer(points, { size: 2 }).getStrokeOutline();
        expectClosed(outline);
        expectOutlineAroundPath(outline, points, 2);
      });

      it("outlines a sharp clockwise corner", () => {
        const points: Point[] = [
          [0, 0, 1],
          [100, 0, 1],
          [0, -10, 1],
        ];
        const outline = createPointer(points, { size: 2 }).getStrokeOutline();
        expectClosed(outline);
        expectOutlineAroundPath(outline, points, 2);
      });

      it("mirrors the outline of mirrored corners", () => {
        const ccw = createPointer(
          [
            [0, 0, 1],
            [100, 0, 1],
            [0, 10, 1],
          ],
          { size: 2 },
        ).getStrokeOutline();
        const cw = createPointer(
          [
            [0, 0, 1],
            [100, 0, 1],
            [0, -10, 1],
          ],
          { size: 2 },
        ).getStrokeOutline();

        const ys = (outline: Point[]) => outline.map((point) => point[1]);
        const xs = (outline: Point[]) => outline.map((point) => point[0]);

        expect(Math.max(...ys(cw))).toBeCloseTo(-Math.min(...ys(ccw)), 6);
        expect(Math.min(...ys(cw))).toBeCloseTo(-Math.max(...ys(ccw)), 6);
        expect(Math.max(...xs(cw))).toBeCloseTo(Math.max(...xs(ccw)), 6);
        expect(Math.min(...xs(cw))).toBeCloseTo(Math.min(...xs(ccw)), 6);
      });

      it("detects fewer corners at high speed", () => {
        // a 60deg interior angle is a corner at low speed (< 75deg) but not
        // when the variance halves the threshold (37.5deg) for fast strokes
        const turn = (scale: number): Point[] => [
          [0, 0, 1],
          [scale, 0, 1],
          [scale * 0.5, scale * Math.sin(Math.PI / 3), 1],
        ];
        const slow = createPointer(turn(20), {
          size: 2,
        }).getStrokeOutline();
        const fast = createPointer(turn(1000), {
          size: 2,
        }).getStrokeOutline();

        expectClosed(slow);
        expectClosed(fast);
        // slow corner adds the rounded joint, fast stroke only the miter point
        expect(slow.length).toBeGreaterThan(fast.length);
      });

      it("passes size mapping details for every point", () => {
        const details: SizeMappingDetails[] = [];
        createPointer(
          [
            [0, 0, 0.2],
            [3, 4, 0.4],
            [6, 8, 0.6],
          ],
          {
            size: 2,
            sizeMapping: (detail) => {
              details.push({ ...detail });
              return 1;
            },
          },
        ).getStrokeOutline();

        expect(details).toContainEqual({
          pressure: 0.4,
          runningLength: 5,
          currentIndex: 1,
          totalLength: 3,
        });
        // start cap
        expect(details).toContainEqual({
          pressure: 0.2,
          runningLength: 0,
          currentIndex: 0,
          totalLength: 3,
        });
        expect(details.every((detail) => detail.totalLength === 3)).toBe(true);
      });

      it("hides points whose size maps to 0", () => {
        const points: Point[] = [
          [0, 0, 0],
          [10, 0, 0],
          [20, 0, 1],
          [30, 0, 1],
          [40, 0, 1],
        ];
        const outline = createPointer(points, {
          size: 2,
          sizeMapping: ({ pressure }) => pressure,
        }).getStrokeOutline();

        expectOutlineAroundPath(outline, points, 2);
        // the hidden head of the stroke (x < 10) is not outlined
        for (const point of outline) {
          expect(point[0]).toBeGreaterThan(10 - 1e-6);
        }
      });

      it("returns nothing when all visible points are hidden", () => {
        const outline = createPointer(
          [
            [0, 0, 1],
            [10, 0, 1],
            [20, 0, 1],
          ],
          { size: 2, sizeMapping: () => 0 },
        ).getStrokeOutline();
        expect(outline).toEqual([]);
      });

      it("keeps a circle at the head when all points are hidden and keepHead is set", () => {
        const outline = createPointer(
          [
            [0, 0, 1],
            [10, 0, 1],
            [20, 0, 1],
          ],
          { size: 3, keepHead: true, sizeMapping: () => 0 },
        ).getStrokeOutline();

        expect(outline.length).toBeGreaterThanOrEqual(33);
        for (const point of outline) {
          expect(dist(point, [20, 0, 0])).toBeCloseTo(3, 9);
        }
      });

      it("sizes the end cap with options.size when keepHead is set", () => {
        const points: Point[] = [
          [0, 0, 1],
          [10, 0, 1],
          [20, 0, 1],
        ];
        const outline = createPointer(points, {
          size: 4,
          keepHead: true,
          sizeMapping: () => 0.25,
        }).getStrokeOutline();

        const maxX = Math.max(...outline.map((point) => point[0]));
        expect(maxX).toBeCloseTo(24, 5);

        const withoutKeepHead = createPointer(points, {
          size: 4,
          sizeMapping: () => 0.25,
        }).getStrokeOutline();
        expect(
          Math.max(...withoutKeepHead.map((point) => point[0])),
        ).toBeCloseTo(21, 5);
      });

      it("uses a single point as the start cap when it is tiny", () => {
        const points: Point[] = [
          [0, 0, 1],
          [10, 0, 1],
          [20, 0, 1],
        ];
        const outline = createPointer(points, {
          size: 2,
          sizeMapping: ({ runningLength }) => (runningLength === 0 ? 0.01 : 1),
        }).getStrokeOutline();

        expect(outline[0]).toEqual([0, 0, 1]);
        expect(outline).toContainEqual([0, 0, 1]);
        expect(
          outline.filter((p) => p[0] === 0 && p[1] === 0 && p[2] === 1),
        ).toHaveLength(2);
      });

      it("honors sizeOverride", () => {
        const points: Point[] = [
          [0, 0, 1],
          [10, 0, 1],
          [20, 0, 1],
        ];
        const outline = createPointer(points, {
          size: 2,
        }).getStrokeOutline(5);
        expectOutlineAroundPath(outline, points, 5);
        expect(Math.max(...outline.map((point) => point[1]))).toBeCloseTo(5, 5);
      });

      it("simplifies the output outline", () => {
        const points: Point[] = [
          [0, 0, 1],
          [10, 0, 1],
          [20, 0, 1],
          [30, 0, 1],
        ];
        const full = createPointer(points, {
          size: 2,
          simplify: 0,
        }).getStrokeOutline();
        const simplified = createPointer(points, {
          size: 2,
          simplify: 0.5,
          simplifyPhase: "output",
        }).getStrokeOutline();

        expect(simplified.length).toBeLessThan(full.length);
        expectOutlineAroundPath(simplified, points, 2);
        expect(simplified[0]).toEqual(full[0]);
        expect(simplified[simplified.length - 1]).toEqual(
          full[full.length - 1],
        );
      });

      it("simplifies the input points", () => {
        const points: Point[] = [
          [0, 0, 1],
          [10, 0.01, 1],
          [20, 0, 1],
        ];
        const pointer = createPointer(points, {
          size: 2,
          simplify: 0.5,
          simplifyPhase: "input",
        });
        const outline = pointer.getStrokeOutline();

        // collapses to a two point capsule from 0 to 20
        const twoPoint = createPointer(
          [
            [0, 0, 1],
            [20, 0, 1],
          ],
          { size: 2 },
        ).getStrokeOutline();
        expect(outline).toEqual(twoPoint);
      });

      it("includes points still in the tail", () => {
        const pointer = createPointer([
          [0, 0, 1],
          [5, 0, 1],
          [10, 0, 1],
        ]);
        const outline = pointer.getStrokeOutline();
        expect(Math.max(...outline.map((point) => point[0]))).toBeCloseTo(
          12,
          5,
        );
      });
    });
  });
});
