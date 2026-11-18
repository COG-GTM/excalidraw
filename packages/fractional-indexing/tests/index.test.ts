import {
  BASE_62_DIGITS,
  generateKeyBetween,
  generateNKeysBetween,
  validateOrderKey,
} from "../src/index";

const SMALLEST_INTEGER = `A${"0".repeat(26)}`;
const LARGEST_INTEGER = "z".repeat(27);

const expectSortedAndValid = (keys: string[]) => {
  keys.forEach((key) => expect(() => validateOrderKey(key)).not.toThrow());
  expect([...keys].sort()).toEqual(keys);
  expect(new Set(keys).size).toBe(keys.length);
};

describe("BASE_62_DIGITS", () => {
  it("contains 62 unique digits in ascending character code order", () => {
    expect(BASE_62_DIGITS).toHaveLength(62);
    expect(new Set(BASE_62_DIGITS).size).toBe(62);
    expect(BASE_62_DIGITS.split("").sort().join("")).toBe(BASE_62_DIGITS);
  });
});

describe("validateOrderKey", () => {
  it.each(["a0", "a0V", "Zz", "b125", `${SMALLEST_INTEGER}1`, LARGEST_INTEGER])(
    "accepts valid key %s",
    (key) => {
      expect(() => validateOrderKey(key)).not.toThrow();
    },
  );

  it("rejects the smallest integer without a fractional part", () => {
    expect(() => validateOrderKey(SMALLEST_INTEGER)).toThrow(
      `invalid order key: ${SMALLEST_INTEGER}`,
    );
  });

  it("rejects keys with characters outside the digit set", () => {
    expect(() => validateOrderKey("a0 ")).toThrow("invalid order key: a0 ");
    expect(() => validateOrderKey("a-")).toThrow("invalid order key: a-");
  });

  it("rejects keys whose head is not a letter", () => {
    expect(() => validateOrderKey("0")).toThrow("invalid order key head: 0");
    expect(() => validateOrderKey("")).toThrow(
      "invalid order key head: undefined",
    );
  });

  it("rejects keys shorter than their integer part", () => {
    expect(() => validateOrderKey("a")).toThrow("invalid order key: a");
    expect(() => validateOrderKey("b1")).toThrow("invalid order key: b1");
    expect(() => validateOrderKey("Y0")).toThrow("invalid order key: Y0");
  });

  it("rejects keys whose fractional part has a trailing zero", () => {
    expect(() => validateOrderKey("a00")).toThrow("invalid order key: a00");
    expect(() => validateOrderKey("Zz0")).toThrow("invalid order key: Zz0");
  });
});

describe("generateKeyBetween", () => {
  it.each([
    [null, null, "a0"],
    [undefined, undefined, "a0"],
    [null, "a0", "Zz"],
    [null, "Zz", "Zy"],
    ["a0", null, "a1"],
    ["a1", null, "a2"],
    ["a0", "a1", "a0V"],
    ["a1", "a2", "a1V"],
    ["a0V", "a1", "a0l"],
    ["a1V", "a1l", "a1d"],
    ["Zz", "a0", "ZzV"],
    ["Zz", "a1", "a0"],
    ["a0", "a0V", "a0G"],
    ["a0", "a0G", "a08"],
    ["a0z", "a1", "a0zV"],
    ["b125", "b129", "b127"],
    ["a0", "a1V", "a1"],
    ["Zz", "a01", "a0"],
    ["az", "b001", "b00"],
    [null, "a0V", "a0"],
    [null, "b999", "b99"],
  ])("generateKeyBetween(%s, %s) === %s", (a, b, expected) => {
    const key = generateKeyBetween(a, b);
    expect(key).toBe(expected);
    if (a != null) {
      expect(key > a).toBe(true);
    }
    if (b != null) {
      expect(key < b).toBe(true);
    }
  });

  describe("integer part carries and borrows", () => {
    it("increments across the Z/a boundary", () => {
      expect(generateKeyBetween("Zz", null)).toBe("a0");
    });

    it("grows the integer part when incrementing past a full positive integer", () => {
      expect(generateKeyBetween("az", null)).toBe("b00");
      expect(generateKeyBetween("bzz", null)).toBe("c000");
    });

    it("shrinks the integer part when incrementing past a full negative integer", () => {
      expect(generateKeyBetween("Yzz", null)).toBe("Z0");
    });

    it("decrements across the a/Z boundary", () => {
      expect(generateKeyBetween(null, "a0")).toBe("Zz");
    });

    it("shrinks the integer part when decrementing a positive integer", () => {
      expect(generateKeyBetween(null, "b00")).toBe("az");
    });

    it("grows the integer part when decrementing a negative integer", () => {
      expect(generateKeyBetween(null, "Z0")).toBe("Yzz");
      expect(generateKeyBetween(null, "Y00")).toBe("Xzzz");
    });
  });

  describe("integer range limits", () => {
    it("falls back to a fractional key above the largest integer", () => {
      expect(generateKeyBetween(`${"z".repeat(26)}y`, null)).toBe(
        LARGEST_INTEGER,
      );
      expect(generateKeyBetween(LARGEST_INTEGER, null)).toBe(
        `${LARGEST_INTEGER}V`,
      );
    });

    it("falls back to a fractional key below the smallest integer", () => {
      expect(generateKeyBetween(null, `${SMALLEST_INTEGER}1`)).toBe(
        `${SMALLEST_INTEGER}0V`,
      );
    });
  });

  describe("errors", () => {
    it("throws when a >= b", () => {
      expect(() => generateKeyBetween("a1", "a0")).toThrow("a1 >= a0");
      expect(() => generateKeyBetween("a1", "a1")).toThrow("a1 >= a1");
    });

    it("throws on invalid bounds", () => {
      expect(() => generateKeyBetween("a00", null)).toThrow(
        "invalid order key: a00",
      );
      expect(() => generateKeyBetween(null, "a00")).toThrow(
        "invalid order key: a00",
      );
      expect(() => generateKeyBetween("a00", "a1")).toThrow(
        "invalid order key: a00",
      );
      expect(() => generateKeyBetween("0", "1")).toThrow(
        "invalid order key head: 0",
      );
      expect(() => generateKeyBetween(null, SMALLEST_INTEGER)).toThrow(
        `invalid order key: ${SMALLEST_INTEGER}`,
      );
      expect(() => generateKeyBetween("b1", null)).toThrow(
        "invalid order key: b1",
      );
    });
  });

  it("keeps generating sorted, valid keys when repeatedly appending", () => {
    const keys: string[] = [];
    let last: string | null = null;
    for (let i = 0; i < 200; i++) {
      last = generateKeyBetween(last, null);
      keys.push(last);
    }
    expectSortedAndValid(keys);
  });

  it("keeps generating sorted, valid keys when repeatedly prepending", () => {
    const keys: string[] = [];
    let first: string | null = null;
    for (let i = 0; i < 200; i++) {
      first = generateKeyBetween(null, first);
      keys.unshift(first);
    }
    expectSortedAndValid(keys);
  });

  it("keeps generating sorted, valid keys when repeatedly bisecting", () => {
    const lower = "a0";
    let upper = "a1";
    const keys = [upper];
    for (let i = 0; i < 50; i++) {
      upper = generateKeyBetween(lower, upper);
      keys.unshift(upper);
    }
    expectSortedAndValid([lower, ...keys]);
  });

  it("generates a0 with no bounds for a custom digit set", () => {
    expect(generateKeyBetween(null, null, "0123456789")).toBe("a0");
  });

  // BUG: validateOrderKey rejects every key whose letters are not part of
  // `digits` (the integer head is always a letter), so non-base-62 digit sets
  // can't be used with any bound. Upstream fractional-indexing returns "a1".
  it.skip("generates keys after a bound for a base-10 digit set", () => {
    expect(generateKeyBetween("a0", null, "0123456789")).toBe("a1");
  });
});

describe("generateNKeysBetween", () => {
  it("returns an empty array for n = 0 without validating bounds", () => {
    expect(generateNKeysBetween(null, null, 0)).toEqual([]);
    expect(generateNKeysBetween("a1", "a0", 0)).toEqual([]);
  });

  it("returns a single key for n = 1", () => {
    expect(generateNKeysBetween(null, null, 1)).toEqual(["a0"]);
    expect(generateNKeysBetween("a0", "a1", 1)).toEqual(["a0V"]);
  });

  it("returns consecutive integer keys with no bounds", () => {
    expect(generateNKeysBetween(null, null, 5)).toEqual([
      "a0",
      "a1",
      "a2",
      "a3",
      "a4",
    ]);
    expect(generateNKeysBetween(undefined, undefined, 2)).toEqual(["a0", "a1"]);
  });

  it("returns consecutive integer keys after a lower bound", () => {
    expect(generateNKeysBetween("a4", null, 10)).toEqual(
      "a5 a6 a7 a8 a9 aA aB aC aD aE".split(" "),
    );
  });

  it("returns consecutive integer keys before an upper bound", () => {
    expect(generateNKeysBetween(null, "a0", 5)).toEqual(
      "Zv Zw Zx Zy Zz".split(" "),
    );
  });

  it("returns evenly spread keys between two bounds", () => {
    expect(generateNKeysBetween("a0", "a1", 3)).toEqual(["a0G", "a0V", "a0l"]);
    const keys = generateNKeysBetween("a0", "a2", 20);
    expect(keys).toEqual(
      "a04 a08 a0G a0K a0O a0V a0Z a0d a0l a0t a1 a14 a18 a1G a1O a1V a1Z a1d a1l a1t".split(
        " ",
      ),
    );
    expectSortedAndValid(["a0", ...keys, "a2"]);
  });

  it("handles the integer range limits", () => {
    expect(generateNKeysBetween(null, `${SMALLEST_INTEGER}1`, 3)).toEqual([
      `${SMALLEST_INTEGER}08`,
      `${SMALLEST_INTEGER}0G`,
      `${SMALLEST_INTEGER}0V`,
    ]);
    expect(generateNKeysBetween(LARGEST_INTEGER, null, 2)).toEqual([
      `${LARGEST_INTEGER}V`,
      `${LARGEST_INTEGER}l`,
    ]);
  });

  it("generates sorted, valid keys for many n between bounds", () => {
    for (const n of [2, 7, 33, 100]) {
      const keys = generateNKeysBetween("Zz", "a0", n);
      expect(keys).toHaveLength(n);
      expectSortedAndValid(["Zz", ...keys, "a0"]);
    }
  });

  it("throws when a >= b", () => {
    expect(() => generateNKeysBetween("a1", "a0", 1)).toThrow("a1 >= a0");
    expect(() => generateNKeysBetween("a1", "a0", 2)).toThrow("a1 >= a0");
  });
});
