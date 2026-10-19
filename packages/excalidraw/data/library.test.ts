import { API } from "../tests/helpers/api";

import { mergeLibraryItems, validateLibraryUrl } from "./library";

import type { LibraryItem } from "../types";

const createLibraryItem = (
  id: string,
  elements: LibraryItem["elements"],
): LibraryItem => ({
  id,
  status: "unpublished",
  elements,
  created: 1,
});

describe("validateLibraryUrl", () => {
  it("should validate hostname & pathname", () => {
    // valid hostnames
    // -------------------------------------------------------------------------
    expect(
      validateLibraryUrl("https://www.excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://library.excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://library.excalidraw.com", [
        "library.excalidraw.com",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/", ["excalidraw.com/"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com", ["excalidraw.com/"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/", ["excalidraw.com"]),
    ).toBe(true);

    // valid pathnames
    // -------------------------------------------------------------------------
    expect(
      validateLibraryUrl("https://excalidraw.com/path", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/path/", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path/", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path", [
        "excalidraw.com/specific/path/",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path/other", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);

    // invalid hostnames
    // -------------------------------------------------------------------------
    expect(() =>
      validateLibraryUrl("https://xexcalidraw.com", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://x-excalidraw.com", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.comx", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.comx", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com.mx", ["excalidraw.com"]),
    ).toThrow();
    // protocol must be https
    expect(() =>
      validateLibraryUrl("http://excalidraw.com.mx", ["excalidraw.com"]),
    ).toThrow();

    // invalid pathnames
    // -------------------------------------------------------------------------
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/other/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/paths", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/path-s", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/some/specific/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
  });
});

describe("mergeLibraryItems", () => {
  const rect1 = API.createElement({ id: "rect1", type: "rectangle" });
  const rect2 = API.createElement({ id: "rect2", type: "rectangle" });

  it("should dedupe items with identical elements even if item ids differ", () => {
    const local = [createLibraryItem("local", [rect1])];
    const other = [createLibraryItem("other", [{ ...rect1 }])];

    expect(mergeLibraryItems(local, other)).toEqual(local);
  });

  it("should keep items whose elements differ in versionNonce", () => {
    const local = [createLibraryItem("local", [rect1])];
    const other = [
      createLibraryItem("other", [
        { ...rect1, versionNonce: rect1.versionNonce + 1 },
      ]),
    ];

    expect(mergeLibraryItems(local, other).map((item) => item.id)).toEqual([
      "other",
      "local",
    ]);
  });

  it("should keep items whose elements differ in element ids", () => {
    const local = [createLibraryItem("local", [rect1])];
    const other = [createLibraryItem("other", [{ ...rect1, id: "rect3" }])];

    expect(mergeLibraryItems(local, other)).toHaveLength(2);
  });

  it("should keep items with a different number of elements", () => {
    const local = [createLibraryItem("local", [rect1])];
    const other = [createLibraryItem("other", [rect1, rect2])];

    expect(mergeLibraryItems(local, other)).toHaveLength(2);
  });

  it("should treat different element order (z-index) as a unique item", () => {
    const local = [createLibraryItem("local", [rect1, rect2])];
    const other = [createLibraryItem("other", [rect2, rect1])];

    expect(mergeLibraryItems(local, other)).toHaveLength(2);
  });

  it("should put new unique items before local items, preserving order", () => {
    const local = [
      createLibraryItem("local1", [rect1]),
      createLibraryItem("local2", [rect2]),
    ];
    const other = [
      createLibraryItem("new1", [{ ...rect1, id: "a" }]),
      createLibraryItem("dupe", [rect2]),
      createLibraryItem("new2", [{ ...rect1, id: "b" }]),
    ];

    expect(mergeLibraryItems(local, other).map((item) => item.id)).toEqual([
      "new1",
      "new2",
      "local1",
      "local2",
    ]);
  });

  it("should not mutate the input arrays", () => {
    const local = [createLibraryItem("local", [rect1])];
    const other = [createLibraryItem("other", [rect2])];

    mergeLibraryItems(local, other);

    expect(local.map((item) => item.id)).toEqual(["local"]);
    expect(other.map((item) => item.id)).toEqual(["other"]);
  });
});
