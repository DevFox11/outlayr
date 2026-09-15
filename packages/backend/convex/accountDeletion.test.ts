/// <reference types="vite/client" />

import revenuecatTest from "convex-revenuecat/test";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, components } from "./_generated/api";
import { consumeGoogleLocalReceipt } from "./accountDeletion";
import type { DeletionJob } from "./accountDeletion";
import { sha256Hex } from "./lib/sha256Hex";
import { isPro } from "./revenuecat";
import schema from "./schema";
import { authenticatedAs, grantPro, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

const secret = "a".repeat(43);

/**
 * Relative to the run, not an absolute instant. This fixture is the *unexpired*
 * job — the two tests that exercise expiry opt in with `expiresAt: 0` — so a
 * hardcoded date does not stay a fixture, it becomes the expired case on the day
 * it passes and takes every test sharing it down with it.
 */
const UNEXPIRED = Date.now() + 60 * 60 * 1000;

const job: DeletionJob = {
    errorCode: null,
    expiresAt: UNEXPIRED,
    googleReceiptChallengeHash: null,
    googleReceiptDigest: null,
    phase: "prepared",
    provider: null,
    secretHash: "hash",
    userId: "user-id",
};

describe("resumable account deletion", () => {
    test("hashes the raw secret", async () => {
        await expect(sha256Hex(secret)).resolves.not.toBe(secret);
    });

    test("rejects a Google local receipt bound to another deletion job", async () => {
        const receipt = "receipt-for-job-a";
        const jobA: DeletionJob = {
            ...job,
            googleReceiptChallengeHash: await sha256Hex(receipt),
            phase: "prepared",
        };
        const jobB: DeletionJob = {
            ...job,
            googleReceiptChallengeHash: await sha256Hex("receipt-for-job-b"),
            phase: "prepared",
        };

        await expect(consumeGoogleLocalReceipt(jobB, receipt)).rejects.toThrow("does not match");
        await expect(consumeGoogleLocalReceipt(jobA, receipt)).resolves.toMatchObject({
            phase: "providersRevoked",
            provider: "googleLocalReceipt",
        });
    });

    test("accepts one replay of the same Google local receipt without claiming provider attestation", async () => {
        const receipt = "receipt-for-job";
        const prepared: DeletionJob = {
            ...job,
            googleReceiptChallengeHash: await sha256Hex(receipt),
            phase: "prepared",
        };
        const consumed = await consumeGoogleLocalReceipt(prepared, receipt);

        expect(consumed.provider).toBe("googleLocalReceipt");
        expect(consumed.googleReceiptChallengeHash).toBeNull();
        expect(consumed.googleReceiptDigest).toBe(await sha256Hex(receipt));
        await expect(consumeGoogleLocalReceipt(consumed, receipt)).resolves.toBe(consumed);
    });
});

function stubUpstream(status: number) {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => new Response(null, { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

async function purgedJob() {
    const t = convexTest(schema, modules);
    revenuecatTest.register(t);
    const owner = await seedAuthUser(t);
    await grantPro(t, owner);
    const { resumeSecret } = await authenticatedAs(t, owner).mutation(api.accountDeletion.prepare, {});
    await t.mutation(api.accountDeletion.recordAppleRevocation, { resumeSecret });
    await expect(t.mutation(api.accountDeletion.advance, { resumeSecret })).resolves.toMatchObject({ phase: "purged" });
    return { owner, resumeSecret, t };
}

describe("billing erasure", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("erases upstream first, then the mirror, and only then lets auth deletion proceed", async () => {
        const fetchMock = stubUpstream(200);
        const { owner, resumeSecret, t } = await purgedJob();
        await expect(t.mutation(api.accountDeletion.advance, { resumeSecret })).rejects.toThrow("Billing erasure");
        await expect(t.run((ctx) => isPro(ctx, owner.userId))).resolves.toBeTruthy();

        await expect(t.action(api.accountDeletion.eraseBilling, { resumeSecret })).resolves.toMatchObject({
            phase: "billingErased",
        });

        expect(fetchMock).toHaveBeenCalledWith(
            `https://api.revenuecat.com/v1/subscribers/${owner.userId}`,
            expect.objectContaining({ method: "DELETE" })
        );
        await expect(t.run((ctx) => isPro(ctx, owner.userId))).resolves.toBeFalsy();
        await expect(t.mutation(api.accountDeletion.advance, { resumeSecret })).resolves.toMatchObject({
            phase: "authDeleting",
        });
    });

    test("keeps the job at purged, mirror intact, when the upstream erase fails", async () => {
        stubUpstream(500);
        const { owner, resumeSecret, t } = await purgedJob();

        await expect(t.action(api.accountDeletion.eraseBilling, { resumeSecret })).rejects.toThrow("500");

        await expect(t.query(api.accountDeletion.poll, { resumeSecret })).resolves.toMatchObject({ phase: "purged" });
        await expect(t.run((ctx) => isPro(ctx, owner.userId))).resolves.toBeTruthy();
    });
});

/** Backdates a job's TTL, the way an abandoned deletion ages out. */
async function expire(t: TestConvex<typeof schema>, resumeSecret: string) {
    const secretHash = await sha256Hex(resumeSecret);
    await t.run(async (ctx) => {
        const row = await ctx.db
            .query("accountDeletionJobs")
            .withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash))
            .unique();
        if (row) {
            await ctx.db.patch(row._id, { expiresAt: 0 });
        }
    });
}

describe("an abandoned deletion past its TTL", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("still finishes, because the ledger is already gone", async () => {
        stubUpstream(200);
        const { owner, resumeSecret, t } = await purgedJob();
        // A big ledger takes 200 rows per `advance`, so the user can lose
        // connectivity mid-purge and come back a day later. By then the entries
        // are hard-deleted and nothing can put them back.
        await expire(t, resumeSecret);

        await expect(t.query(api.accountDeletion.poll, { resumeSecret })).resolves.toMatchObject({
            phase: "purged",
        });
        await expect(t.action(api.accountDeletion.eraseBilling, { resumeSecret })).resolves.toMatchObject({
            phase: "billingErased",
        });
        await t.mutation(api.accountDeletion.advance, { resumeSecret });
        await expect(t.mutation(api.accountDeletion.advance, { resumeSecret })).resolves.toMatchObject({
            phase: "complete",
        });
        await expect(authRows(t, "user", owner.userId)).resolves.toHaveLength(0);
    });

    test("still refuses to START destroying without fresh reauthentication", async () => {
        const t = convexTest(schema, modules);
        revenuecatTest.register(t);
        const owner = await seedAuthUser(t);
        await grantPro(t, owner);
        const { resumeSecret } = await authenticatedAs(t, owner).mutation(api.accountDeletion.prepare, {});
        await expire(t, resumeSecret);

        await expect(t.mutation(api.accountDeletion.recordAppleRevocation, { resumeSecret })).rejects.toThrow(
            "expired"
        );
    });
});

interface AuthRow {
    _id: string;
    userId?: string;
}

function authRows(t: TestConvex<typeof schema>, model: "account" | "session" | "user", userId: string) {
    return t.run(async (ctx) => {
        const page = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model,
            paginationOpts: { cursor: null, numItems: 100 },
            where: [{ field: model === "user" ? "_id" : "userId", operator: "eq", value: userId }],
        })) as { page: AuthRow[] };
        return page.page;
    });
}

async function linkAppleAccount(t: TestConvex<typeof schema>, userId: string) {
    const now = Date.now();
    await t.run((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
            input: {
                data: {
                    accessToken: "apple-access-token",
                    accountId: "apple-subject",
                    createdAt: now,
                    providerId: "apple",
                    refreshToken: "apple-refresh-token",
                    updatedAt: now,
                    userId,
                },
                model: "account",
            },
        })
    );
}

describe("auth deletion", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("erases the user, its sessions and its OAuth links, then reports complete", async () => {
        stubUpstream(200);
        const { owner, resumeSecret, t } = await purgedJob();
        await linkAppleAccount(t, owner.userId);
        await t.action(api.accountDeletion.eraseBilling, { resumeSecret });
        await expect(t.mutation(api.accountDeletion.advance, { resumeSecret })).resolves.toMatchObject({
            phase: "authDeleting",
        });

        await expect(t.mutation(api.accountDeletion.advance, { resumeSecret })).resolves.toMatchObject({
            phase: "complete",
        });

        await expect(authRows(t, "user", owner.userId)).resolves.toHaveLength(0);
        await expect(authRows(t, "session", owner.userId)).resolves.toHaveLength(0);
        await expect(authRows(t, "account", owner.userId)).resolves.toHaveLength(0);
        await expect(t.query(api.accountDeletion.poll, { resumeSecret })).resolves.toMatchObject({
            phase: "complete",
        });
    });
});
