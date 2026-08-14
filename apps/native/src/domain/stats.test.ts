import { median } from "./stats";

describe("median", () => {
    it("returns null on an empty series", () => {
        // Null rather than 0 on purpose: budget forecasting must be able to tell
        // "no evidence" apart from "measured zero".
        expect(median([])).toBeNull();
    });

    it("returns the middle value on an odd count", () => {
        expect(median([5, 1, 3])).toBe(3);
    });

    it("averages the middle pair on an even count", () => {
        expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it("does not care about input order", () => {
        expect(median([9, 2, 7, 4])).toBe(median([2, 4, 7, 9]));
    });

    it("sorts numerically, not lexicographically", () => {
        // The default Array#sort would order these as 10, 9, 80 and answer 9.
        expect(median([9, 10, 80])).toBe(10);
    });

    it("does not mutate the caller's array", () => {
        const input = [3, 1, 2];
        median(input);
        expect(input).toStrictEqual([3, 1, 2]);
    });

    it("resists the outlier a mean would follow", () => {
        const days = [10, 12, 11, 13, 900];
        const mean = days.reduce((a, b) => a + b, 0) / days.length;
        expect(median(days)).toBe(12);
        expect(mean > 180).toBeTruthy();
    });
});
