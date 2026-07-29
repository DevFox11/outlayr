import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { marketRateType, rateSource } from "./lib/currencies";

/**
 * Market exchange rates, quoted per USD. Written only by the fetcher crons and
 * bounded by `pruneStale`.
 *
 * `date` is a UTC `YYYY-MM-DD` string rather than an epoch so the composite
 * index reads as a calendar and `resolveRateOnDate` can ask for "the newest row
 * on or before this day", which is what covers the weekend and holiday gaps in
 * the provider feed.
 */
export default defineSchema({
	exchangeRates: defineTable({
		quote: v.string(),
		rateType: marketRateType,
		source: rateSource,
		rate: v.number(),
		date: v.string(),
		fetchedAt: v.number(),
	})
		.index("by_quote_and_rateType_and_date", ["quote", "rateType", "date"])
		.index("by_date", ["date"]),
});
