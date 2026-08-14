import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import { z } from "zod";

import { resumeCloudDeletion } from "./account-lifecycle";
import type { DeletionPreparation } from "./account-lifecycle";
import { authClient } from "./auth-client";
import { cloudMutation, cloudQuery, convex } from "./convex";
import { persistGoogleLocalReceiptAfterRevocation, revokeGoogleProviderSubject } from "./provider-revocation";

export const deletionResumeSecretKey = "outlayr.account-deletion-resume";

type DeletionPhase = "authDeleting" | "complete" | "prepared" | "providersRevoked" | "purged";

/** How far `accountDeletion` has got, as its `poll` and `advance` report it. */
interface DeletionStatus {
    phase: DeletionPhase;
}

export interface StoredDeletionPreparation extends DeletionPreparation {
    provider: "apple" | "google";
    providerSubject: string;
}

function recoveryError(): Error {
    return new Error("Cloud deletion recovery requires reauthentication");
}

/**
 * What the keychain has to hold for a half-finished deletion to be resumable.
 *
 * Loose rather than strict: `resumeProviderRevocation` writes the record back
 * with a `googleLocalReceipt` added, so a stored blob legitimately carries more
 * than this, and rejecting it would strand the deletion it was written to
 * survive.
 */
const storedPreparation = z.looseObject({
    provider: z.enum(["apple", "google"]),
    providerSubject: z.string(),
    receiptChallenge: z.string(),
    resumeSecret: z.string(),
});

function parsePreparation(raw: string): StoredDeletionPreparation | null {
    try {
        const parsed = storedPreparation.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

export async function resumeProviderRevocation(preparation: StoredDeletionPreparation): Promise<void> {
    if (convex === null) {
        throw recoveryError();
    }
    if (preparation.provider === "google") {
        await persistGoogleLocalReceiptAfterRevocation(
            async () => await revokeGoogleProviderSubject(preparation.providerSubject),
            async () =>
                await setItemAsync(
                    deletionResumeSecretKey,
                    JSON.stringify({ ...preparation, googleLocalReceipt: preparation.receiptChallenge })
                )
        );
        await cloudMutation("accountDeletion:submitGoogleLocalReceipt", {
            receiptChallenge: preparation.receiptChallenge,
            resumeSecret: preparation.resumeSecret,
        });
        return;
    }
    if (authClient === null) {
        throw recoveryError();
    }
    const response = await authClient.$fetch("/apple/revoke", {
        body: { resumeSecret: preparation.resumeSecret },
        method: "POST",
    });
    if (response.error) {
        throw new Error("Apple provider revocation failed");
    }
    await cloudMutation("accountDeletion:recordAppleRevocation", { resumeSecret: preparation.resumeSecret });
}

export async function resumePersistedCloudDeletion({
    clearOnComplete = true,
    required = false,
}: {
    clearOnComplete?: boolean;
    required?: boolean;
} = {}): Promise<boolean> {
    if (convex === null) {
        if (required) {
            throw recoveryError();
        }
        return false;
    }
    const raw = await getItemAsync(deletionResumeSecretKey);
    const preparation = raw === null ? null : parsePreparation(raw);
    if (preparation === null) {
        if (required) {
            throw recoveryError();
        }
        return false;
    }
    const poll = async (): Promise<DeletionStatus | null> =>
        await cloudQuery("accountDeletion:poll", { resumeSecret: preparation.resumeSecret });
    const status = await poll();
    if (status === null) {
        throw recoveryError();
    }
    if (status.phase !== "complete") {
        await resumeCloudDeletion(status.phase, preparation, {
            advanceDeletion: async (resumeSecret) => await cloudMutation("accountDeletion:advance", { resumeSecret }),
            revokeProvider: async () => await resumeProviderRevocation(preparation),
        });
        const completed = await poll();
        if (completed?.phase !== "complete") {
            throw recoveryError();
        }
    }
    if (clearOnComplete) {
        await deleteItemAsync(deletionResumeSecretKey);
    }
    return true;
}
