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
	test("budget ceiling defaults to $25 in micro-dollars", () => {
		expect(budgetCeilingMicros()).toBe(25_000_000);
		expect(DEFAULT_BUDGET_CEILING_MICROS).toBe(25_000_000);
	});

	test("an env override replaces the default ceiling without a deploy", () => {
		vi.stubEnv("GROUNDED_BUDGET_MICROS", "0");
		expect(budgetCeilingMicros()).toBe(0);
	});

	test("a non-numeric env override falls back to the default", () => {
		vi.stubEnv("GROUNDED_BUDGET_MICROS", "not-a-number");
		expect(budgetCeilingMicros()).toBe(25_000_000);
	});

	test("budgetConfig is a sharded 30-day fixed window sized to the ceiling", () => {
		expect(budgetConfig()).toMatchObject({
			kind: "fixed window",
			rate: 25_000_000,
			shards: 10,
		});
	});
});

describe("estimateMicros", () => {
	test("the worst-case pre-charge is strictly positive", () => {
		expect(estimateMicros()).toBeGreaterThan(0);
	});

	test("raising the search price raises the pre-charge", () => {
		const before = estimateMicros();
		vi.stubEnv("GROUNDED_SEARCH_PRICE_MICROS", "50000");
		expect(estimateMicros()).toBeGreaterThan(before);
	});
});

describe("measureMicros", () => {
	test("sums search calls and token usage at the configured unit prices", () => {
		// 1 search @5000 + 1000 input tok @1.25/tok + 100 output tok @2.5/tok
		expect(measureMicros({ inputTokens: 1000, outputTokens: 100 }, 1)).toBe(5000 + 1000 * 1.25 + 100 * 2.5);
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
