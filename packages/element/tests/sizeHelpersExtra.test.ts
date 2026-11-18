import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  getSceneVersion,
  getVisibleElements,
  hashElementsVersion,
  hashString,
} from "../src/index";
import {
  getLockedLinearCursorAlignSize,
  getNormalizedDimensions,
} from "../src/sizeHelpers";

describe("getLockedLinearCursorAlignSize", () => {
  it("locks to horizontal and vertical axes", () => {
    expect(getLockedLinearCursorAlignSize(0, 0, 100, 3)).toEqual({
      width: 100,
      height: 0,
    });
    expect(getLockedLinearCursorAlignSize(0, 0, 3, 100)).toEqual({
      width: 0,
      height: 100,
    });
  });

  it("projects the cursor onto the locked diagonal", () => {
    const { width, height } = getLockedLinearCursorAlignSize(0, 0, 100, 90);
    expect(width).toBeCloseTo(95);
    expect(height).toBeCloseTo(95);
  });

  it("snaps to a custom angle when close enough", () => {
    const customAngle = Math.PI / 6 + 0.1;
    const x = 100 * Math.cos(customAngle);
    const y = 100 * Math.sin(customAngle);

    const { width, height } = getLockedLinearCursorAlignSize(
      0,
      0,
      x,
      y,
      customAngle,
    );
    expect(Math.atan2(height, width)).toBeCloseTo(customAngle);
  });

  it("snaps to the neighbouring step around a custom angle", () => {
    const customAngle = Math.PI / 6 + 0.1;
    const step = Math.PI / 12;

    const above = customAngle + 0.1;
    const resAbove = getLockedLinearCursorAlignSize(
      0,
      0,
      100 * Math.cos(above),
      100 * Math.sin(above),
      customAngle,
    );
    expect(Math.atan2(resAbove.height, resAbove.width)).toBeCloseTo(3 * step);

    const below = customAngle - 0.07;
    const resBelow = getLockedLinearCursorAlignSize(
      0,
      0,
      100 * Math.cos(below),
      100 * Math.sin(below),
      customAngle,
    );
    expect(Math.atan2(resBelow.height, resBelow.width)).toBeCloseTo(2 * step);
  });
});

describe("getNormalizedDimensions", () => {
  it("flips negative dimensions", () => {
    expect(
      getNormalizedDimensions({ x: 10, y: 20, width: -30, height: -40 }),
    ).toEqual({ x: -20, y: -20, width: 30, height: 40 });
    expect(
      getNormalizedDimensions({ x: 10, y: 20, width: 30, height: 40 }),
    ).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });
});

describe("scene version helpers", () => {
  it("getSceneVersion sums versions and hashElementsVersion tracks nonces", () => {
    const a = API.createElement({});
    const b = API.createElement({});

    expect(getSceneVersion([a, b])).toBe(a.version + b.version);
    expect(hashElementsVersion([a, b])).toBe(
      hashElementsVersion(
        new Map([
          [a.id, a],
          [b.id, b],
        ]),
      ),
    );
    expect(hashElementsVersion([a, b])).not.toBe(
      hashElementsVersion([a, { ...b, versionNonce: b.versionNonce + 1 }]),
    );
  });

  it("hashString is stable", () => {
    expect(hashString("")).toBe(5381);
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  it("getVisibleElements drops deleted and invisibly small elements", () => {
    const visible = API.createElement({});
    const deleted = API.createElement({ isDeleted: true });
    const tiny = API.createElement({ width: 0, height: 0 });

    expect(getVisibleElements([visible, deleted, tiny])).toEqual([visible]);
  });
});
