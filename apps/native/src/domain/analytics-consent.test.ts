import { describe, expect, it } from "@jest/globals";

import { analyticsOnByDefault } from "./analytics-consent";

describe("analyticsOnByDefault", () => {
    it("starts off in the EEA and the UK", () => {
        expect(analyticsOnByDefault("DE")).toBe(false);
        expect(analyticsOnByDefault("no")).toBe(false);
        expect(analyticsOnByDefault("GB")).toBe(false);
        expect(analyticsOnByDefault("RE")).toBe(false);
    });

    it("starts on elsewhere, and when the region is unknown", () => {
        expect(analyticsOnByDefault("US")).toBe(true);
        expect(analyticsOnByDefault("VE")).toBe(true);
        expect(analyticsOnByDefault("CH")).toBe(true);
        expect(analyticsOnByDefault(undefined)).toBe(true);
    });
});
