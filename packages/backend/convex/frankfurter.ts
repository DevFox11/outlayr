import { utcDateString } from "@outlayr/money";
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
 * How many recent days are re-ingested even when already held.
 *
 * The feed fills a day in over time — a fresh date can arrive with 31 of its
 * 165 quotes and be complete hours later — so "we have this date" is not proof
 * we have all of it. Seven days also spans a long weekend, after which a
 * published rate no longer moves.
 */
const REFRESH_DAYS = 7;
const MS_PER_DAY = 86_400_000;

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
	if (
		!("base" in value && "quote" in value && "rate" in value && "date" in value)
	) {
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
	returns: v.null(),
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

		const ratesByDate = new Map<
			string,
			{ quote: string; rateType: "official"; rate: number }[]
		>();
		const records = payload.filter(isValidRecord);
		for (const record of records) {
			const entry = {
				quote: record.quote,
				rateType: "official" as const,
				rate: record.rate,
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
		// A rate published outside the refresh margin is settled; rewriting the full
		// window twice a day would be twelve thousand writes to change nothing.
		const held = new Set(
			await ctx.runQuery(internal.exchangeRates.ingestedDates, {}),
		);
		const refreshFrom = utcDateString(fetchedAt - REFRESH_DAYS * MS_PER_DAY);

		let written = 0;
		for (const [date, rates] of ratesByDate) {
			if (date < refreshFrom && held.has(date)) {
				continue;
			}
			await ctx.runMutation(internal.exchangeRates.upsertRates, {
				source: "frankfurter",
				date,
				fetchedAt,
				rates,
			});
			written += 1;
		}
		console.log(
			`Frankfurter: ${written} of ${ratesByDate.size} dates written, ${ratesByDate.size - written} already settled`,
		);
		return null;
	},
});
