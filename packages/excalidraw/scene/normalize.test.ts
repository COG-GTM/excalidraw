import { MAX_ZOOM, MIN_ZOOM } from "@excalidraw/common";

import {
  getNormalizedGridSize,
  getNormalizedGridStep,
  getNormalizedZoom,
} from "./normalize";

describe("normalize", () => {
  it("getNormalizedZoom rounds and clamps to the zoom range", () => {
    expect(getNormalizedZoom(1.23456789)).toBe(1.234568);
    expect(getNormalizedZoom(0)).toBe(MIN_ZOOM);
    expect(getNormalizedZoom(-5)).toBe(MIN_ZOOM);
    expect(getNormalizedZoom(MAX_ZOOM * 10)).toBe(MAX_ZOOM);
  });

  it.each([
    ["getNormalizedGridSize", getNormalizedGridSize],
    ["getNormalizedGridStep", getNormalizedGridStep],
  ])("%s rounds and clamps to 1..100", (_, normalize) => {
    expect(normalize(20.4)).toBe(20);
    expect(normalize(20.5)).toBe(21);
    expect(normalize(0)).toBe(1);
    expect(normalize(-10)).toBe(1);
    expect(normalize(1000)).toBe(100);
  });
});
