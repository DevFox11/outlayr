/// <reference types="vite/client" />

import { HOUR } from "@convex-dev/rate-limiter";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { MockLanguageModelV3 } from "ai/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import {
    classify,
    csvImportArgs,
    GROUNDED_IMPORT_MAX,
    perUserLimitConfig,
    rateLimiter,
    scheduleImportGrounded,
} from "./csvImport";
import { merchantKey } from "./lib/merchantKey";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function mockModel(text: string) {
    return new MockLanguageModelV3({
        doGenerate: async () => ({
            content: [{ text, type: "text" }],
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

function rejectingModel(error: Error) {
    return new MockLanguageModelV3({
        doGenerate: async () => {
            throw error;
        },
    });
}

const BASE_ARGS = {
    categoryTree: [
        { children: ["Coffee"], name: "Food" },
        { children: [], name: "Groceries" },
    ],
    labels: ["Coffee Shop", "Unknown Store"],
};

describe("csv import args validation", () => {
    test("carries exactly the privacy-boundary fields — labels, tree, consent, region", () => {
        expect(Object.keys(csvImportArgs).sort()).toStrictEqual(
            ["categoryTree", "groundedLookup", "labels", "regionCode"].sort()
        );
    });
});

describe("csvImport guard ladder", () => {
    test("returns unauthenticated for a signed-out caller", async () => {
        const t = convexTest(schema, modules);

        await expect(t.action(api.csvImport.csvImport, BASE_ARGS)).resolves.toStrictEqual({
            status: "unauthenticated",
            suggestions: null,
        });
    });

    test("returns notConfigured when XAI_API_KEY is unset, never throws", async () => {
        vi.stubEnv("XAI_API_KEY", "");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await expect(authenticatedAs(t, identity).action(api.csvImport.csvImport, BASE_ARGS)).resolves.toStrictEqual({
            status: "notConfigured",
            suggestions: null,
        });
    });

    test("returns invalid when there are no labels to classify", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await expect(
            authenticatedAs(t, identity).action(api.csvImport.csvImport, {
                ...BASE_ARGS,
                labels: [],
            })
        ).resolves.toStrictEqual({ status: "invalid", suggestions: null });
    });

    test("returns invalid when labels exceed the 200-label cap", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        await expect(
            authenticatedAs(t, identity).action(api.csvImport.csvImport, {
                ...BASE_ARGS,
                labels: Array.from({ length: 201 }, (_, i) => `Merchant ${i}`),
            })
        ).resolves.toStrictEqual({ status: "invalid", suggestions: null });
    });

    test("returns rateLimited and never throws once the per-user bucket is exhausted", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);
        const asUser = authenticatedAs(t, identity);
        const tokenIdentifier = await asUser.run(async (ctx) => (await ctx.auth.getUserIdentity())?.tokenIdentifier);
        if (!tokenIdentifier) {
            throw new Error("Expected an authenticated identity");
        }

        await t.run(async (ctx) =>
            rateLimiter.limit(ctx, "csvImportPerUser", {
                config: perUserLimitConfig(),
                count: 2,
                key: tokenIdentifier,
            })
        );

        await expect(asUser.action(api.csvImport.csvImport, BASE_ARGS)).resolves.toStrictEqual({
            status: "rateLimited",
            suggestions: null,
        });
    });

    test("returns rateLimited and never throws once the global window is exhausted", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        const limitSpy = vi
            .spyOn(rateLimiter, "limit")
            .mockImplementation(async (_ctx, name) =>
                name === "csvImportGlobal" ? { ok: false, retryAfter: 1000 } : { ok: true, retryAfter: undefined }
            );

        await expect(authenticatedAs(t, identity).action(api.csvImport.csvImport, BASE_ARGS)).resolves.toStrictEqual({
            status: "rateLimited",
            suggestions: null,
        });
        expect(limitSpy).toHaveBeenCalledWith(expect.anything(), "csvImportGlobal");
    });

    test("a revoked session skips the grounded tier and never rejects the action", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);
        await t.run((ctx) =>
            ctx.db.insert("merchantKnowledge", {
                categoryName: "Healthcare",
                domain: "farmaciasaas.com",
                emoji: null,
                key: "farmacia saas",
                modelId: "test-model",
                parentCategoryName: null,
                resolvedAt: Date.now(),
                tags: ["Pharmacy"],
            })
        );

        const stale = t.withIdentity({
            sessionId: "session-that-was-revoked",
            subject: identity.subject,
        });

        await expect(
            stale.action(api.csvImport.csvImport, {
                categoryTree: [{ children: [], name: "Healthcare" }],
                groundedLookup: true,
                labels: ["FARMACIA SAAS"],
            })
        ).resolves.toStrictEqual({
            status: "ok",
            suggestions: [
                {
                    categoryName: "Healthcare",
                    domain: "farmaciasaas.com",
                    label: "FARMACIA SAAS",
                },
            ],
        });
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });
});

describe(perUserLimitConfig, () => {
    test("defaults to a two-import burst when CSV_IMPORT_CAPACITY is unset", () => {
        vi.stubEnv("CSV_IMPORT_CAPACITY", undefined);

        expect(perUserLimitConfig().capacity).toBe(2);
    });

    test("honours a positive integer CSV_IMPORT_CAPACITY", () => {
        vi.stubEnv("CSV_IMPORT_CAPACITY", "25");

        expect(perUserLimitConfig().capacity).toBe(25);
    });

    test.each(["", "nonsense", "0", "-3", "2.5", "Infinity"])(
        "falls back to the default burst for the unusable value %j",
        (value) => {
            vi.stubEnv("CSV_IMPORT_CAPACITY", value);

            expect(perUserLimitConfig().capacity).toBe(2);
        }
    );

    test("leaves the refill rate alone, so only the burst is tunable", () => {
        vi.stubEnv("CSV_IMPORT_CAPACITY", "25");

        expect(perUserLimitConfig()).toStrictEqual({
            capacity: 25,
            kind: "token bucket",
            period: HOUR,
            rate: 6,
        });
    });

    test("reaches the per-user limit on every call, not once at module load", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        vi.stubEnv("CSV_IMPORT_CAPACITY", "25");
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);
        const limitSpy = vi.spyOn(rateLimiter, "limit").mockResolvedValue({ ok: false, retryAfter: 1000 });

        await expect(authenticatedAs(t, identity).action(api.csvImport.csvImport, BASE_ARGS)).resolves.toStrictEqual({
            status: "rateLimited",
            suggestions: null,
        });

        expect(limitSpy).toHaveBeenCalledWith(
            expect.anything(),
            "csvImportPerUser",
            expect.objectContaining({
                config: expect.objectContaining({ capacity: 25 }),
            })
        );
    });
});

async function scheduledGroundedRuns(t: ReturnType<typeof convexTest>) {
    const rows = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    return rows.filter((row) => row.name.includes("groundedLookup"));
}

function asIdentity(t: ReturnType<typeof convexTest>, identity: Awaited<ReturnType<typeof seedAuthUser>>) {
    return t.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.subject,
    });
}

describe(scheduleImportGrounded, () => {
    test("schedules one grounded run per label, deduped by merchant key", async () => {
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);

        const scheduled = await asIdentity(t, identity).run((ctx) =>
            scheduleImportGrounded(ctx, "token-import-a", {
                groundedLookup: true,
                labels: ["Corpoelec", "CORPOELEC!!", "Automercado Plaza's"],
                regionCode: "VE",
            })
        );

        expect(scheduled).toBe(2);
        const runs = await scheduledGroundedRuns(t);
        expect(runs).toHaveLength(2);
        const argsByKey = new Map(
            runs.map((run) => {
                const scheduledArgs = run.args[0] as Record<string, unknown>;
                return [scheduledArgs.key, scheduledArgs];
            })
        );
        expect(argsByKey.get(merchantKey("Corpoelec"))).toStrictEqual({
            income: false,
            key: "corpoelec",
            name: "Corpoelec",
            regionCode: "VE",
        });
        expect(argsByKey.get(merchantKey("Automercado Plaza's"))).toStrictEqual({
            income: false,
            key: "automercado plaza s",
            name: "Automercado Plaza's",
            regionCode: "VE",
        });
    });

    test("caps one import's grounded attempts at GROUNDED_IMPORT_MAX", async () => {
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);

        const labels = Array.from(
            { length: GROUNDED_IMPORT_MAX + 2 },
            (_, i) => `Unknown Merchant ${"x".repeat(i + 1)}`
        );
        const scheduled = await asIdentity(t, identity).run((ctx) =>
            scheduleImportGrounded(ctx, "token-import-b", {
                groundedLookup: true,
                labels,
            })
        );

        expect(scheduled).toBe(GROUNDED_IMPORT_MAX);
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(GROUNDED_IMPORT_MAX);
    });

    test("schedules nothing when the client consent flag is false", async () => {
        const t = convexTest(schema, modules);
        const identity = await seedAuthUser(t);

        const scheduled = await asIdentity(t, identity).run((ctx) =>
            scheduleImportGrounded(ctx, "token-import-c", {
                groundedLookup: false,
                labels: ["Corpoelec"],
            })
        );

        expect(scheduled).toBe(0);
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });

    test("schedules nothing when the synced appMeta consent row is false", async () => {
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

        const scheduled = await asIdentity(t, identity).run((ctx) =>
            scheduleImportGrounded(ctx, "token-import-d", {
                groundedLookup: true,
                labels: ["Corpoelec"],
            })
        );

        expect(scheduled).toBe(0);
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });

    test("returns 0 instead of throwing when the session no longer resolves to a user", async () => {
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);

        const stale = t.withIdentity({
            sessionId: "session-that-was-revoked",
            subject: identity.subject,
        });

        await expect(
            stale.run((ctx) =>
                scheduleImportGrounded(ctx, "token-import-e", {
                    groundedLookup: true,
                    labels: ["Corpoelec"],
                })
            )
        ).resolves.toBe(0);
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });
});

describe("merchantKnowledge tier", () => {
    test("answers a known label from merchantKnowledge with its stored domain, without the model", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);
        await t.run((ctx) =>
            ctx.db.insert("merchantKnowledge", {
                categoryName: "Healthcare",
                domain: "farmaciasaas.com",
                emoji: null,
                key: "farmacia saas",
                modelId: "test-model",
                parentCategoryName: null,
                resolvedAt: Date.now(),
                tags: ["Pharmacy"],
            })
        );

        await expect(
            authenticatedAs(t, identity).action(api.csvImport.csvImport, {
                categoryTree: [{ children: [], name: "Healthcare" }],
                labels: ["FARMACIA SAAS"],
            })
        ).resolves.toStrictEqual({
            status: "ok",
            suggestions: [
                {
                    categoryName: "Healthcare",
                    domain: "farmaciasaas.com",
                    label: "FARMACIA SAAS",
                },
            ],
        });
        await expect(scheduledGroundedRuns(t)).resolves.toHaveLength(0);
    });

    test("an unknown label schedules a grounded lookup even when the model tier fails", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    new Response('{"error":"unauthorized"}', {
                        headers: { "content-type": "application/json" },
                        status: 401,
                    })
            )
        );
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);

        const result = await authenticatedAs(t, identity).action(api.csvImport.csvImport, {
            categoryTree: [{ children: [], name: "Utilities" }],
            groundedLookup: true,
            labels: ["Corpoelec"],
            regionCode: "VE",
        });

        expect(result.status).toBe("providerError");
        const runs = await scheduledGroundedRuns(t);
        expect(runs).toHaveLength(1);
        expect((runs[0].args[0] as Record<string, unknown>).key).toBe("corpoelec");
    });

    test("keeps knowledge-tier suggestions when the model tier fails on a mixed batch", async () => {
        vi.stubEnv("XAI_API_KEY", "test-xai-key");
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    new Response('{"error":"unauthorized"}', {
                        headers: { "content-type": "application/json" },
                        status: 401,
                    })
            )
        );
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);
        await t.run((ctx) =>
            ctx.db.insert("merchantKnowledge", {
                categoryName: "Healthcare",
                domain: "farmaciasaas.com",
                emoji: null,
                key: "farmacia saas",
                modelId: "test-model",
                parentCategoryName: null,
                resolvedAt: Date.now(),
                tags: ["Pharmacy"],
            })
        );

        await expect(
            authenticatedAs(t, identity).action(api.csvImport.csvImport, {
                categoryTree: [{ children: [], name: "Healthcare" }],
                labels: ["FARMACIA SAAS", "Unknown Store"],
            })
        ).resolves.toStrictEqual({
            degraded: true,
            status: "ok",
            suggestions: [
                {
                    categoryName: "Healthcare",
                    domain: "farmaciasaas.com",
                    label: "FARMACIA SAAS",
                },
            ],
        });
    });
});

describe(classify, () => {
    test("returns ok with a suggestion for every label naming an existing category", async () => {
        const model = mockModel(
            JSON.stringify({
                mapping: [
                    { categoryName: "Coffee", label: "Coffee Shop" },
                    { categoryName: "Groceries", label: "Unknown Store" },
                ],
            })
        );

        await expect(
            classify(model, {
                categoryTree: BASE_ARGS.categoryTree,
                labels: BASE_ARGS.labels,
            })
        ).resolves.toStrictEqual({
            status: "ok",
            suggestions: [
                { categoryName: "Coffee", domain: null, label: "Coffee Shop" },
                { categoryName: "Groceries", domain: null, label: "Unknown Store" },
            ],
        });
    });

    test("drops only the label naming a category the user does not have, the rest still apply", async () => {
        const model = mockModel(
            JSON.stringify({
                mapping: [
                    { categoryName: "Coffee", label: "Coffee Shop" },
                    { categoryName: "Invented Category", label: "Unknown Store" },
                ],
            })
        );

        await expect(
            classify(model, {
                categoryTree: BASE_ARGS.categoryTree,
                labels: BASE_ARGS.labels,
            })
        ).resolves.toStrictEqual({
            status: "ok",
            suggestions: [{ categoryName: "Coffee", domain: null, label: "Coffee Shop" }],
        });
    });

    test("returns invalidResponse with an empty label array for schema-invalid JSON", async () => {
        const model = mockModel("this is not json at all");

        await expect(
            classify(model, {
                categoryTree: BASE_ARGS.categoryTree,
                labels: BASE_ARGS.labels,
            })
        ).resolves.toStrictEqual({
            status: "invalidResponse",
            suggestions: null,
        });
    });

    test("returns providerError, never throws, when the model rejects", async () => {
        const model = rejectingModel(new Error("network down"));

        await expect(
            classify(model, {
                categoryTree: BASE_ARGS.categoryTree,
                labels: BASE_ARGS.labels,
            })
        ).resolves.toStrictEqual({
            status: "providerError",
            suggestions: null,
        });
    });
});
