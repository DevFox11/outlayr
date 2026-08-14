// oxlint-disable unicorn/filename-case -- a Convex module's path is its public API — this file is addressed as internal.exchangeRates.* from the crons and from apps/native
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import {
    marketRateType,
    PICKABLE_CURRENCY_CODES,
    rateSource,
    resolveRateOnDate,
    utcDateString,
} from "./lib/currencies";
import type { MarketRateType } from "./lib/currencies";

const PRUNE_BATCH_SIZE = 200;

/**
 * Gap between prune batches. The chain used to reschedule at `runAfter(0)`,
 * which dispatched a whole backlog back to back — a 13k-row one is ~65 batches,
 * and each deleted row also rewrites its two index entries, so the sustained
 * rate crossed the deployment's per-second write budget. One batch per second
 * holds a full drain far under that ceiling and still clears that backlog in
 * about a minute; steady state is a single batch and never waits at all.
 */
const PRUNE_BATCH_INTERVAL_MS = 1000;

/**
 * Retries of one failed batch before the pass gives up and leaves the rest to
 * the next daily cron. The delay doubles each time, so the budget spans roughly
 * 5s to 40s — long enough to outlast a transient write-rate spike, short enough
 * that a genuinely broken batch surfaces as a failed run the same day.
 */
const PRUNE_MAX_RETRIES = 4;
const PRUNE_RETRY_BASE_MS = 5000;

/** What one `pruneStaleBatch` invocation did: drained through `cursor`, or threw. */
type PruneBatchOutcome = { cursor: string; failed: false; isDone: boolean } | { failed: true };

/** The arguments the pass resumes with, and how long it waits first. */
interface PruneStep {
    cursor: string | null;
    delayMs: number;
    retries: number;
}

/**
 * Where a pass goes after a batch, or `null` when it stops — the backlog is
 * drained, or a batch has failed past its retry budget.
 *
 * Pure and exported so the chain's survival is testable: a rate-limit failure
 * is not reproducible under `convex-test`, but the decision it feeds into is.
 */
export function nextPruneStep(
    outcome: PruneBatchOutcome,
    current: { cursor: string | null; retries: number }
): PruneStep | null {
    if (outcome.failed) {
        // A failed batch rolled its own deletes back, so the retry resumes at the
        // SAME cursor rather than skipping the page.
        if (current.retries >= PRUNE_MAX_RETRIES) {
            return null;
        }
        return {
            cursor: current.cursor,
            delayMs: PRUNE_RETRY_BASE_MS * 2 ** current.retries,
            retries: current.retries + 1,
        };
    }
    if (outcome.isDone) {
        return null;
    }
    // Retries reset on success: the budget is per stuck batch, not per pass.
    return { cursor: outcome.cursor, delayMs: PRUNE_BATCH_INTERVAL_MS, retries: 0 };
}

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

/**
 * The last date string that still sorts inside `date`'s calendar month.
 *
 * `31` rather than the month's real length: dates are `YYYY-MM-DD`, which sorts
 * lexically exactly as it sorts chronologically, so `2026-02-31` is a valid
 * bound for February even though it is not a date. Deriving the real length
 * would be more code for the same set.
 */
function monthEndBound(date: string): string {
    return `${date.slice(0, 8)}31`;
}

interface RatePair {
    quote: string;
    rateType: MarketRateType;
}

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
 * How many monthly anchors a pair serves — twenty years, which is past any
 * ledger this app will hold and still a bounded read.
 *
 * A cap rather than an unbounded `collect()` because the page's document budget
 * has to be provable: without one, a deployment that has been ingesting for
 * years would silently grow its page until a pull started failing.
 */
export const MONTHLY_ANCHOR_LIMIT = 240;

/**
 * Pairs served per `pullRates` page. 12 x (90 window days + same-day row + 240
 * monthly anchors) = 3,972 docs/page — comfortably under Convex's 16,384-doc
 * read ceiling, and the bound is per PAGE, so it holds however large the
 * provider catalog grows.
 *
 * Lower than it was: each pair now carries its monthly history rather than a
 * single anchor row, so the same budget buys fewer pairs per page and more
 * pages. Pages are cheap; a pull that exceeds the read ceiling is not.
 */
export const PAIRS_PER_PAGE = 12;

function toRateWire(doc: Doc<"exchangeRates">) {
    return {
        date: doc.date,
        fetchedAt: doc.fetchedAt,
        quote: doc.quote,
        rate: doc.rate,
        rateType: doc.rateType,
        source: doc.source,
    };
}

const rateResult = v.union(
    v.object({
        date: v.string(),
        fetchedAt: v.number(),
        rate: v.number(),
    }),
    v.null()
);

/**
 * Which `official` quotes are already stored on each requested date, so an
 * ingester can tell a day it holds in full from one it holds a slice of.
 *
 * Restricted to `official` because that is the only rateType Frankfurter
 * writes: a cotizave `binance` row on the same date is not coverage for the
 * official quote. The caller must BATCH the date list — one date is bounded by
 * the provider catalog, but a whole 90-day window would approach Convex's
 * per-transaction document ceiling.
 */
export const officialQuotesByDate = internalQuery({
    args: { dates: v.array(v.string()) },
    handler: async (ctx, args) =>
        await Promise.all(
            args.dates.map(async (date) => {
                const rows = await ctx.db
                    .query("exchangeRates")
                    .withIndex("by_date", (q) => q.eq("date", date))
                    .collect();
                return {
                    date,
                    quotes: rows.filter((row) => row.rateType === "official").map((row) => row.quote),
                };
            })
        ),
    returns: v.array(v.object({ date: v.string(), quotes: v.array(v.string()) })),
});

export const upsertRates = internalMutation({
    args: {
        date: v.string(),
        fetchedAt: v.number(),
        rates: v.array(
            v.object({
                quote: v.string(),
                rate: v.number(),
                rateType: marketRateType,
            })
        ),
        source: rateSource,
    },
    handler: async (ctx, args) => {
        /* oxlint-disable no-await-in-loop -- rates arrive from an upstream HTTP payload, so a repeated (quote, rateType) must read back the row the previous iteration wrote — running the array in parallel would insert the pair twice */
        for (const entry of args.rates) {
            if (!Number.isFinite(entry.rate) || entry.rate <= 0) {
                continue;
            }

            const existing = await ctx.db
                .query("exchangeRates")
                .withIndex("by_quote_and_rateType_and_date", (q) =>
                    q.eq("quote", entry.quote).eq("rateType", entry.rateType).eq("date", args.date)
                )
                .unique();

            if (existing) {
                // Source priority: a cotizave row (BCV official / live market mids) is
                // authoritative and must not be clobbered by a Frankfurter refresh.
                if (args.source === "frankfurter" && existing.source === "cotizave") {
                    continue;
                }
                await ctx.db.patch("exchangeRates", existing._id, {
                    fetchedAt: args.fetchedAt,
                    rate: entry.rate,
                    source: args.source,
                });
            } else {
                await ctx.db.insert("exchangeRates", {
                    date: args.date,
                    fetchedAt: args.fetchedAt,
                    quote: entry.quote,
                    rate: entry.rate,
                    rateType: entry.rateType,
                    source: args.source,
                });
            }
        }
        /* oxlint-enable no-await-in-loop */
        return null;
    },
    returns: v.null(),
});

interface PruneBatchResult {
    cursor: string;
    deleted: number;
    isDone: boolean;
}

/**
 * One page of the prune. Deletes every row older than the `pullRates` window
 * EXCEPT each `(quote, rateType)` pair's newest pre-window row — the anchor
 * `pullRates` depends on, kept for non-catalog pairs too. A row is deleted iff a
 * NEWER pre-window row exists for its pair, which is order-independent within a
 * pass. `windowStart` is threaded in rather than recomputed so one pass prunes
 * against a single consistent boundary.
 *
 * Schedules NOTHING: the chain lives in `pruneStale` because a mutation that
 * throws rolls its own `scheduler.runAfter` back with it, which is exactly how
 * the pass used to die on a backlog.
 */
export const pruneStaleBatch = internalMutation({
    args: {
        cursor: v.union(v.string(), v.null()),
        windowStart: v.string(),
    },
    handler: async (ctx, args) => {
        const { windowStart } = args;

        const page = await ctx.db
            .query("exchangeRates")
            .withIndex("by_date", (q) => q.lt("date", windowStart))
            .paginate({ cursor: args.cursor, numItems: PRUNE_BATCH_SIZE });

        let deleted = 0;
        /* oxlint-disable no-await-in-loop -- each lookup must observe the deletes this pass already made, so parallelising the page would make the mutation's read set depend on promise scheduling */
        for (const row of page.page) {
            // Scoped to the row's own calendar month, so what survives is the newest
            // row per pair per month rather than one row per pair overall. A single
            // anchor ages forward with the window and is therefore only ever a
            // boundary guard: an entry older than it resolves to no rate at all and
            // falls back to face value for good.
            // One upper bound, not two: an index range takes a single one per field.
            // The month's end and the window's start are both exclusive-or-inclusive
            // in different ways, so the tighter of the pair is resolved first.
            const monthEnd = monthEndBound(row.date);
            const newer = await ctx.db
                .query("exchangeRates")
                .withIndex("by_quote_and_rateType_and_date", (q) => {
                    const from = q.eq("quote", row.quote).eq("rateType", row.rateType).gt("date", row.date);
                    return monthEnd < windowStart ? from.lte("date", monthEnd) : from.lt("date", windowStart);
                })
                .take(1);
            if (newer.length > 0) {
                await ctx.db.delete("exchangeRates", row._id);
                deleted += 1;
            }
        }
        /* oxlint-enable no-await-in-loop */

        return { cursor: page.continueCursor, deleted, isDone: page.isDone };
    },
    returns: v.object({ cursor: v.string(), deleted: v.number(), isDone: v.boolean() }),
});

/**
 * Drives the prune one batch at a time: the cron's entry point, and every link
 * of the chain that follows it.
 *
 * An ACTION rather than a mutation because it is the only place a continuation
 * survives a failed batch. `scheduler.runAfter` inside a mutation is part of
 * that mutation's transaction, so a batch that hits the deployment's write-rate
 * limit takes its own reschedule down with it and the pass stops for the day —
 * against a backlog that means it never drains at all. Here the batch is a
 * nested mutation whose failure rolls back only itself, leaving this handler
 * free to reschedule the same cursor with backoff.
 */
export const pruneStale = internalAction({
    args: {
        cursor: v.optional(v.union(v.string(), v.null())),
        retries: v.optional(v.number()),
        windowStart: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const windowStart = args.windowStart ?? ratesWindowStart();
        const cursor = args.cursor ?? null;
        const retries = args.retries ?? 0;

        let batch: PruneBatchResult;
        try {
            batch = await ctx.runMutation(internal.exchangeRates.pruneStaleBatch, { cursor, windowStart });
        } catch (error) {
            const retry = nextPruneStep({ failed: true }, { cursor, retries });
            if (!retry) {
                // Out of budget. Throwing marks the run failed so the batch that is
                // stuck is visible; the next daily cron restarts the pass from the
                // top, and everything earlier batches deleted has already committed.
                throw error;
            }
            console.error(
                `Prune batch failed, retry ${retry.retries} of ${PRUNE_MAX_RETRIES} in ${retry.delayMs}ms`,
                error
            );
            await ctx.scheduler.runAfter(retry.delayMs, internal.exchangeRates.pruneStale, {
                cursor: retry.cursor,
                retries: retry.retries,
                windowStart,
            });
            return { deleted: 0, isDone: false };
        }

        const step = nextPruneStep({ cursor: batch.cursor, failed: false, isDone: batch.isDone }, { cursor, retries });
        if (step) {
            await ctx.scheduler.runAfter(step.delayMs, internal.exchangeRates.pruneStale, {
                cursor: step.cursor,
                retries: step.retries,
                windowStart,
            });
        }
        return { deleted: batch.deleted, isDone: batch.isDone };
    },
    returns: v.object({ deleted: v.number(), isDone: v.boolean() }),
});

export const getLatestRate = query({
    args: {
        quote: v.string(),
        rateType: marketRateType,
    },
    handler: async (ctx, args) => {
        const rows = await ctx.db
            .query("exchangeRates")
            .withIndex("by_quote_and_rateType_and_date", (q) => q.eq("quote", args.quote).eq("rateType", args.rateType))
            .order("desc")
            .take(1);
        const [row] = rows;
        if (!row) {
            return null;
        }
        return { date: row.date, fetchedAt: row.fetchedAt, rate: row.rate };
    },
    returns: rateResult,
});

export const getRateOnDate = query({
    args: {
        date: v.string(),
        quote: v.string(),
        rateType: marketRateType,
    },
    handler: async (ctx, args) => {
        const row = await resolveRateOnDate(ctx.db, args.quote, args.rateType, args.date);
        if (!row) {
            return null;
        }
        return { date: row.date, fetchedAt: row.fetchedAt, rate: row.rate };
    },
    returns: rateResult,
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
                        q.eq("quote", quote).eq("rateType", rateType).gte("date", windowStart)
                    )
                    .collect(),
                // Every surviving pre-window row, not just the newest. Pruning leaves
                // one per calendar month, so this is the pair's monthly history and
                // what lets an entry older than the window value at a rate from its
                // own time instead of falling back to face value.
                ctx.db
                    .query("exchangeRates")
                    .withIndex("by_quote_and_rateType_and_date", (q) =>
                        q.eq("quote", quote).eq("rateType", rateType).lt("date", windowStart)
                    )
                    .order("desc")
                    .take(MONTHLY_ANCHOR_LIMIT),
            ])
        );

        const rows = pairPages.flat().map(toRateWire);
        const nextIndex = start + PAIRS_PER_PAGE;
        const nextCursor = nextIndex < ANCHOR_PAIR_CATALOG.length ? nextIndex : null;
        return { nextCursor, rows, windowStart };
    },
});
