import { describe, expect, it } from "@jest/globals";

import { isBehindWatermark } from "./sync-wakeup";

describe("isBehindWatermark", () => {
    it("does not wake a device that has applied the whole log", () => {
        // `nextSeq` is one past the highest seq the server has handed out, so a
        // cursor of 7 against a watermark of 8 is fully caught up.
        expect(isBehindWatermark(8, 7)).toBe(false);
    });

    it("does not wake an account that has never pushed", () => {
        expect(isBehindWatermark(0, 0)).toBe(false);
    });

    it("does not wake on a watermark equal to the cursor", () => {
        expect(isBehindWatermark(7, 7)).toBe(false);
    });

    it("does not wake on a watermark below the cursor", () => {
        expect(isBehindWatermark(4, 7)).toBe(false);
    });

    it("wakes on a single row this device has not seen", () => {
        expect(isBehindWatermark(9, 7)).toBe(true);
    });

    it("wakes on the first row an account ever pushed", () => {
        expect(isBehindWatermark(2, 0)).toBe(true);
    });

    it("wakes a device that is many rows behind", () => {
        expect(isBehindWatermark(4218, 7)).toBe(true);
    });

    it("ignores a watermark that is not a whole number", () => {
        expect(isBehindWatermark(9.5, 7)).toBe(false);
    });

    it("ignores a watermark that is not finite", () => {
        expect(isBehindWatermark(Number.POSITIVE_INFINITY, 7)).toBe(false);
        expect(isBehindWatermark(Number.NaN, 7)).toBe(false);
    });
});
