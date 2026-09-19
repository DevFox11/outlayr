import type { RateLimitConfig } from "@convex-dev/rate-limiter";
import { DAY } from "@convex-dev/rate-limiter";

/** $0.005 per xAI web-search call — https://docs.x.ai/docs/pricing (verified). */
const DEFAULT_SEARCH_PRICE_MICROS = 5000;
/** $1.25 per 1M input tokens on `grok-4.20-0309-non-reasoning`. */
const DEFAULT_INPUT_PRICE_MICROS_PER_TOKEN = 1.25;
/** $2.50 per 1M output tokens on `grok-4.20-0309-non-reasoning`. */
const DEFAULT_OUTPUT_PRICE_MICROS_PER_TOKEN = 2.5;
/** The monthly ceiling, in micro-dollars. */
export const DEFAULT_BUDGET_CEILING_MICROS = 200_000_000;
const BUDGET_PERIOD_MS = 30 * DAY;
/** Cost-model worst case: up to 3 search rounds per lookup. */
const WORST_CASE_SEARCH_CALLS = 3;
/** Rough two-pass token estimate backing the pessimistic pre-charge. */
const ESTIMATED_INPUT_TOKENS = 5600;
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

/**
 * Never registered as a named limit on the shared `RateLimiter` instance —
 * passing this inline on every call is what lets the ceiling move via an env
 * var alone (a statically-registered config cannot be overridden per call).
 */
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

/** The measured actual, recorded unconditionally regardless of outcome. */
export function measureMicros(usage: UsageLike, searchCalls: number): number {
    return (
        searchCalls * searchPriceMicros() +
        (usage.inputTokens ?? 0) * inputPriceMicrosPerToken() +
        (usage.outputTokens ?? 0) * outputPriceMicrosPerToken()
    );
}
