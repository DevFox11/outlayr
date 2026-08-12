import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation, internalQuery, type MutationCtx, mutation, query } from "./_generated/server";
import { purgeUserBatch } from "./account";
import { requireUserId } from "./lib/auth";

const DELETE_JOB_TTL_MS = 24 * 60 * 60 * 1000;

type DeletionProvider = "appleServerRevoked" | "googleLocalReceipt" | null;
export type DeletionPhase = "prepared" | "providersRevoked" | "purged" | "authDeleting" | "complete";

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

export function requireUnexpiredDeletionJob(job: DeletionJob): void {
	if (job.phase !== "complete" && job.expiresAt <= Date.now()) {
		throw new ConvexError("Deletion job expired; reauthentication is required");
	}
}

export async function hashResumeSecret(secret: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

export async function consumeGoogleLocalReceipt(job: DeletionJob, receiptChallenge: string): Promise<DeletionJob> {
	const receiptDigest = await hashResumeSecret(receiptChallenge);
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

export async function advanceDeletion(
	job: DeletionJob,
	deps: { deleteAuth: () => Promise<void>; purge: () => Promise<boolean>; revoke: () => Promise<void> }
): Promise<DeletionJob> {
	requireUnexpiredDeletionJob(job);
	if (job.phase === "complete") {
		return job;
	}
	if (job.phase === "prepared") {
		await deps.revoke();
		job.phase = "providersRevoked";
	}
	if (job.phase === "providersRevoked") {
		if (!(await deps.purge())) {
			return job;
		}
		job.phase = "purged";
	}
	if (job.phase === "purged") {
		job.phase = "authDeleting";
		return job;
	}
	if (job.phase === "authDeleting") {
		await deps.deleteAuth();
		job.phase = "complete";
		job.userId = null;
	}
	return job;
}

async function jobForSecret(ctx: MutationCtx, secret: string) {
	const secretHash = await hashResumeSecret(secret);
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

export const prepare = mutation({
	args: {},
	handler: async (ctx) => {
		const receiptChallenge = randomSecret();
		const resumeSecret = randomSecret();
		await ctx.db.insert("accountDeletionJobs", {
			errorCode: null,
			expiresAt: Date.now() + DELETE_JOB_TTL_MS,
			googleReceiptChallengeHash: await hashResumeSecret(receiptChallenge),
			googleReceiptDigest: null,
			phase: "prepared",
			provider: null,
			secretHash: await hashResumeSecret(resumeSecret),
			userId: await requireUserId(ctx),
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
			await ctx.db.patch(job._id, { phase: "authDeleting" });
			return publicStatus({ ...job, phase: "authDeleting" });
		}
		try {
			await ctx.runMutation(
				components.betterAuth.adapter.deleteOne as never,
				{
					input: { model: "user", where: [{ field: "_id", operator: "eq", value: job.userId }] },
				} as never
			);
		} finally {
			await ctx.runMutation(
				components.betterAuth.adapter.deleteMany as never,
				{
					input: { model: "session", where: [{ field: "userId", operator: "eq", value: job.userId }] },
					paginationOpts: {},
				} as never
			);
		}
		await ctx.db.patch(job._id, { phase: "complete", userId: null });
		return { errorCode: null, phase: "complete" as const };
	},
});

export const poll = query({
	args: { resumeSecret: v.string() },
	handler: async (ctx, args) => {
		const secretHash = await hashResumeSecret(args.resumeSecret);
		const job = await ctx.db
			.query("accountDeletionJobs")
			.withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash))
			.unique();
		if (!job || (job.phase !== "complete" && job.expiresAt <= Date.now())) {
			return null;
		}
		return publicStatus(job);
	},
});

export const resumeUserId = internalQuery({
	args: { resumeSecret: v.string() },
	handler: async (ctx, args) => {
		const secretHash = await hashResumeSecret(args.resumeSecret);
		const job = await ctx.db
			.query("accountDeletionJobs")
			.withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash))
			.unique();
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

export const cleanupExpired = internalMutation({
	args: {},
	handler: async (ctx) => {
		const jobs = await ctx.db
			.query("accountDeletionJobs")
			.withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
			.collect();
		await Promise.all(
			jobs
				.filter((job) => job.phase === "prepared" || job.phase === "complete")
				.map(async (job) => await ctx.db.delete(job._id))
		);
	},
});
