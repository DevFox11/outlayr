/// <reference types="vite/client" />

import revenuecatTest from "convex-revenuecat/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { advanceDeletion, consumeGoogleLocalReceipt, hashResumeSecret } from "./accountDeletion";
import type { DeletionJob } from "./accountDeletion";
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
    test("revocation-failure-keeps-deletion-incomplete-and-retryable", async () => {
        await expect(
            advanceDeletion(job, {
                deleteAuth: async () => undefined,
                eraseBilling: async () => undefined,
                purge: async () => true,
                revoke: async () => {
                    throw new Error("offline");
                },
            })
        ).rejects.toThrow("offline");
        expect(job.phase).toBe("prepared");
    });

    test("apple-revoke-precedes-purge", async () => {
        const calls: string[] = [];
        await advanceDeletion(job, {
            deleteAuth: async () => {
                calls.push("delete");
            },
            eraseBilling: async () => {
                calls.push("erase");
            },
            purge: async () => {
                calls.push("purge");
                return true;
            },
            revoke: async () => {
                calls.push("revoke");
            },
        });
        expect(calls).toStrictEqual(["revoke", "purge", "erase"]);
    });

    test("google-revoke-precedes-delete and purge-requires-revocation", async () => {
        const calls: string[] = [];
        await expect(
            advanceDeletion(
                { ...job, phase: "prepared" },
                {
                    deleteAuth: async () => {
                        calls.push("delete");
                    },
                    eraseBilling: async () => {
                        calls.push("erase");
                    },
                    purge: async () => {
                        calls.push("purge");
                        return true;
                    },
                    revoke: async () => {
                        calls.push("google-revoke");
                    },
                }
            )
        ).resolves.toMatchObject({ phase: "authDeleting" });
        expect(calls).toStrictEqual(["google-revoke", "purge", "erase"]);
    });

    test("deletion-job-resumes-lost-response-without-identity", async () => {
        const calls: string[] = [];
        const authDeleting = { ...job, phase: "authDeleting" as const };
        await expect(
            advanceDeletion(authDeleting, {
                deleteAuth: async () => {
                    calls.push("delete");
                },
                eraseBilling: async () => undefined,
                purge: async () => true,
                revoke: async () => undefined,
            })
        ).resolves.toMatchObject({ phase: "complete", userId: null });
        expect(calls).toStrictEqual(["delete"]);
    });

    test("expiry-after-providersRevoked-fails-closed-before-purge", async () => {
        const purge = vi.fn(async () => true);
        await expect(
            advanceDeletion(
                { ...job, expiresAt: 0, phase: "providersRevoked", provider: "appleServerRevoked" },
                {
                    deleteAuth: async () => undefined,
                    eraseBilling: async () => undefined,
                    purge,
                    revoke: async () => undefined,
                }
            )
        ).rejects.toThrow("expired");
        expect(purge).not.toHaveBeenCalled();
    });

    test("expiry-after-purge-fails-closed-before-auth-deletion", async () => {
        const deleteAuth = vi.fn(async () => undefined);
        await expect(
            advanceDeletion(
                { ...job, expiresAt: 0, phase: "purged", provider: "appleServerRevoked" },
                {
                    deleteAuth,
                    eraseBilling: async () => undefined,
                    purge: async () => true,
                    revoke: async () => undefined,
                }
            )
        ).rejects.toThrow("expired");
        expect(deleteAuth).not.toHaveBeenCalled();
    });

    test("hashes the raw secret and accepts idempotent complete replay", async () => {
        await expect(hashResumeSecret(secret)).resolves.not.toBe(secret);
        await expect(
            advanceDeletion(
                { ...job, phase: "complete", userId: null },
                {
                    deleteAuth: async () => {
                        throw new Error("must not delete twice");
                    },
                    eraseBilling: async () => undefined,
                    purge: async () => true,
                    revoke: async () => undefined,
                }
            )
        ).resolves.toMatchObject({ phase: "complete" });
    });

    test("rejects a Google local receipt bound to another deletion job", async () => {
        const receipt = "receipt-for-job-a";
        const jobA: DeletionJob = {
            ...job,
            googleReceiptChallengeHash: await hashResumeSecret(receipt),
            phase: "prepared",
        };
        const jobB: DeletionJob = {
            ...job,
            googleReceiptChallengeHash: await hashResumeSecret("receipt-for-job-b"),
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
            googleReceiptChallengeHash: await hashResumeSecret(receipt),
            phase: "prepared",
        };
        const consumed = await consumeGoogleLocalReceipt(prepared, receipt);

        expect(consumed.provider).toBe("googleLocalReceipt");
        expect(consumed.googleReceiptChallengeHash).toBeNull();
        expect(consumed.googleReceiptDigest).toBe(await hashResumeSecret(receipt));
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
