/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { MockLanguageModelV3 } from "ai/test";
import revenuecatTest from "convex-revenuecat/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import {
    EMPTY,
    maybeScheduleGrounded,
    needsGroundedLookup,
    REQUEST_TIMEOUT_MS,
    rateLimiter,
    runSuggest,
    sanitizeDomain,
    sanitizeCurrencyCode,
    sanitizeRegionCode,
    suggestArgs,
} from "./enrichment";
import { merchantKey } from "./lib/merchantKey";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
    vi.unstubAllEnvs();
    // Without this, `rateLimiter.limit`'s `mockImplementation` from the
    // "global window exhausted" test below stayed wrapped onto the shared
    // module-level `rateLimiter` singleton for every later test in this file.
    vi.restoreAllMocks();
});

/**
 * `Output.object` sends `{type: "json", schema}` and parses the model's text
 * response as JSON — there is no tool-call path to fake, so a mock model only
 * needs to return the JSON payload as a single text content part.
 */
function mockModel(payload: unknown) {
    return new MockLanguageModelV3({
        doGenerate: async () => ({
            content: [{ text: JSON.stringify(payload), type: "text" }],
            finishReason: { raw: undefined, unified: "stop" },
            usage: {
                inputTokens: {
                    cacheRead: undefined,
                    cacheWrite: undefined,
                    noCache: undefined,
                    total: undefined,
                },
                outputTokens: {
                    reasoning: undefined,
                    text: undefined,
                    total: undefined,
                },
            },
            warnings: [],
        }),
    });
}

const BASE_ARGS = {
    categoryTree: [
        { children: [], name: "Entertainment" },
        { children: ["Supermarket"], name: "Groceries" },
    ],
    groundedLookup: false,
    income: false,
    name: "netflix",
};

describe("suggest args validation", () => {
    test("carries exactly the eight privacy-boundary fields", () => {
        // Amounts, dates, accounts, balances, and identity must never leave the
        // device — this is a threat-matrix assertion, not a shape convenience.
        // `currency` is a code, never a figure.
        expect(Object.keys(suggestArgs).sort()).toStrictEqual(
            [
                "categoryTree",
                "currency",
                "groundedLookup",
                "income",
                "knowledgeOnly",
                "locale",
                "name",
                "regionCode",
            ].sort()
        );
    });
});

describe("suggest guard ladder", () => {
    test("returns EMPTY for a signed-out caller", async () => {
        const t = convexTest(schema, modules);

        await expect(t.action(api.enrichment.suggest, BASE_ARGS)).resolves.toStrictEqual(EMPTY);
    });

    test("returns EMPTY when XAI_API_KEY is unset", async () => {
        vi.stubEnv("XAI_API_KEY", "");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await expect(authenticatedAs(t, identity).action(api.enrichment.suggest, BASE_ARGS)).resolves.toStrictEqual(
            EMPTY
        );
    });

    test("returns EMPTY for a name shorter than 3 trimmed characters", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await expect(
            authenticatedAs(t, identity).action(api.enrichment.suggest, {
                ...BASE_ARGS,
                name: " hi ",
            })
        ).resolves.toStrictEqual(EMPTY);
    });

    test("returns EMPTY for a name longer than 64 trimmed characters", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await expect(
            authenticatedAs(t, identity).action(api.enrichment.suggest, {
                ...BASE_ARGS,
                name: "a".repeat(65),
            })
        ).resolves.toStrictEqual(EMPTY);
    });

    test("returns EMPTY and never throws once the per-user bucket is exhausted", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        revenuecatTest.register(t);
        const identity = await seedAuthUser(t);
        const asUser = authenticatedAs(t, identity);
        const tokenIdentifier = await asUser.run(async (ctx) => (await ctx.auth.getUserIdentity())?.tokenIdentifier);
        if (!tokenIdentifier) {
            throw new Error("Expected an authenticated identity");
        }

        // A fresh key's bucket starts at full capacity (8, the configured max a
        // single call may request); draining it in one call is deterministic
        // because it is the very first write for this key — the component takes
        // its single-shard fast path with no random sampling.
        await t.run(async (ctx) =>
            rateLimiter.limit(ctx, "enrichmentPerUser", {
                count: 8,
                key: tokenIdentifier,
            })
        );

        await expect(asUser.action(api.enrichment.suggest, BASE_ARGS)).resolves.toStrictEqual(EMPTY);
    });

    test("returns EMPTY and never throws once the global window is exhausted", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        // The global limit is sharded 10 ways and sampled at random per call, so
        // exhausting it deterministically through real component writes would
        // mean draining all 10 shards. Asserting the guard reads a failed check
        // correctly does not require re-proving the component's own sharding
        // math (that is the library's concern) — only that a not-ok result short
        // circuits before any model call.
        const limitSpy = vi
            .spyOn(rateLimiter, "limit")
            .mockImplementation(async (_ctx, name) =>
                name === "enrichmentGlobal" ? { ok: false, retryAfter: 1000 } : { ok: true, retryAfter: undefined }
            );

        await expect(authenticatedAs(t, identity).action(api.enrichment.suggest, BASE_ARGS)).resolves.toStrictEqual(
            EMPTY
        );
        expect(limitSpy).toHaveBeenCalledWith(expect.anything(), "enrichmentGlobal");
    });
});

describe("merchantKnowledge cache (Tier 1.5)", () => {
    async function seedKnowledge(t: ReturnType<typeof convexTest>, name: string) {
        await t.run((ctx) =>
            ctx.db.insert("merchantKnowledge", {
                categoryName: "Healthcare",
                domain: "farmatodo.com",
                emoji: "💊",
                key: merchantKey(name),
                modelId: "test-model",
                parentCategoryName: null,
                resolvedAt: Date.now(),
                tags: ["pharmacy"],
            })
        );
    }

    test("a currency-scoped request reads its own partition, never the bare one", async () => {
        vi.stubEnv("XAI_API_KEY", "");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);
        await seedKnowledge(t, "Sushi Way");

        await expect(
            authenticatedAs(t, identity).action(api.enrichment.suggest, {
                ...BASE_ARGS,
                currency: "EUR",
                name: "Sushi Way",
            })
        ).resolves.toStrictEqual(EMPTY);

        await t.run((ctx) =>
            ctx.db.insert("merchantKnowledge", {
                categoryName: "Dining Out",
                domain: "sushiway.fr",
                emoji: null,
                key: `${merchantKey("Sushi Way")}|eur`,
                modelId: "test-model",
                parentCategoryName: null,
                resolvedAt: Date.now(),
                tags: [],
            })
        );

        await expect(
            authenticatedAs(t, identity).action(api.enrichment.suggest, {
                ...BASE_ARGS,
                currency: "EUR",
                name: "Sushi Way",
            })
        ).resolves.toMatchObject({ domain: "sushiway.fr" });
    });

    test("a cache hit serves category, tags and domain without consuming either rate-limit bucket", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);
        await seedKnowledge(t, "Farmatodo");
        const limitSpy = vi.spyOn(rateLimiter, "limit");

        const result = await authenticatedAs(t, identity).action(api.enrichment.suggest, {
            ...BASE_ARGS,
            name: "Farmatodo",
        });

        expect(result).toMatchObject({
            categoryName: "Healthcare",
            domain: "farmatodo.com",
            emoji: "💊",
            grounding: false,
            tags: ["pharmacy"],
        });
        expect(limitSpy).not.toHaveBeenCalled();
    });

    test("case, diacritic and whitespace variants collide to the same cached key", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);
        await seedKnowledge(t, "Farmatodo");
        const asUser = authenticatedAs(t, identity);

        await expect(
            asUser.action(api.enrichment.suggest, {
                ...BASE_ARGS,
                name: " FARMÁTODO ",
            })
        ).resolves.toMatchObject({ categoryName: "Healthcare" });
    });

    test("a knowledgeOnly hit serves the cached row exactly like an ordinary hit", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);
        await seedKnowledge(t, "Farmatodo");

        await expect(
            authenticatedAs(t, identity).action(api.enrichment.suggest, {
                ...BASE_ARGS,
                knowledgeOnly: true,
                name: "Farmatodo",
            })
        ).resolves.toMatchObject({
            categoryName: "Healthcare",
            domain: "farmatodo.com",
            grounding: false,
        });
    });

    test("a knowledgeOnly miss returns EMPTY without consuming a rate limit or the model", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);
        const limitSpy = vi.spyOn(rateLimiter, "limit");

        await expect(
            authenticatedAs(t, identity).action(api.enrichment.suggest, {
                ...BASE_ARGS,
                knowledgeOnly: true,
                name: "totally unknown merchant xyz",
            })
        ).resolves.toStrictEqual(EMPTY);
        expect(limitSpy).not.toHaveBeenCalled();
    });

    test("a cache miss falls through to the existing guard ladder unchanged", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await expect(
            authenticatedAs(t, identity).action(api.enrichment.suggest, {
                ...BASE_ARGS,
                name: "totally unknown merchant xyz",
            })
        ).resolves.toStrictEqual(EMPTY);
    });
});

describe("latency/retry regression guard (task 3.13)", () => {
    test("REQUEST_TIMEOUT_MS is unchanged at 3500ms", () => {
        expect(REQUEST_TIMEOUT_MS).toBe(3500);
    });

    test("runSuggest never retries a thrown provider error (maxRetries: 0)", async () => {
        let calls = 0;
        const throwing = new MockLanguageModelV3({
            doGenerate: async () => {
                calls += 1;
                throw new Error("network down");
            },
        });

        await expect(runSuggest(throwing, BASE_ARGS)).rejects.toThrow();
        expect(calls).toBe(1);
    });
});

describe(needsGroundedLookup, () => {
    test("a confident category with no domain still needs one", () => {
        expect(needsGroundedLookup({ categoryName: "Groceries", domain: null })).toBeTruthy();
    });

    test("a missing category needs one", () => {
        expect(needsGroundedLookup({ categoryName: null, domain: "gama.com" })).toBeTruthy();
    });

    test("both missing needs one", () => {
        expect(needsGroundedLookup({ categoryName: null, domain: null })).toBeTruthy();
    });

    test("a complete answer needs none", () => {
        expect(needsGroundedLookup({ categoryName: "Groceries", domain: "gama.com" })).toBeFalsy();
    });
});

describe(maybeScheduleGrounded, () => {
    async function scheduledGroundedRuns(t: ReturnType<typeof convexTest>) {
        const rows = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
        return rows.filter((row) => row.name.includes("groundedLookup"));
    }

    /**
     * `authenticatedAs` returns `AnyTestConvex` (widened for Better Auth's
     * generic component schema — see `test.helpers.ts`), which loses this
     * file's concrete `DataModel` and makes an inline `t.action` callback fail
     * to typecheck against `ActionCtx`. Calling `t.withIdentity` directly on
     * the concretely-typed `t` keeps the same runtime identity without that
     * widening.
     */
    function asIdentity(t: ReturnType<typeof convexTest>, identity: Awaited<ReturnType<typeof seedAuthUser>>) {
        return t.withIdentity({
            sessionId: identity.sessionId,
            subject: identity.subject,
        });
    }

    test("does not schedule when the client arg is false", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await asIdentity(t, identity).run((ctx) =>
            maybeScheduleGrounded(ctx, "token-a", {
                groundedLookup: false,
                income: false,
                name: "Farmatodo",
            })
        );

        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });

    test("does not schedule when the synced appMeta row is false despite a true arg", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);
        await t.run((ctx) =>
            ctx.db.insert("appMeta", {
                deviceId: "test-device",
                key: "groundedLookup",
                seq: 1,
                updatedAt: Date.now(),
                userId: identity.userId,
                value: "false",
            })
        );

        await asIdentity(t, identity).run((ctx) =>
            maybeScheduleGrounded(ctx, "token-b", {
                groundedLookup: true,
                income: false,
                name: "Farmatodo",
            })
        );

        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });

    test("schedules when the arg is true and no appMeta row exists", async () => {
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        revenuecatTest.register(t);
        const identity = await seedAuthUser(t);

        const scheduled = await asIdentity(t, identity).run((ctx) =>
            maybeScheduleGrounded(ctx, "token-c", {
                groundedLookup: true,
                income: false,
                name: "Farmatodo",
            })
        );

        expect(scheduled).toBeTruthy();
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(1);
    });

    test("the scheduled args never carry categoryTree (ADR-7)", async () => {
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        revenuecatTest.register(t);
        const identity = await seedAuthUser(t);

        await asIdentity(t, identity).run((ctx) =>
            maybeScheduleGrounded(ctx, "token-d", {
                groundedLookup: true,
                income: false,
                locale: "es-VE",
                name: "Farmatodo",
            })
        );

        const [row] = await scheduledGroundedRuns(t);
        const scheduledArgs = row.args[0] as Record<string, unknown>;
        expect(scheduledArgs).not.toHaveProperty("categoryTree");
        expect(scheduledArgs).toStrictEqual({
            income: false,
            key: merchantKey("Farmatodo"),
            locale: "es-VE",
            name: "Farmatodo",
        });
    });

    test("returns false instead of throwing when the session no longer resolves to a user", async () => {
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        revenuecatTest.register(t);
        const identity = await seedAuthUser(t);

        const stale = t.withIdentity({
            sessionId: "session-that-was-revoked",
            subject: identity.subject,
        });

        await expect(
            stale.run((ctx) =>
                maybeScheduleGrounded(ctx, "token-f", {
                    groundedLookup: true,
                    income: false,
                    name: "Farmatodo",
                })
            )
        ).resolves.toBeFalsy();
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });

    test("the scheduled args thread a region code through to groundedLookup.run", async () => {
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        revenuecatTest.register(t);
        const identity = await seedAuthUser(t);

        await asIdentity(t, identity).run((ctx) =>
            maybeScheduleGrounded(ctx, "token-e", {
                groundedLookup: true,
                income: false,
                name: "Farmatodo",
                regionCode: "VE",
            })
        );

        const [row] = await scheduledGroundedRuns(t);
        const scheduledArgs = row.args[0] as Record<string, unknown>;
        expect(scheduledArgs.regionCode).toBe("VE");
    });
});

describe("runSuggest sanitisation", () => {
    test("trims category name, tags and domain from well-formed model output", async () => {
        const model = mockModel({
            categoryName: "  Streaming  ",
            domain: "  netflix.com  ",
            domainConfidence: "high",
            isNewCategory: true,
            tags: ["  Music  ", "Streaming"],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toStrictEqual({
            categoryName: "Streaming",
            domain: "netflix.com",
            emoji: null,
            grounding: false,
            isNewCategory: true,
            parentCategoryName: null,
            tags: ["Music", "Streaming"],
        });
    });

    test("drops empty tags and caps the rest at 3 entries of 24 characters", async () => {
        const model = mockModel({
            categoryName: null,
            domain: null,
            isNewCategory: false,
            tags: ["", "  ", "a".repeat(30), "second", "third", "fourth"],
        });

        const result = await runSuggest(model, {
            ...BASE_ARGS,
            categoryTree: [],
        });

        expect(result.tags).toStrictEqual(["a".repeat(24), "second", "third"]);
    });

    test("drops a domain the model itself rates low, so the grounded tier is asked instead", async () => {
        const model = mockModel({
            categoryName: "Dining Out",
            domain: "sushiway.com",
            domainConfidence: "low",
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({
            categoryName: "Dining Out",
            domain: null,
        });
    });

    test("drops a domain the model did not rate at all", async () => {
        const model = mockModel({
            categoryName: "Groceries",
            domain: "intermarche.com",
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({
            categoryName: "Groceries",
            domain: null,
        });
    });

    test("keeps a domain rated medium", async () => {
        const model = mockModel({
            categoryName: "Groceries",
            domain: "intermarche.com",
            domainConfidence: "medium",
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({
            domain: "intermarche.com",
        });
    });

    test("rejects a domain that is not a bare host.tld shape", async () => {
        const model = mockModel({
            categoryName: null,
            domain: "https://netflix.com/watch",
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({ domain: null });
    });

    test("case-folds an otherwise valid domain instead of rejecting it", async () => {
        const model = mockModel({
            categoryName: null,
            domain: "NETFLIX.COM",
            domainConfidence: "high",
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({
            domain: "netflix.com",
        });
    });

    test("rejects a domain longer than 253 characters", async () => {
        const longDomain = `${"a".repeat(251)}.co`;
        expect(longDomain.length).toBeGreaterThan(253);
        const model = mockModel({
            categoryName: null,
            domain: longDomain,
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({ domain: null });
    });

    test("nulls out an empty category name", async () => {
        const model = mockModel({
            categoryName: "   ",
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({
            categoryName: null,
        });
    });

    test("nulls out a category name longer than 40 characters", async () => {
        const model = mockModel({
            categoryName: "a".repeat(41),
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree: [] })).resolves.toMatchObject({
            categoryName: null,
        });
    });

    test("recomputes isNewCategory as true when the model discards it but the name is unknown", async () => {
        const model = mockModel({
            categoryName: "Pets",
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await expect(
            runSuggest(model, {
                ...BASE_ARGS,
                categoryTree: [
                    { children: [], name: "Entertainment" },
                    { children: [], name: "Groceries" },
                ],
            })
        ).resolves.toMatchObject({ categoryName: "Pets", isNewCategory: true });
    });

    test("recomputes isNewCategory as false when the model claims new but the name is already known", async () => {
        const model = mockModel({
            categoryName: "Entertainment",
            domain: null,
            isNewCategory: true,
            tags: [],
        });

        await expect(
            runSuggest(model, {
                ...BASE_ARGS,
                categoryTree: [
                    { children: [], name: "Entertainment" },
                    { children: [], name: "Groceries" },
                ],
            })
        ).resolves.toMatchObject({
            categoryName: "Entertainment",
            isNewCategory: false,
        });
    });

    test("caps the category tree at 60 branches for the isNewCategory check", async () => {
        const categoryTree = Array.from({ length: 61 }, (_, i) => ({
            children: [],
            name: `Cat${i}`,
        }));
        // The 61st branch is pushed out of the server-side cap, so it must read as
        // "new" even though the caller technically listed it as known.
        const model = mockModel({
            categoryName: "Cat60",
            domain: null,
            emoji: null,
            isNewCategory: false,
            parentCategoryName: null,
            tags: [],
        });

        await expect(runSuggest(model, { ...BASE_ARGS, categoryTree })).resolves.toMatchObject({
            categoryName: "Cat60",
            isNewCategory: true,
        });
    });

    test("keeps a parent the user actually has, for a category being created", async () => {
        const model = mockModel({
            categoryName: "Streaming",
            domain: null,
            emoji: "📺",
            isNewCategory: true,
            parentCategoryName: "Entertainment",
            tags: [],
        });

        await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
            categoryName: "Streaming",
            emoji: "📺",
            isNewCategory: true,
            parentCategoryName: "Entertainment",
        });
    });

    test("drops a parent the user does not have", async () => {
        // The model cannot know this ledger's shape, so an invented parent is not
        // taken on trust.
        const model = mockModel({
            categoryName: "Streaming",
            domain: null,
            emoji: null,
            isNewCategory: true,
            parentCategoryName: "Invented Parent",
            tags: [],
        });

        await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
            parentCategoryName: null,
        });
    });

    test("drops a parent when the category already exists", async () => {
        const model = mockModel({
            categoryName: "Entertainment",
            domain: null,
            emoji: null,
            isNewCategory: true,
            parentCategoryName: "Groceries",
            tags: [],
        });

        await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
            isNewCategory: false,
            parentCategoryName: null,
        });
    });

    test("rejects an emoji field that is really a sentence", async () => {
        const model = mockModel({
            categoryName: "Streaming",
            domain: null,
            emoji: "a television set",
            isNewCategory: true,
            parentCategoryName: null,
            tags: [],
        });

        await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
            emoji: null,
        });
    });
});

describe("runSuggest regionCode", () => {
    test("threads a region code into the model prompt", async () => {
        const model = mockModel({
            categoryName: null,
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await runSuggest(model, {
            ...BASE_ARGS,
            categoryTree: [],
            regionCode: "VE",
        });

        const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
        expect(sent).toContain("VE");
    });

    test("licenses a global fallback when no business operates in the region", async () => {
        const model = mockModel({
            categoryName: null,
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await runSuggest(model, {
            ...BASE_ARGS,
            categoryTree: [],
            regionCode: "VE",
        });

        const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
        expect(sent).toContain("fall back to the best globally known match");
    });

    test("threads the purchase currency into the prompt", async () => {
        const model = mockModel({
            categoryName: null,
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await runSuggest(model, { ...BASE_ARGS, categoryTree: [], currency: "EUR" });

        const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
        expect(sent).toContain("charged in EUR");
    });

    test("asks for a best-guess domain and a confidence, and says what the name looks like", async () => {
        const model = mockModel({
            categoryName: null,
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await runSuggest(model, { ...BASE_ARGS, categoryTree: [] });

        const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
        expect(sent).toContain("domainConfidence");
        expect(sent).toContain("Set brand to the business's official name");
        expect(sent).toContain("keeping hyphens, digits, dots and country suffixes");
        expect(sent).toContain("card-terminal or bank-statement descriptor");
        expect(sent).not.toContain("only if you are confident");
    });

    test("omits any region line from the prompt when regionCode is absent", async () => {
        const model = mockModel({
            categoryName: null,
            domain: null,
            isNewCategory: false,
            tags: [],
        });

        await runSuggest(model, { ...BASE_ARGS, categoryTree: [] });

        const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
        expect(sent).not.toContain("located in region");
    });
});

describe(sanitizeDomain, () => {
    test("strips a leading www. so logo.dev's apex-only lookup still matches", () => {
        expect(sanitizeDomain("www.unicasa.com.ve")).toBe("unicasa.com.ve");
    });

    test("leaves an already-apex domain unchanged", () => {
        expect(sanitizeDomain("unicasa.com.ve")).toBe("unicasa.com.ve");
    });

    test("does not strip a host that merely starts with the letters www", () => {
        expect(sanitizeDomain("wwwfoo.com")).toBe("wwwfoo.com");
    });

    test("rejects www. alone, since nothing remains after stripping", () => {
        expect(sanitizeDomain("www.")).toBeNull();
    });

    test("case-folds before stripping, so WWW.NETFLIX.COM also loses its prefix", () => {
        expect(sanitizeDomain("WWW.NETFLIX.COM")).toBe("netflix.com");
    });
});

describe(sanitizeCurrencyCode, () => {
    test("uppercases a valid lowercase code", () => {
        expect(sanitizeCurrencyCode("eur")).toBe("EUR");
    });

    test("rejects anything that is not a currency the app can pick", () => {
        expect(sanitizeCurrencyCode("EURO")).toBeUndefined();
        expect(sanitizeCurrencyCode("E1R")).toBeUndefined();
        expect(sanitizeCurrencyCode("AAA")).toBeUndefined();
        expect(sanitizeCurrencyCode("")).toBeUndefined();
        expect(sanitizeCurrencyCode(undefined)).toBeUndefined();
    });
});

describe(sanitizeRegionCode, () => {
    test("uppercases a valid lowercase code", () => {
        expect(sanitizeRegionCode("ve")).toBe("VE");
    });

    test("leaves an already-uppercase code unchanged", () => {
        expect(sanitizeRegionCode("VE")).toBe("VE");
    });

    test("rejects a three-letter code", () => {
        expect(sanitizeRegionCode("VEN")).toBeUndefined();
    });

    test("rejects a code containing a digit", () => {
        expect(sanitizeRegionCode("1E")).toBeUndefined();
    });

    test("rejects an empty string", () => {
        expect(sanitizeRegionCode("")).toBeUndefined();
    });

    test("rejects a 400-character string", () => {
        expect(sanitizeRegionCode("a".repeat(400))).toBeUndefined();
    });

    test("passes undefined through unchanged", () => {
        expect(sanitizeRegionCode(undefined)).toBeUndefined();
    });
});
