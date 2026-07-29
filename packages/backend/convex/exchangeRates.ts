import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";
import {
	type MarketRateType,
	marketRateType,
	PICKABLE_CURRENCY_CODES,
	rateSource,
	resolveRateOnDate,
	utcDateString,
} from "./lib/currencies";

const PRUNE_BATCH_SIZE = 200;

/**
 * Historical depth of the `pullRates` snapshot. An entry backdated past it falls
 * back to that pair's anchor row, or to the same "no rate" failure the server
 * would raise.
 */
export const RATES_WINDOW_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/**
 * Single source of the rates-window boundary. `pullRates` serves exactly the
 * rows on or after this date plus each pair's newest row strictly before it
 * (the anchor), and `pruneStale` keeps exactly that same set — an invariant
 * that only holds while both derive the boundary HERE. Never inline it.
 */
export function ratesWindowStart(): string {
	return utcDateString(Date.now() - RATES_WINDOW_DAYS * MS_PER_DAY);
}

interface RatePair {
	quote: string;
	rateType: MarketRateType;
}

/**
 * One pair stands in for "which days have we ingested": counting every row per
 * day would read the whole window, tens of thousands of documents. EUR is the
 * safest stand-in — every provider blend Frankfurter draws on quotes it — and a
 * miss costs only a redundant upsert, never correctness.
 */
const COVERAGE_PROBE: RatePair = { quote: "EUR", rateType: "official" };

/**
 * The EXACT set `pullRates` reads (window rows and anchors alike). A catalog
 * pair is guaranteed an anchor lookup even with ZERO in-window rows, so its
 * newest pre-window row still serves.
 */
const ANCHOR_PAIR_CATALOG: readonly RatePair[] = [
	...PICKABLE_CURRENCY_CODES.filter((code) => code !== "USD").map((code) => ({
		quote: code,
		rateType: "official" as const,
	})),
	{ quote: "VES", rateType: "eur_reference" },
	{ quote: "VES", rateType: "binance" },
];

/**
 * Pairs served per `pullRates` page. 40 x (90 window days + same-day row + 1
 * anchor) = 3,680 docs/page — roughly 4.5x headroom under Convex's 16,384-doc
 * read ceiling, and the bound is per PAGE, so it holds however large the
 * provider catalog grows.
 */
export const PAIRS_PER_PAGE = 40;

function toRateWire(doc: Doc<"exchangeRates">) {
	return {
		quote: doc.quote,
		rateType: doc.rateType,
		source: doc.source,
		rate: doc.rate,
		date: doc.date,
		fetchedAt: doc.fetchedAt,
	};
}

const rateResult = v.union(
	v.object({
		rate: v.number(),
		date: v.string(),
		fetchedAt: v.number(),
	}),
	v.null(),
);

export const ingestedDates = internalQuery({
	args: {},
	returns: v.array(v.string()),
	handler: async (ctx) => {
		const rows = await ctx.db
			.query("exchangeRates")
			.withIndex("by_quote_and_rateType_and_date", (q) =>
				q
					.eq("quote", COVERAGE_PROBE.quote)
					.eq("rateType", COVERAGE_PROBE.rateType)
					.gte("date", ratesWindowStart()),
			)
			.collect();
		return rows.map((row) => row.date);
	},
});

export const upsertRates = internalMutation({
	args: {
		source: rateSource,
		date: v.string(),
		fetchedAt: v.number(),
		rates: v.array(
			v.object({
				quote: v.string(),
				rateType: marketRateType,
				rate: v.number(),
			}),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		for (const entry of args.rates) {
			if (!Number.isFinite(entry.rate) || entry.rate <= 0) {
				continue;
			}

			const existing = await ctx.db
				.query("exchangeRates")
				.withIndex("by_quote_and_rateType_and_date", (q) =>
					q
						.eq("quote", entry.quote)
						.eq("rateType", entry.rateType)
						.eq("date", args.date),
				)
				.unique();

			if (existing) {
				// Source priority: a cotizave row (BCV official / live market mids) is
				// authoritative and must not be clobbered by a Frankfurter refresh.
				if (args.source === "frankfurter" && existing.source === "cotizave") {
					continue;
				}
				await ctx.db.patch("exchangeRates", existing._id, {
					rate: entry.rate,
					fetchedAt: args.fetchedAt,
					source: args.source,
				});
			} else {
				await ctx.db.insert("exchangeRates", {
					quote: entry.quote,
					rateType: entry.rateType,
					source: args.source,
					rate: entry.rate,
					date: args.date,
					fetchedAt: args.fetchedAt,
				});
			}
		}
		return null;
	},
});

/**
 * Deletes every row older than the `pullRates` window EXCEPT each
 * `(quote, rateType)` pair's newest pre-window row — the anchor `pullRates`
 * depends on, kept for non-catalog pairs too. A row is deleted iff a NEWER
 * pre-window row exists for its pair, which is order-independent within a pass.
 * The first invocation computes `windowStart` and threads it through every
 * reschedule so one pass prunes against a single consistent boundary.
 */
export const pruneStale = internalMutation({
	args: {
		windowStart: v.optional(v.string()),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.object({ deleted: v.number(), isDone: v.boolean() }),
	handler: async (ctx, args) => {
		const windowStart = args.windowStart ?? ratesWindowStart();

		const page = await ctx.db
			.query("exchangeRates")
			.withIndex("by_date", (q) => q.lt("date", windowStart))
			.paginate({ cursor: args.cursor ?? null, numItems: PRUNE_BATCH_SIZE });

		let deleted = 0;
		for (const row of page.page) {
			const newer = await ctx.db
				.query("exchangeRates")
				.withIndex("by_quote_and_rateType_and_date", (q) =>
					q
						.eq("quote", row.quote)
						.eq("rateType", row.rateType)
						.gt("date", row.date)
						.lt("date", windowStart),
				)
				.take(1);
			if (newer.length > 0) {
				await ctx.db.delete("exchangeRates", row._id);
				deleted += 1;
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(0, internal.exchangeRates.pruneStale, {
				windowStart,
				cursor: page.continueCursor,
			});
		}
		return { deleted, isDone: page.isDone };
	},
});

export const getLatestRate = query({
	args: {
		quote: v.string(),
		rateType: marketRateType,
	},
	returns: rateResult,
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("exchangeRates")
			.withIndex("by_quote_and_rateType_and_date", (q) =>
				q.eq("quote", args.quote).eq("rateType", args.rateType),
			)
			.order("desc")
			.take(1);
		const row = rows[0];
		if (!row) {
			return null;
		}
		return { rate: row.rate, date: row.date, fetchedAt: row.fetchedAt };
	},
});

export const getRateOnDate = query({
	args: {
		quote: v.string(),
		rateType: marketRateType,
		date: v.string(),
	},
	returns: rateResult,
	handler: async (ctx, args) => {
		const row = await resolveRateOnDate(
			ctx.db,
			args.quote,
			args.rateType,
			args.date,
		);
		if (!row) {
			return null;
		}
		return { rate: row.rate, date: row.date, fetchedAt: row.fetchedAt };
	},
});

/**
 * PUBLIC — deliberately unauthenticated: exchange rates are market data that
 * belong to no user and reveal nothing about one.
 *
 * PAGINATED by pair index: `cursor` is an offset into `ANCHOR_PAIR_CATALOG`
 * (absent = page 0), not a Convex pagination cursor.
 */
export const pullRates = query({
	args: { cursor: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const windowStart = ratesWindowStart();
		const start = args.cursor ?? 0;
		const pagePairs = ANCHOR_PAIR_CATALOG.slice(start, start + PAIRS_PER_PAGE);

		// Per pair: anchors sit strictly before `windowStart` while window rows sit
		// on or after it, so the two reads never overlap and need no dedupe.
		const pairPages = await Promise.all(
			pagePairs.flatMap(({ quote, rateType }) => [
				ctx.db
					.query("exchangeRates")
					.withIndex("by_quote_and_rateType_and_date", (q) =>
						q
							.eq("quote", quote)
							.eq("rateType", rateType)
							.gte("date", windowStart),
					)
					.collect(),
				ctx.db
					.query("exchangeRates")
					.withIndex("by_quote_and_rateType_and_date", (q) =>
						q
							.eq("quote", quote)
							.eq("rateType", rateType)
							.lt("date", windowStart),
					)
					.order("desc")
					.take(1),
			]),
		);

		const rows = pairPages.flat().map(toRateWire);
		const nextIndex = start + PAIRS_PER_PAGE;
		const nextCursor =
			nextIndex < ANCHOR_PAIR_CATALOG.length ? nextIndex : null;
		return { rows, windowStart, nextCursor };
	},
});
