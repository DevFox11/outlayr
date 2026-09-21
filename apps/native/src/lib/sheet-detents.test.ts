import { describe, expect, it } from "@jest/globals";

import { ACCOUNT_DETENT, CATEGORY_DETENT, LARGE_ONLY, SUBCATEGORY_DETENT } from "./sheet-detents";

describe("sheet detents", () => {
    it("keeps every resting detent short of full, so the sheet reads as laid over", () => {
        for (const detent of [CATEGORY_DETENT, SUBCATEGORY_DETENT, ACCOUNT_DETENT]) {
            expect(detent).toBeGreaterThan(0);
            expect(detent).toBeLessThan(1);
        }
    });

    it("offers large-only as the single escape hatch while a picker is open", () => {
        expect(LARGE_ONLY).toStrictEqual([1]);
    });
});
