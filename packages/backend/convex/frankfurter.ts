import { utcDateString } from "@outlayr/money/dates";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { ratesWindowStart } from "./exchangeRates";

/**
 * Frankfurter v2 default /rates blends multiple central-bank and
 * monetary-authority providers. `providers=ECB` is deliberately NOT pinned: the
 * ECB feed covers only ~30 currencies and VES needs the wider blend, so the
 * `official` rateType means "central-bank blend via Frankfurter", not "ECB".
 *
 * Ingestion has NO pickable allowlist — every shape-valid quote is persisted, so
 * a newly appearing upstream code flows through without a code change. The read
 * bound lives downstream in `pullRates` (catalog pairs plus pagination).
 */
const FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates?base=USD";
const EFFECTIVE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/**
 * How many recent days are re-ingested unconditionally, so a revised figure
 * still lands on a day whose quote set has not changed. Seven spans a long
 * weekend, after which a published rate no longer moves.
 *
 * Beyond that margin the test is coverage, not age: the feed fills a day in
 * over time — a fresh date can arrive with 31 of its 165 quotes and be complete
 * hours later — so a day is re-ingested for as long as the feed offers a quote
 * we do not hold, however old it is.
 */
const REFRESH_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/**
 * Dates per coverage query. A whole window is ~90 dates x the ~165-code
 * catalog, which alone would approach Convex's 16,384-document read ceiling;
 * ten dates hold one query near 1,700 rows however far the catalog grows.
 */
const COVERAGE_BATCH_DATES = 10;

function windowUrl(from: string): string {
	return `${FRANKFURTER_URL}&from=${from}`;
}

interface FrankfurterRecord {
	base: string;
	date: string;
	quote: string;
	rate: number;
}

function isValidRecord(value: unknown): value is FrankfurterRecord {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	if (!("base" in value && "quote" in value && "rate" in value && "date" in value)) {
		return false;
	}
	const { base, quote, rate, date } = value;
	return (
		base === "USD" &&
		typeof quote === "string" &&
		CURRENCY_CODE_PATTERN.test(quote) &&
		typeof rate === "number" &&
		Number.isFinite(rate) &&
		rate > 0 &&
		typeof date === "string" &&
		EFFECTIVE_DATE_PATTERN.test(date)
	);
}

export const fetchRates = internalAction({
	args: {},
	handler: async (ctx) => {
		let payload: unknown;
		try {
			const response = await fetch(windowUrl(ratesWindowStart()));
			if (!response.ok) {
				console.error(`Frankfurter fetch failed with HTTP ${response.status}`);
				return null;
			}
			payload = await response.json();
		} catch (error) {
			console.error("Frankfurter fetch request failed", error);
			return null;
		}

		if (!Array.isArray(payload)) {
			console.error("Frankfurter response was not an array");
			return null;
		}

		const ratesByDate = new Map<string, { quote: string; rateType: "official"; rate: number }[]>();
		const records = payload.filter(isValidRecord);
		for (const record of records) {
			const entry = {
				quote: record.quote,
				rate: record.rate,
				rateType: "official" as const,
			};
			const group = ratesByDate.get(record.date);
			if (group) {
				group.push(entry);
			} else {
				ratesByDate.set(record.date, [entry]);
			}
		}

		if (ratesByDate.size === 0) {
			console.error("Frankfurter response contained no valid records");
			return null;
		}

		const fetchedAt = Date.now();
		const refreshFrom = utcDateString(fetchedAt - REFRESH_DAYS * MS_PER_DAY);

		// Only days past the refresh margin need the test — the rest are written
		// either way, so asking what they hold would read the window for nothing.
		const aged = [...ratesByDate.keys()].filter((date) => date < refreshFrom);
		const coverageBatches: string[][] = [];
		for (let start = 0; start < aged.length; start += COVERAGE_BATCH_DATES) {
			coverageBatches.push(aged.slice(start, start + COVERAGE_BATCH_DATES));
		}
		const coverage = await Promise.all(
			coverageBatches.map((dates) => ctx.runQuery(internal.exchangeRates.officialQuotesByDate, { dates }))
		);

		const heldByDate = new Map<string, Set<string>>();
		for (const batch of coverage) {
			for (const entry of batch) {
				heldByDate.set(entry.date, new Set(entry.quotes));
			}
		}

		let written = 0;
		for (const [date, rates] of ratesByDate) {
			// Every quote the feed offers is one an upsert would persist, so a day
			// that passes this is written at most once more than the feed grows it —
			// a day the feed never completes settles after a single write.
			const held = heldByDate.get(date);
			if (held && rates.every((entry) => held.has(entry.quote))) {
				continue;
			}
			// biome-ignore lint/performance/noAwaitInLoops: every date's upsert reads and writes the same exchangeRates table (exchangeRates.ts:150), so parallel mutations would contend on one write set and be retried under OCC
			await ctx.runMutation(internal.exchangeRates.upsertRates, {
				date,
				fetchedAt,
				rates,
				source: "frankfurter",
			});
			written += 1;
		}
		console.log(
			`Frankfurter: ${written} of ${ratesByDate.size} dates written, ${ratesByDate.size - written} already complete`
		);
		return null;
	},
	returns: v.null(),
});
