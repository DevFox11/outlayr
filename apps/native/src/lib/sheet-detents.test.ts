import { describe, expect, it } from "@jest/globals";

import {
    ACCOUNT_DETENT,
    CATEGORY_DETENT,
    heightDetent,
    LARGE_ONLY,
    LARGE_SHEET_TOP_INSET,
    SUBCATEGORY_DETENT,
} from "./sheet-detents";

describe("sheet detents", () => {
    it("keeps every resting detent short of full, so the sheet reads as laid over", () => {
        for (const detent of [CATEGORY_DETENT, SUBCATEGORY_DETENT, ACCOUNT_DETENT]) {
            expect(detent).toBeGreaterThan(0);
            expect(detent).toBeLessThan(1);
        }
    });

    it("turns a height into a fraction of the tallest sheet, never more than all of it", () => {
        expect(heightDetent(418, 836 + LARGE_SHEET_TOP_INSET)).toBe(0.5);
        expect(heightDetent(2000, 874)).toBe(1);
    });

    it("offers large-only as the single escape hatch while a picker is open", () => {
        expect(LARGE_ONLY).toStrictEqual([1]);
    });
});
