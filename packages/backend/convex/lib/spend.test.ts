import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
    budgetCeilingMicros,
    budgetConfig,
    DEFAULT_BUDGET_CEILING_MICROS,
    estimateMicros,
    measureMicros,
} from "./spend";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("pricing defaults", () => {
    it("budget ceiling defaults to $200 in micro-dollars", () => {
        expect(budgetCeilingMicros()).toBe(200_000_000);
        expect(DEFAULT_BUDGET_CEILING_MICROS).toBe(200_000_000);
    });

    it("an env override replaces the default ceiling without a deploy", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "0");
        expect(budgetCeilingMicros()).toBe(0);
    });

    it("a non-numeric env override falls back to the default", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "not-a-number");
        expect(budgetCeilingMicros()).toBe(200_000_000);
    });

    it("budgetConfig is a sharded 30-day fixed window", () => {
        expect(budgetConfig()).toMatchObject({ kind: "fixed window", shards: 10 });
    });

    it("budgetConfig's rate follows the env override, not the compiled default", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "7000000");
        expect(budgetConfig().rate).toBe(7_000_000);
    });

    it("an override of zero closes the gate rather than falling back to the default", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "0");
        expect(budgetConfig().rate).toBe(0);
    });
});

describe(estimateMicros, () => {
    it("the worst-case pre-charge is strictly positive", () => {
        expect(estimateMicros()).toBeGreaterThan(0);
    });

    it("raising the search price raises the pre-charge", () => {
        const before = estimateMicros();
        vi.stubEnv("GROUNDED_SEARCH_PRICE_MICROS", "50000");
        expect(estimateMicros()).toBeGreaterThan(before);
    });
});

describe(measureMicros, () => {
    it("sums search calls and token usage at the configured unit prices", () => {
        // 1 search @5000 + 1000 input tok @1.25/tok + 100 output tok @2.5/tok
        expect(measureMicros({ inputTokens: 1000, outputTokens: 100 }, 1)).toBe(5000 + 1000 * 1.25 + 100 * 2.5);
    });

    it("undefined token counts contribute zero rather than throwing", () => {
        expect(measureMicros({ inputTokens: undefined, outputTokens: undefined }, 0)).toBe(0);
    });

    it("a higher search-call count scales the total proportionally", () => {
        const one = measureMicros({ inputTokens: 0, outputTokens: 0 }, 1);
        const three = measureMicros({ inputTokens: 0, outputTokens: 0 }, 3);
        expect(three).toBe(one * 3);
    });
});
