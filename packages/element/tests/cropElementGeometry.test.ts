import { arrayToMap } from "@excalidraw/common";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { Radians } from "@excalidraw/math";

import {
  MINIMAL_CROP_SIZE,
  cropElement,
  getFlipAdjustedCropPosition,
  getUncroppedImageElement,
  getUncroppedWidthAndHeight,
} from "../src/cropElement";
import { newElementWith } from "../src/mutateElement";

import type { ExcalidrawImageElement, ImageCrop } from "../src/types";

// 200x100 image whose natural size is 400x200 (2x scale)
const NATURAL_WIDTH = 400;
const NATURAL_HEIGHT = 200;

const createImage = (
  opts: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    angle?: Radians;
    scale?: ExcalidrawImageElement["scale"];
    crop?: ImageCrop | null;
  } = {},
) => {
  const image = API.createElement({
    type: "image",
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width ?? 200,
    height: opts.height ?? 100,
    angle: opts.angle ?? (0 as Radians),
    scale: opts.scale ?? [1, 1],
  }) as ExcalidrawImageElement;
  return opts.crop ? newElementWith(image, { crop: opts.crop }) : image;
};

const crop = (
  image: ExcalidrawImageElement,
  handle: Parameters<typeof cropElement>[2],
  pointerX: number,
  pointerY: number,
  widthAspectRatio?: number,
) =>
  cropElement(
    image,
    arrayToMap([image]),
    handle,
    NATURAL_WIDTH,
    NATURAL_HEIGHT,
    pointerX,
    pointerY,
    widthAspectRatio,
  );

describe("cropElement", () => {
  it("crops from the east edge, keeping the origin", () => {
    const result = crop(createImage(), "e", 150, 50);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.width).toBeCloseTo(150);
    expect(result.height).toBeCloseTo(100);
    expect(result.crop).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      naturalWidth: NATURAL_WIDTH,
      naturalHeight: NATURAL_HEIGHT,
    });
  });

  it("crops from the west edge, shifting the origin and crop.x", () => {
    const result = crop(createImage(), "w", 50, 50);
    expect(result.x).toBeCloseTo(50);
    expect(result.width).toBeCloseTo(150);
    expect(result.crop?.x).toBeCloseTo(100);
    expect(result.crop?.width).toBeCloseTo(300);
  });

  it("crops from the north edge, shifting the origin and crop.y", () => {
    const result = crop(createImage(), "n", 100, 30);
    expect(result.y).toBeCloseTo(30);
    expect(result.height).toBeCloseTo(70);
    expect(result.crop?.y).toBeCloseTo(60);
    expect(result.crop?.height).toBeCloseTo(140);
  });

  it("crops from the south edge, keeping the origin", () => {
    const result = crop(createImage(), "s", 100, 60);
    expect(result.y).toBeCloseTo(0);
    expect(result.height).toBeCloseTo(60);
    expect(result.crop?.y).toBeCloseTo(0);
    expect(result.crop?.height).toBeCloseTo(120);
  });

  it("crops both axes from a corner handle", () => {
    const result = crop(createImage(), "nw", 40, 20);
    expect(result.x).toBeCloseTo(40);
    expect(result.y).toBeCloseTo(20);
    expect(result.width).toBeCloseTo(160);
    expect(result.height).toBeCloseTo(80);
    expect(result.crop?.x).toBeCloseTo(80);
    expect(result.crop?.y).toBeCloseTo(40);
  });

  it("never crops below the minimal crop size", () => {
    const result = crop(createImage(), "se", -500, -500);
    expect(result.width).toBeCloseTo(MINIMAL_CROP_SIZE);
    expect(result.height).toBeCloseTo(MINIMAL_CROP_SIZE);
  });

  it("never grows beyond the uncropped image", () => {
    const cropped = createImage({
      width: 100,
      crop: {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        naturalWidth: NATURAL_WIDTH,
        naturalHeight: NATURAL_HEIGHT,
      },
    });
    const result = crop(cropped, "e", 1000, 50);
    expect(result.width).toBeCloseTo(200);
  });

  it("resets crop to null when dragged back to the original size", () => {
    const cropped = createImage({
      width: 150,
      crop: {
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        naturalWidth: NATURAL_WIDTH,
        naturalHeight: NATURAL_HEIGHT,
      },
    });
    const result = crop(cropped, "e", 200, 50);
    expect(result.width).toBeCloseTo(200);
    expect(result.crop).toBe(null);
  });

  it("moves crop.x from the east handle when flipped horizontally", () => {
    const result = crop(createImage({ scale: [-1, 1] }), "e", 150, 50);
    expect(result.width).toBeCloseTo(150);
    expect(result.crop?.x).toBeCloseTo(100);
  });

  it("keeps crop.x from the west handle when flipped horizontally", () => {
    const result = crop(createImage({ scale: [-1, 1] }), "w", 50, 50);
    expect(result.width).toBeCloseTo(150);
    expect(result.crop?.x).toBeCloseTo(0);
  });

  it("moves crop.y from the south handle when flipped vertically", () => {
    const result = crop(createImage({ scale: [1, -1] }), "s", 100, 60);
    expect(result.height).toBeCloseTo(60);
    expect(result.crop?.y).toBeCloseTo(80);
  });

  it("keeps the aspect ratio and centers horizontally on edge handles", () => {
    const result = crop(createImage(), "n", 100, 50, 2);
    expect(result.width).toBeCloseTo(100);
    expect(result.height).toBeCloseTo(50);
    expect(result.crop?.x).toBeCloseTo(100);
    expect(result.crop?.y).toBeCloseTo(100);
    expect(result.x).toBeCloseTo(50);
  });

  it("keeps the aspect ratio and centers vertically on side handles", () => {
    const result = crop(createImage(), "e", 100, 50, 4);
    expect(result.width).toBeCloseTo(100);
    expect(result.height).toBeCloseTo(25);
    expect(result.crop?.y).toBeCloseTo(75);
    expect(result.y).toBeCloseTo(37.5);
  });

  it.each(["ne", "nw", "se", "sw"] as const)(
    "keeps the aspect ratio on the %s corner handle",
    (handle) => {
      const pointer = {
        ne: [150, 50],
        nw: [50, 50],
        se: [150, 50],
        sw: [50, 50],
      }[handle];
      const result = crop(createImage(), handle, pointer[0], pointer[1], 2);
      expect(result.width / result.height).toBeCloseTo(2);
      expect(result.width).toBeLessThan(200);
      expect(result.crop!.width / result.crop!.height).toBeCloseTo(2);
    },
  );

  it("rotates the pointer into element space for rotated images", () => {
    const rotated = createImage({ angle: Math.PI as Radians });
    // with a 180° rotation, the visual west side is the element's east side
    const result = crop(rotated, "e", 50, 50);
    expect(result.width).toBeCloseTo(150);
  });
});

describe("getUncroppedWidthAndHeight", () => {
  it("returns the element size when not cropped", () => {
    expect(getUncroppedWidthAndHeight(createImage())).toEqual({
      width: 200,
      height: 100,
    });
  });

  it("scales the size back up by the cropped ratio", () => {
    const image = createImage({
      width: 100,
      height: 50,
      crop: {
        x: 100,
        y: 50,
        width: 200,
        height: 100,
        naturalWidth: NATURAL_WIDTH,
        naturalHeight: NATURAL_HEIGHT,
      },
    });
    expect(getUncroppedWidthAndHeight(image)).toEqual({
      width: 200,
      height: 100,
    });
  });
});

describe("getFlipAdjustedCropPosition", () => {
  const cropped = (scale: ExcalidrawImageElement["scale"]) =>
    createImage({
      width: 100,
      height: 50,
      scale,
      crop: {
        x: 50,
        y: 20,
        width: 200,
        height: 100,
        naturalWidth: NATURAL_WIDTH,
        naturalHeight: NATURAL_HEIGHT,
      },
    });

  it("returns null for uncropped images", () => {
    expect(getFlipAdjustedCropPosition(createImage())).toBe(null);
  });

  it("returns the natural crop position when requested", () => {
    expect(getFlipAdjustedCropPosition(cropped([1, 1]), true)).toEqual({
      x: 50,
      y: 20,
    });
  });

  it("mirrors the crop position on flipped axes", () => {
    expect(getFlipAdjustedCropPosition(cropped([-1, 1]), true)).toEqual({
      x: 150,
      y: 20,
    });
    expect(getFlipAdjustedCropPosition(cropped([1, -1]), true)).toEqual({
      x: 50,
      y: 80,
    });
  });

  it("converts to uncropped element units by default", () => {
    const position = getFlipAdjustedCropPosition(cropped([-1, -1]));
    expect(position?.x).toBeCloseTo(75);
    expect(position?.y).toBeCloseTo(40);
  });
});

describe("getUncroppedImageElement", () => {
  const cropOf = (x: number, y: number): ImageCrop => ({
    x,
    y,
    width: 200,
    height: 100,
    naturalWidth: NATURAL_WIDTH,
    naturalHeight: NATURAL_HEIGHT,
  });

  it("returns the same element when not cropped", () => {
    const image = createImage();
    expect(getUncroppedImageElement(image, arrayToMap([image]))).toBe(image);
  });

  it("restores the full image position and size", () => {
    const image = createImage({
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      crop: cropOf(100, 50),
    });
    const uncropped = getUncroppedImageElement(image, arrayToMap([image]));
    expect(uncropped.x).toBeCloseTo(50);
    expect(uncropped.y).toBeCloseTo(75);
    expect(uncropped.width).toBeCloseTo(200);
    expect(uncropped.height).toBeCloseTo(100);
    expect(uncropped.crop).toBe(null);
    expect(image.crop).not.toBe(null);
  });

  it("accounts for horizontal flips", () => {
    const image = createImage({
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      crop: cropOf(50, 50),
    });
    const flipped = newElementWith(image, { scale: [-1, 1] });
    expect(getUncroppedImageElement(image, arrayToMap([image])).x).toBeCloseTo(
      75,
    );
    expect(
      getUncroppedImageElement(flipped, arrayToMap([flipped])).x,
    ).toBeCloseTo(25);
  });

  it("keeps the center of a centered crop for rotated images", () => {
    const image = createImage({
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      angle: (Math.PI / 3) as Radians,
      crop: cropOf(100, 50),
    });
    const uncropped = getUncroppedImageElement(image, arrayToMap([image]));
    expect(uncropped.x + uncropped.width / 2).toBeCloseTo(150);
    expect(uncropped.y + uncropped.height / 2).toBeCloseTo(125);
    expect(uncropped.angle).toBeCloseTo(Math.PI / 3);
  });
});
