import { arrayToMap, ROUNDNESS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import { distanceToElement } from "../src/distance";

import type { ExcalidrawElement } from "../src/types";

const distanceTo = (element: ExcalidrawElement, x: number, y: number) =>
  distanceToElement(
    element,
    arrayToMap([element]),
    pointFrom<GlobalPoint>(x, y),
  );

describe("distanceToElement", () => {
  describe("rectanguloid elements", () => {
    it("measures distance to the outline of a sharp rectangle", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        roundness: null,
      });

      expect(distanceTo(rect, 100, 50)).toBeCloseTo(0, 5);
      expect(distanceTo(rect, 50, 0)).toBeCloseTo(0, 5);
      expect(distanceTo(rect, 150, 50)).toBeCloseTo(50, 5);
      expect(distanceTo(rect, 50, -30)).toBeCloseTo(30, 5);
      // inside points measure the distance to the nearest edge
      expect(distanceTo(rect, 50, 50)).toBeCloseTo(50, 5);
      expect(distanceTo(rect, 90, 50)).toBeCloseTo(10, 5);
      // sharp corner
      expect(distanceTo(rect, 0, 0)).toBeCloseTo(0, 2);
      expect(distanceTo(rect, 110, 110)).toBeCloseTo(Math.hypot(10, 10), 1);
    });

    it("accounts for roundness at the corners", () => {
      const rounded = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      });

      // edges are unaffected by roundness
      expect(distanceTo(rounded, 100, 50)).toBeCloseTo(0, 5);
      expect(distanceTo(rounded, 150, 50)).toBeCloseTo(50, 5);

      // radius = 25, the corner bezier passes through (6.25, 6.25)
      const cornerDistance = Math.hypot(6.25, 6.25);
      expect(distanceTo(rounded, 0, 0)).toBeCloseTo(cornerDistance, 1);
      expect(distanceTo(rounded, 100, 100)).toBeCloseTo(cornerDistance, 1);
      expect(distanceTo(rounded, 6.25, 6.25)).toBeCloseTo(0, 1);
    });

    it("uses a fixed radius for adaptive roundness", () => {
      const rounded = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 32 },
      });

      // radius = 32, the corner bezier passes through (8, 8)
      expect(distanceTo(rounded, 0, 0)).toBeCloseTo(Math.hypot(8, 8), 1);
      expect(distanceTo(rounded, 200, 100)).toBeCloseTo(0, 5);
    });

    it("accounts for rotation", () => {
      // center at (50, 25); rotated by 90deg it spans x: 25..75, y: -25..75
      const rect = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        angle: (Math.PI / 2) as Radians,
        roundness: null,
      });

      expect(distanceTo(rect, 50, -25)).toBeCloseTo(0, 5);
      expect(distanceTo(rect, 75, 25)).toBeCloseTo(0, 5);
      // on the unrotated right edge, but 25px outside the rotated one
      expect(distanceTo(rect, 100, 25)).toBeCloseTo(25, 5);
      expect(distanceTo(rect, 50, -45)).toBeCloseTo(20, 5);
    });

    it.each(["text", "frame", "image", "embeddable"] as const)(
      "dispatches %s elements to the rectanguloid distance",
      (type) => {
        const element = API.createElement({
          type,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          roundness: null,
        });

        expect(distanceTo(element, 100, 50)).toBeCloseTo(0, 5);
        expect(distanceTo(element, 150, 50)).toBeCloseTo(50, 5);
        expect(distanceTo(element, 50, 50)).toBeCloseTo(50, 5);
      },
    );
  });

  describe("diamond elements", () => {
    // vertices: top (51, 0), right (100, 51), bottom (51, 100), left (0, 51)
    const createDiamond = (
      opts: Partial<Parameters<typeof API.createElement>[0]> = {},
    ) =>
      API.createElement({
        type: "diamond",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        roundness: null,
        ...opts,
      });

    it("measures distance to the diamond outline, not its bounding box", () => {
      const diamond = createDiamond();

      // midpoint of the top-right edge
      expect(distanceTo(diamond, 75.5, 25.5)).toBeCloseTo(0, 5);
      // bounding box corner is outside the diamond: distance to the
      // top-right edge, direction (49, 51)
      expect(distanceTo(diamond, 100, 0)).toBeCloseTo(
        (49 * 51) / Math.hypot(49, 51),
        1,
      );
      // center is closest to the shorter bottom-right edge, direction (-49, 49)
      expect(distanceTo(diamond, 51, 51)).toBeCloseTo(49 / Math.SQRT2, 1);
      // just outside the right vertex
      expect(distanceTo(diamond, 110, 51)).toBeCloseTo(10, 0);
      expect(distanceTo(diamond, 110, 51)).toBeGreaterThan(10);
    });

    it("accounts for roundness at the vertices", () => {
      const sharp = createDiamond();
      const rounded = createDiamond({
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      });

      expect(distanceTo(sharp, 100, 51)).toBeLessThan(0.5);
      // rounded vertex is pulled inwards by the corner curve
      expect(distanceTo(rounded, 100, 51)).toBeGreaterThan(2);
      expect(distanceTo(rounded, 100, 51)).toBeLessThan(5);
      // edges are unaffected by roundness
      expect(distanceTo(rounded, 75.5, 25.5)).toBeCloseTo(0, 5);
    });

    it("accounts for rotation", () => {
      // rotated by 45deg the edges become axis aligned around center (50, 50)
      const diamond = createDiamond({
        width: 98,
        height: 98,
        angle: (Math.PI / 4) as Radians,
      });
      const halfSide = 49 / Math.SQRT2;

      expect(distanceTo(diamond, 49 + halfSide, 49)).toBeCloseTo(0, 1);
      expect(distanceTo(diamond, 49 + halfSide + 20, 49)).toBeCloseTo(20, 1);
      // the unrotated right vertex is now outside the outline
      expect(distanceTo(diamond, 98, 50)).toBeCloseTo(49 - halfSide, 0);
    });
  });

  describe("ellipse elements", () => {
    // center (100, 50), semi-axes a = 100, b = 50
    const createEllipse = (angle = 0) =>
      API.createElement({
        type: "ellipse",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        angle: angle as Radians,
      });

    it("measures distance to the ellipse outline", () => {
      const ellipse = createEllipse();

      expect(distanceTo(ellipse, 200, 50)).toBeCloseTo(0, 3);
      expect(distanceTo(ellipse, 100, 0)).toBeCloseTo(0, 3);
      expect(distanceTo(ellipse, 250, 50)).toBeCloseTo(50, 3);
      expect(distanceTo(ellipse, 100, -20)).toBeCloseTo(20, 3);
      // bounding box corner is outside the ellipse
      expect(distanceTo(ellipse, 200, 100)).toBeGreaterThan(20);
      // inside points measure the distance to the nearest outline point
      expect(distanceTo(ellipse, 100, 40)).toBeCloseTo(40, 3);
      expect(distanceTo(ellipse, 180, 50)).toBeCloseTo(20, 1);
    });

    it("accounts for rotation", () => {
      // rotated by 90deg: major axis is vertical, spans y: -50..150
      const ellipse = createEllipse(Math.PI / 2);

      expect(distanceTo(ellipse, 100, -50)).toBeCloseTo(0, 3);
      expect(distanceTo(ellipse, 150, 50)).toBeCloseTo(0, 3);
      // on the unrotated outline, 50px away from the rotated one
      expect(distanceTo(ellipse, 200, 50)).toBeCloseTo(50, 3);
    });
  });

  describe("linear and freedraw elements", () => {
    it("measures distance to straight line segments", () => {
      const line = API.createElement({
        type: "line",
        x: 10,
        y: 10,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        roundness: null,
      });

      expect(distanceTo(line, 60, 10)).toBeCloseTo(0, 5);
      expect(distanceTo(line, 60, 30)).toBeCloseTo(20, 5);
      // past the end point measures to the end point
      expect(distanceTo(line, 130, 10)).toBeCloseTo(20, 5);
      expect(distanceTo(line, 0, 10)).toBeCloseTo(10, 5);
    });

    it("measures distance to the nearest segment of a multi-point arrow", () => {
      const arrow = API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(100, 100),
        ],
        roundness: null,
      });

      expect(distanceTo(arrow, 100, 50)).toBeCloseTo(0, 5);
      expect(distanceTo(arrow, 150, 50)).toBeCloseTo(50, 5);
      expect(distanceTo(arrow, 50, 30)).toBeCloseTo(30, 5);
      // closer to the second segment than the first
      expect(distanceTo(arrow, 90, 60)).toBeCloseTo(10, 5);
    });

    it("accounts for rotation", () => {
      // center at (50, 0); rotated by 90deg it becomes vertical at x = 50
      const line = API.createElement({
        type: "line",
        x: 0,
        y: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        angle: (Math.PI / 2) as Radians,
        roundness: null,
      });

      expect(distanceTo(line, 50, 40)).toBeCloseTo(0, 0);
      expect(distanceTo(line, 70, 0)).toBeCloseTo(20, 0);
      // on the unrotated line, but away from the rotated one
      expect(distanceTo(line, 0, 0)).toBeCloseTo(50, 0);
      expect(distanceTo(line, 100, 0)).toBeCloseTo(50, 0);
    });

    it("measures distance to curved (rounded) lines", () => {
      const points = [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 50),
        pointFrom<LocalPoint>(100, 0),
      ];
      const sharp = API.createElement({
        type: "line",
        x: 0,
        y: 0,
        points,
        roundness: null,
      });
      const curved = API.createElement({
        type: "line",
        x: 0,
        y: 0,
        points,
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      });

      // the curve still passes through its points (closest point on a curve
      // is solved numerically, hence the looser precision)
      expect(distanceTo(curved, 0, 0)).toBeCloseTo(0, 1);
      expect(distanceTo(curved, 50, 50)).toBeCloseTo(0, 1);
      expect(distanceTo(curved, 100, 0)).toBeCloseTo(0, 1);
      // ...but bulges away from the straight segments between them
      expect(distanceTo(sharp, 25, 25)).toBeCloseTo(0, 5);
      expect(distanceTo(curved, 25, 25)).toBeGreaterThan(1);
    });

    it("measures distance to freedraw strokes", () => {
      const freedraw = API.createElement({
        type: "freedraw",
        x: 10,
        y: 10,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 0),
          pointFrom<LocalPoint>(100, 0),
        ],
      });

      expect(distanceTo(freedraw, 60, 10)).toBeCloseTo(0, 0);
      expect(distanceTo(freedraw, 60, 30)).toBeCloseTo(20, 1);
      expect(distanceTo(freedraw, 130, 10)).toBeCloseTo(20, 1);
      expect(distanceTo(freedraw, 60, -40)).toBeCloseTo(50, 1);
    });

    it("returns Infinity for a freedraw with a single point", () => {
      const freedraw = API.createElement({
        type: "freedraw",
        x: 10,
        y: 10,
        points: [pointFrom<LocalPoint>(0, 0)],
      });

      expect(distanceTo(freedraw, 10, 10)).toBe(Infinity);
    });
  });
});
