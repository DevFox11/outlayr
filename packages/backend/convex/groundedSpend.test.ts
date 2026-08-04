/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("groundedSpend", () => {
	test("record persists a row that monthlyTotal can sum", async () => {
		const t = convexTest(schema, modules);
		const now = Date.UTC(2026, 6, 15);

		await t.mutation(internal.groundedSpend.record, {
			at: now,
			chargedMicros: 20_000,
			actualMicros: 6_500,
			searchCalls: 1,
			inputTokens: 1000,
			outputTokens: 100,
			published: true,
		});

		const result = await t.query(internal.groundedSpend.monthlyTotal, {
			at: now,
		});

		expect(result.totalMicros).toBe(6_500);
	});

	test("monthlyTotal sums only rows within the same calendar month", async () => {
		const t = convexTest(schema, modules);
		const lastMonth = Date.UTC(2026, 5, 20);
		const thisMonth = Date.UTC(2026, 6, 3);
		const laterThisMonth = Date.UTC(2026, 6, 20);

		await t.mutation(internal.groundedSpend.record, {
			at: lastMonth,
			chargedMicros: 20_000,
			actualMicros: 999_999,
			searchCalls: 1,
			inputTokens: 1,
			outputTokens: 1,
			published: false,
		});
		await t.mutation(internal.groundedSpend.record, {
			at: thisMonth,
			chargedMicros: 20_000,
			actualMicros: 4_000,
			searchCalls: 1,
			inputTokens: 500,
			outputTokens: 50,
			published: true,
		});

		const result = await t.query(internal.groundedSpend.monthlyTotal, {
			at: laterThisMonth,
		});

		expect(result.totalMicros).toBe(4_000);
	});

	test("monthlyTotal reports the $25 ceiling constant by default", async () => {
		const t = convexTest(schema, modules);

		const result = await t.query(internal.groundedSpend.monthlyTotal, {
			at: Date.UTC(2026, 6, 1),
		});

		expect(result.ceilingMicros).toBe(25_000_000);
	});

	test("monthlyTotal reflects a live env-var ceiling override", async () => {
		vi.stubEnv("GROUNDED_BUDGET_MICROS", "1000");
		const t = convexTest(schema, modules);

		const result = await t.query(internal.groundedSpend.monthlyTotal, {
			at: Date.UTC(2026, 6, 1),
		});

		expect(result.ceilingMicros).toBe(1000);
	});
});
