import type { RateLimitConfig } from "@convex-dev/rate-limiter";
import { DAY } from "@convex-dev/rate-limiter";

/**
 * $0.75 per 1,000 DeepSeek Search calls: https://api-docs.deepseek.com/quick_start/pricing
 * Billed per request, so a lookup that searches three times pays three times.
 */
const DEFAULT_SEARCH_PRICE_MICROS = 750;
/**
 * $0.30 per 1M input tokens on `deepseek-flash`, cache miss, peak hours. Off-peak halves it, and a
 * cache hit costs a fraction, so this is the conservative ceiling the budget is charged against.
 */
const DEFAULT_INPUT_PRICE_MICROS_PER_TOKEN = 0.3;
/** $1.20 per 1M output tokens on `deepseek-flash`, peak hours. */
const DEFAULT_OUTPUT_PRICE_MICROS_PER_TOKEN = 1.2;
export const DEFAULT_BUDGET_CEILING_MICROS = 200_000_000;
const BUDGET_PERIOD_MS = 30 * DAY;
export const WORST_CASE_SEARCH_CALLS = 3;
/** Backs the pessimistic pre-charge. Search results bill as input: one-search lookups measured 14k to 17.5k tokens. */
const ESTIMATED_INPUT_TOKENS = 18_000;
const ESTIMATED_OUTPUT_TOKENS = 420;

function envNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
        return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function searchPriceMicros(): number {
    return envNumber("GROUNDED_SEARCH_PRICE_MICROS", DEFAULT_SEARCH_PRICE_MICROS);
}

export function inputPriceMicrosPerToken(): number {
    return envNumber("GROUNDED_INPUT_PRICE_MICROS_PER_TOKEN", DEFAULT_INPUT_PRICE_MICROS_PER_TOKEN);
}

export function outputPriceMicrosPerToken(): number {
    return envNumber("GROUNDED_OUTPUT_PRICE_MICROS_PER_TOKEN", DEFAULT_OUTPUT_PRICE_MICROS_PER_TOKEN);
}

/** Read live so `npx convex env set GROUNDED_BUDGET_MICROS=0` closes the gate without a deploy. */
export function budgetCeilingMicros(): number {
    return envNumber("GROUNDED_BUDGET_MICROS", DEFAULT_BUDGET_CEILING_MICROS);
}

// Passed inline, never registered: a registered config cannot change per call, so the env var could not move it.
export function budgetConfig(): RateLimitConfig {
    return {
        kind: "fixed window",
        period: BUDGET_PERIOD_MS,
        rate: budgetCeilingMicros(),
        shards: 10,
    };
}

export function estimateMicros(): number {
    return (
        WORST_CASE_SEARCH_CALLS * searchPriceMicros() +
        ESTIMATED_INPUT_TOKENS * inputPriceMicrosPerToken() +
        ESTIMATED_OUTPUT_TOKENS * outputPriceMicrosPerToken()
    );
}

export interface UsageLike {
    inputTokens?: number | null;
    outputTokens?: number | null;
}

export function measureMicros(usage: UsageLike, searchCalls: number): number {
    return (
        searchCalls * searchPriceMicros() +
        (usage.inputTokens ?? 0) * inputPriceMicrosPerToken() +
        (usage.outputTokens ?? 0) * outputPriceMicrosPerToken()
    );
}
