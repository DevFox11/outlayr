import { describe, expect, it } from "@jest/globals";

import { CATEGORY_ERROR_MESSAGES } from "@/data/categories-core";

import { categoryErrorCode } from "./category-error";

describe("categoryErrorCode", () => {
    for (const [code, message] of Object.entries(CATEGORY_ERROR_MESSAGES)) {
        it(`matches the repo's "${code}" message`, () => {
            expect(categoryErrorCode(message)).toBe(code);
        });
    }
});
