import { afterEach, describe, expect, test, vi } from "vitest";

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
    test("budget ceiling defaults to $200 in micro-dollars", () => {
        expect(budgetCeilingMicros()).toBe(200_000_000);
        expect(DEFAULT_BUDGET_CEILING_MICROS).toBe(200_000_000);
    });

    test("an env override replaces the default ceiling without a deploy", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "0");
        expect(budgetCeilingMicros()).toBe(0);
    });

    test("a non-numeric env override falls back to the default", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "not-a-number");
        expect(budgetCeilingMicros()).toBe(200_000_000);
    });

    test("budgetConfig is a sharded 30-day fixed window", () => {
        expect(budgetConfig()).toMatchObject({ kind: "fixed window", shards: 10 });
    });

    test("budgetConfig's rate follows the env override, not the compiled default", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "7000000");
        expect(budgetConfig().rate).toBe(7_000_000);
    });

    test("an override of zero closes the gate rather than falling back to the default", () => {
        vi.stubEnv("GROUNDED_BUDGET_MICROS", "0");
        expect(budgetConfig().rate).toBe(0);
    });
});

describe(estimateMicros, () => {
    test("the worst-case pre-charge is strictly positive", () => {
        expect(estimateMicros()).toBeGreaterThan(0);
    });

    test("raising the search price raises the pre-charge", () => {
        const before = estimateMicros();
        vi.stubEnv("GROUNDED_SEARCH_PRICE_MICROS", "50000");
        expect(estimateMicros()).toBeGreaterThan(before);
    });
});

describe(measureMicros, () => {
    test("sums search calls and token usage at the configured unit prices", () => {
        // 1 search @5000 + 1000 input tok @2/tok + 100 output tok @6/tok
        expect(measureMicros({ inputTokens: 1000, outputTokens: 100 }, 1)).toBe(5000 + 1000 * 2 + 100 * 6);
    });

    test("undefined token counts contribute zero rather than throwing", () => {
        expect(measureMicros({ inputTokens: undefined, outputTokens: undefined }, 0)).toBe(0);
    });

    test("a higher search-call count scales the total proportionally", () => {
        const one = measureMicros({ inputTokens: 0, outputTokens: 0 }, 1);
        const three = measureMicros({ inputTokens: 0, outputTokens: 0 }, 3);
        expect(three).toBe(one * 3);
    });
});
