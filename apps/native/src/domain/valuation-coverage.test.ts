import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";
import { buildRateTable } from "./valuation";
import { coverageNote, coverageOf } from "./valuation-coverage";

const t: TranslateFn = (key, params) =>
	translate(key, { catalog: EN, fallback: EN, params });

describe("coverageNote", () => {
	it("says nothing when every figure rests on a converted row", () => {
		expect(
			coverageNote({ converted: 120, pending: 0, beyondRateHistory: 0 }, t),
		).toBe(null);
		expect(
			coverageNote({ converted: 0, pending: 0, beyondRateHistory: 0 }, t),
		).toBe(null);
	});

	it("says a backlog is draining when the rows are still reachable", () => {
		expect(
			coverageNote({ converted: 117, pending: 3, beyondRateHistory: 0 }, t),
		).toBe(
			"Rates are still catching up: 3 of 120 entries are counted at the amount they were logged in.",
		);
	});

	it("does not promise a permanent tail will ever resolve", () => {
		expect(
			coverageNote({ converted: 118, pending: 0, beyondRateHistory: 2 }, t),
		).toBe(
			"2 of 120 entries predate the rate history, so they are counted at the amount they were logged in.",
		);
	});

	it("keeps the two apart when the ledger has both", () => {
		expect(
			coverageNote({ converted: 115, pending: 3, beyondRateHistory: 2 }, t),
		).toBe(
			"Rates are still catching up: 3 of 120 entries are counted at the amount they were logged in. 2 more predate the rate history and always will be.",
		);
	});
});

const RATES = buildRateTable([
	{ quote: "EUR", date: "2025-06-01", rate: 0.9 },
	{ quote: "EUR", date: "2025-07-01", rate: 0.92 },
]);

const row = (
	over: Partial<{
		amount: number;
		currency: string | null;
		amountUsd: number | null;
		date: Date;
	}> = {},
) => ({
	amount: 10,
	currency: "EUR" as string | null,
	amountUsd: 11 as number | null,
	date: new Date(Date.UTC(2025, 6, 15)),
	...over,
});

describe("coverageOf", () => {
	it("counts a row the display currency can reach as converted", () => {
		expect(coverageOf([row()], "USD", RATES)).toStrictEqual({
			converted: 1,
			pending: 0,
			beyondRateHistory: 0,
		});
	});

	it("counts an un-canonicalized row a later pull can still value as pending", () => {
		expect(coverageOf([row({ amountUsd: null })], "USD", RATES)).toStrictEqual({
			converted: 0,
			pending: 1,
			beyondRateHistory: 0,
		});
	});

	it("calls a row dated before its currency's oldest rate permanent", () => {
		const stepped = row({
			amountUsd: null,
			date: new Date(Date.UTC(2025, 2, 4)),
		});
		expect(coverageOf([stepped], "USD", RATES)).toStrictEqual({
			converted: 0,
			pending: 0,
			beyondRateHistory: 1,
		});
	});

	it("calls a row permanent when the display leg is the one that cannot reach", () => {
		// USD in, EUR out: the amount needs no canonicalization, but March has no
		// EUR rate to convert into and no later pull will supply one.
		const stepped = row({
			currency: "USD",
			amountUsd: 10,
			date: new Date(Date.UTC(2025, 2, 4)),
		});
		expect(coverageOf([stepped], "EUR", RATES)).toStrictEqual({
			converted: 0,
			pending: 0,
			beyondRateHistory: 1,
		});
	});

	it("leaves a currency the table has never held in pending", () => {
		// No rows for JPY at all: rates may still arrive, so "never" is not a
		// claim the data supports.
		const unknown = row({
			currency: "JPY",
			amountUsd: null,
			date: new Date(Date.UTC(2020, 0, 1)),
		});
		expect(coverageOf([unknown], "USD", RATES)).toStrictEqual({
			converted: 0,
			pending: 1,
			beyondRateHistory: 0,
		});
	});

	it("says nothing for an empty window", () => {
		expect(coverageNote(coverageOf([], "USD", RATES), t)).toBe(null);
	});
});
