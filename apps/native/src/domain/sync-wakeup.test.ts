import { describe, expect, it } from "@jest/globals";

import { isBehindWatermark } from "./sync-wakeup";

describe("isBehindWatermark", () => {
    it("does not wake a device that has applied the whole log", () => {
        // `nextSeq` is one past the highest seq the server has handed out, so a
        // cursor of 7 against a watermark of 8 is fully caught up.
        expect(isBehindWatermark(8, 7)).toBe(false);
    });

    it("wakes on a single row this device has not seen", () => {
        expect(isBehindWatermark(9, 7)).toBe(true);
    });

    it("ignores a watermark that is not a whole number", () => {
        expect(isBehindWatermark(9.5, 7)).toBe(false);
    });
});
