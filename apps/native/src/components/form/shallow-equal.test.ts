import { shallowEqual } from "./shallow-equal";

describe("shallowEqual", () => {
    it("treats identical references as equal", () => {
        const value = { a: 1 };
        expect(shallowEqual(value, value)).toBe(true);
    });

    it("compares own properties one level deep", () => {
        expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
        expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "y" })).toBe(false);
    });

    it("does not recurse into nested objects", () => {
        expect(shallowEqual({ a: { n: 1 } }, { a: { n: 1 } })).toBe(false);
    });

    it("detects a differing key count", () => {
        expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    });

    it("compares dates by identity, matching the store's own semantics", () => {
        const date = new Date(0);
        expect(shallowEqual({ date }, { date })).toBe(true);
        expect(shallowEqual({ date }, { date: new Date(0) })).toBe(false);
    });

    it("handles null and primitive operands without throwing", () => {
        expect(shallowEqual(null, null)).toBe(true);
        expect(shallowEqual(null, { a: 1 })).toBe(false);
        expect(shallowEqual({ a: 1 }, null)).toBe(false);
        expect(shallowEqual(1, 1)).toBe(true);
        expect(shallowEqual(1, 2)).toBe(false);
    });

    it("compares two property-less objects as equal, which is what shallow means", () => {
        expect(shallowEqual({}, {})).toBe(true);
    });

    it("treats NaN operands as equal, matching Object.is", () => {
        expect(shallowEqual({ a: Number.NaN }, { a: Number.NaN })).toBe(true);
    });
});
