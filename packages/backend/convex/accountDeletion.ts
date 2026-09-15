import { env } from "@outlayr/env/backend";
import { ConvexError, v } from "convex/values";

import { components, internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { purgeUserBatch } from "./account";
import { requireUserId } from "./lib/auth";
import { sha256Hex } from "./lib/sha256Hex";
import { eraseUpstreamCustomer, revenuecat } from "./revenuecat";

const DELETE_JOB_TTL_MS = 24 * 60 * 60 * 1000;
const AUTH_DELETE_PAGE = 100;

type DeletionProvider = "appleServerRevoked" | "googleLocalReceipt" | null;
export type DeletionPhase = "prepared" | "providersRevoked" | "purged" | "billingErased" | "authDeleting" | "complete";

export interface DeletionJob {
    errorCode: string | null;
    expiresAt: number;
    googleReceiptChallengeHash: string | null;
    googleReceiptDigest: string | null;
    phase: DeletionPhase;
    provider: DeletionProvider;
    secretHash: string;
    userId: string | null;
}

/**
 * The TTL gates the authorisation to START destroying, not the destruction.
 *
 * Only `prepared` still has anything to re-authenticate for. Past it the
 * provider is revoked and the ledger is being hard-deleted a batch at a time,
 * and a large one takes many round trips — so a device that goes offline
 * mid-purge and returns a day later must be allowed to finish. Refusing left the
 * entries gone, the account and its sessions live, and the subscription still
 * billing, with no path forward: `cleanupExpired` sweeps only `prepared` and
 * `complete`, so the job survived forever carrying the `userId` this whole flow
 * exists to destroy.
 */
export function requireUnexpiredDeletionJob(job: DeletionJob, at: number = Date.now()): void {
    if (job.phase === "prepared" && job.expiresAt <= at) {
        throw new ConvexError("Deletion job expired; reauthentication is required");
    }
}

function randomSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCodePoint(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
}

export async function consumeGoogleLocalReceipt(job: DeletionJob, receiptChallenge: string): Promise<DeletionJob> {
    const receiptDigest = await sha256Hex(receiptChallenge);
    if (job.phase === "providersRevoked" && job.provider === "googleLocalReceipt") {
        if (receiptDigest !== job.googleReceiptDigest) {
            throw new Error("Google local receipt does not match this deletion job");
        }
        return job;
    }
    if (job.phase !== "prepared" || !job.googleReceiptChallengeHash) {
        throw new Error("Google local receipt cannot be accepted for this deletion job");
    }
    if (receiptDigest !== job.googleReceiptChallengeHash) {
        throw new Error("Google local receipt does not match this deletion job");
    }
    return {
        ...job,
        googleReceiptChallengeHash: null,
        googleReceiptDigest: receiptDigest,
        phase: "providersRevoked",
        provider: "googleLocalReceipt",
    };
}

async function jobForSecret(ctx: QueryCtx, secret: string) {
    const secretHash = await sha256Hex(secret);
    return ctx.db
        .query("accountDeletionJobs")
        .withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash))
        .unique();
}

function publicStatus(job: { errorCode: string | null; phase: DeletionPhase }) {
    return { errorCode: job.errorCode, phase: job.phase };
}

function requireUnexpiredPreparedJob(job: DeletionJob) {
    requireUnexpiredDeletionJob(job);
    if (job.phase !== "prepared") {
        throw new ConvexError("Deletion job cannot revoke providers now");
    }
}

/**
 * How many open deletion jobs one account may hold.
 *
 * A user can genuinely prepare more than one — a lost resume secret, a second
 * device, a retried flow — but never many. The cap is what makes that true:
 * `sync.refuseWhileDeleting` reads a user's jobs to decide whether a push is
 * landing on an account mid-purge, and an uncapped table would let a client
 * bury the one job that says so under any number of harmless `prepared` ones.
 */
export const DELETION_JOBS_PER_USER = 20;

export const prepare = mutation({
    args: {},
    handler: async (ctx) => {
        if (!env.REVENUECAT_SECRET_KEY) {
            throw new ConvexError("Account deletion needs REVENUECAT_SECRET_KEY before it can erase billing");
        }
        const userId = await requireUserId(ctx);
        const open = await ctx.db
            .query("accountDeletionJobs")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .take(DELETION_JOBS_PER_USER);
        if (open.length >= DELETION_JOBS_PER_USER) {
            throw new ConvexError("This account already has too many open deletion requests");
        }
        const receiptChallenge = randomSecret();
        const resumeSecret = randomSecret();
        await ctx.db.insert("accountDeletionJobs", {
            errorCode: null,
            expiresAt: Date.now() + DELETE_JOB_TTL_MS,
            googleReceiptChallengeHash: await sha256Hex(receiptChallenge),
            googleReceiptDigest: null,
            phase: "prepared",
            provider: null,
            secretHash: await sha256Hex(resumeSecret),
            userId,
        });
        return { receiptChallenge, resumeSecret };
    },
});

export const submitGoogleLocalReceipt = mutation({
    args: { receiptChallenge: v.string(), resumeSecret: v.string() },
    handler: async (ctx, args) => {
        const job = await jobForSecret(ctx, args.resumeSecret);
        if (!job) {
            throw new ConvexError("Deletion job not found");
        }
        requireUnexpiredDeletionJob(job);
        if (job.phase === "providersRevoked" && job.provider === "googleLocalReceipt") {
            await consumeGoogleLocalReceipt(job, args.receiptChallenge);
            return publicStatus(job);
        }
        requireUnexpiredPreparedJob(job);
        const consumed = await consumeGoogleLocalReceipt(job, args.receiptChallenge);
        await ctx.db.patch(job._id, {
            googleReceiptChallengeHash: null,
            googleReceiptDigest: consumed.googleReceiptDigest,
            phase: consumed.phase,
            provider: consumed.provider,
        });
        return publicStatus(consumed);
    },
});

export const recordAppleRevocation = mutation({
    args: { resumeSecret: v.string() },
    handler: async (ctx, args) => {
        const job = await jobForSecret(ctx, args.resumeSecret);
        if (!job) {
            throw new ConvexError("Deletion job not found");
        }
        requireUnexpiredDeletionJob(job);
        if (job.phase === "providersRevoked" && job.provider === "appleServerRevoked") {
            return publicStatus(job);
        }
        requireUnexpiredPreparedJob(job);
        await ctx.db.patch(job._id, { phase: "providersRevoked", provider: "appleServerRevoked" });
        return publicStatus({ ...job, phase: "providersRevoked" });
    },
});

/**
 * Removes every row Better Auth holds for a user in one table. Its own user
 * cascade is off (`auth.ts` disables `deleteUser`), so `session` — and `account`,
 * which carries the provider subject and its OAuth tokens — are this flow's to
 * delete. `deleteMany` deletes a single page per call, so the cursor has to be
 * followed to the end or the rest survive the erasure.
 */
async function deleteAuthRows(ctx: MutationCtx, model: "account" | "session", userId: string): Promise<void> {
    let cursor: string | null = null;
    let done = false;
    /* oxlint-disable no-await-in-loop -- each page's cursor is the next request's argument */
    while (!done) {
        // SAFETY: as in the `deleteOne` call in `advance`.
        const page = (await ctx.runMutation(
            components.betterAuth.adapter.deleteMany as never,
            {
                input: { model, where: [{ field: "userId", operator: "eq", value: userId }] },
                paginationOpts: { cursor, numItems: AUTH_DELETE_PAGE },
            } as never
        )) as { continueCursor: string; isDone: boolean };
        done = page.isDone;
        cursor = page.continueCursor;
    }
    /* oxlint-enable no-await-in-loop */
}

export const advance = mutation({
    args: { resumeSecret: v.string() },
    handler: async (ctx, args) => {
        const job = await jobForSecret(ctx, args.resumeSecret);
        if (!job) {
            throw new ConvexError("Deletion job not found");
        }
        if (job.phase === "complete") {
            return publicStatus(job);
        }
        requireUnexpiredDeletionJob(job);
        if (job.phase === "prepared" || job.provider === null) {
            throw new ConvexError("Provider revocation is required before purge");
        }
        if (!job.userId) {
            throw new ConvexError("Deletion job is missing its private user linkage");
        }
        if (job.phase === "providersRevoked") {
            const result = await purgeUserBatch(ctx, job.userId);
            if (!result.done) {
                return publicStatus(job);
            }
            await ctx.db.patch(job._id, { phase: "purged" });
            return publicStatus({ ...job, phase: "purged" });
        }
        if (job.phase === "purged") {
            throw new ConvexError("Billing erasure is required before auth deletion");
        }
        if (job.phase === "billingErased") {
            await ctx.db.patch(job._id, { phase: "authDeleting" });
            return publicStatus({ ...job, phase: "authDeleting" });
        }
        await deleteAuthRows(ctx, "session", job.userId);
        await deleteAuthRows(ctx, "account", job.userId);
        // SAFETY: the better-auth component types its mutation references
        // against its own generated api, which this app does not import. The
        // `input` shape below is the adapter's documented one.
        await ctx.runMutation(
            components.betterAuth.adapter.deleteOne as never,
            {
                input: { model: "user", where: [{ field: "_id", operator: "eq", value: job.userId }] },
            } as never
        );
        await ctx.db.patch(job._id, { phase: "complete", userId: null });
        return { errorCode: null, phase: "complete" as const };
    },
});

export const billingTarget = internalQuery({
    args: { resumeSecret: v.string() },
    handler: async (ctx, args) => {
        const job = await jobForSecret(ctx, args.resumeSecret);
        if (!job) {
            throw new ConvexError("Deletion job not found");
        }
        requireUnexpiredDeletionJob(job);
        if (job.phase === "providersRevoked" || job.phase === "prepared") {
            throw new ConvexError("Purge is required before billing erasure");
        }
        return job.phase === "purged" ? job.userId : null;
    },
});

export const recordBillingErased = internalMutation({
    args: { resumeSecret: v.string() },
    handler: async (ctx, args) => {
        const job = await jobForSecret(ctx, args.resumeSecret);
        if (!job) {
            throw new ConvexError("Deletion job not found");
        }
        requireUnexpiredDeletionJob(job);
        if (job.phase !== "purged") {
            return publicStatus(job);
        }
        if (!job.userId) {
            throw new ConvexError("Deletion job is missing its private user linkage");
        }
        await revenuecat.deleteCustomer(ctx, { appUserId: job.userId });
        await ctx.db.patch(job._id, { phase: "billingErased" });
        return publicStatus({ ...job, phase: "billingErased" });
    },
});

export const eraseBilling = action({
    args: { resumeSecret: v.string() },
    handler: async (ctx, args): Promise<{ errorCode: string | null; phase: DeletionPhase }> => {
        const appUserId = await ctx.runQuery(internal.accountDeletion.billingTarget, args);
        if (appUserId !== null) {
            await eraseUpstreamCustomer(appUserId);
        }
        return await ctx.runMutation(internal.accountDeletion.recordBillingErased, args);
    },
});

export const poll = query({
    args: { at: v.optional(v.number()), resumeSecret: v.string() },
    handler: async (ctx, args) => {
        const job = await jobForSecret(ctx, args.resumeSecret);
        if (!job) {
            return null;
        }
        // `at` rather than the wall clock: nothing writes the job when it merely
        // expires, so a subscribed caller would go on being told the old phase.
        if (job.phase === "prepared" && job.expiresAt <= (args.at ?? Date.now())) {
            return null;
        }
        return publicStatus(job);
    },
});

export const resumeUserId = internalQuery({
    args: { resumeSecret: v.string() },
    handler: async (ctx, args) => {
        const job = await jobForSecret(ctx, args.resumeSecret);
        if (!job) {
            throw new ConvexError("Deletion job cannot revoke Apple credentials now");
        }
        requireUnexpiredDeletionJob(job);
        if (job.phase !== "prepared" || !job.userId) {
            throw new ConvexError("Deletion job cannot revoke Apple credentials now");
        }
        return job.userId;
    },
});

const CLEANUP_BATCH = 200;

/**
 * ⚠️ `sync.push` refuses every write while ANY job of this user is past
 * `prepared`, so a job that is abandoned there locks the account out of writing
 * forever: nothing advances it, there is no cancel, and `prepare` caps a user at
 * 20 jobs so they cannot even start a fresh deletion.
 *
 * `googleLocalReceipt` is the phase that gets there having destroyed nothing —
 * it is reached by proving possession of a challenge `prepare` itself just
 * handed the client, before anything upstream is revoked. So its `expiresAt`
 * means what it says and the job can be reclaimed.
 *
 * `appleServerRevoked` is NOT swept: that one really has revoked the user's
 * Apple credential, and a job describing an irreversible step is not garbage.
 * The other phases are mid-purge and must finish.
 */
export const cleanupExpired = internalMutation({
    args: {},
    handler: async (ctx) => {
        const jobs = await ctx.db
            .query("accountDeletionJobs")
            .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
            .filter((q) =>
                q.or(
                    q.eq(q.field("phase"), "prepared"),
                    q.eq(q.field("phase"), "complete"),
                    q.and(q.eq(q.field("phase"), "providersRevoked"), q.eq(q.field("provider"), "googleLocalReceipt"))
                )
            )
            .take(CLEANUP_BATCH);
        await Promise.all(jobs.map(async (job) => await ctx.db.delete(job._id)));
    },
});
