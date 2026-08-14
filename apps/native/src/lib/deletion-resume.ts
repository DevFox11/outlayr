import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

import { resumeCloudDeletion } from "./account-lifecycle";
import type { DeletionPreparation } from "./account-lifecycle";
import { authClient } from "./auth-client";
import { convex } from "./convex";
import { persistGoogleLocalReceiptAfterRevocation, revokeGoogleProviderSubject } from "./provider-revocation";

export const deletionResumeSecretKey = "outlayr.account-deletion-resume";

type DeletionPhase = "authDeleting" | "complete" | "prepared" | "providersRevoked" | "purged";

export interface StoredDeletionPreparation extends DeletionPreparation {
    provider: "apple" | "google";
    providerSubject: string;
}

function recoveryError(): Error {
    return new Error("Cloud deletion recovery requires reauthentication");
}

function parsePreparation(raw: string): StoredDeletionPreparation | null {
    try {
        const value: unknown = JSON.parse(raw);
        if (
            typeof value === "object" &&
            value !== null &&
            ((value as StoredDeletionPreparation).provider === "apple" ||
                (value as StoredDeletionPreparation).provider === "google") &&
            typeof (value as StoredDeletionPreparation).providerSubject === "string" &&
            typeof (value as StoredDeletionPreparation).receiptChallenge === "string" &&
            typeof (value as StoredDeletionPreparation).resumeSecret === "string"
        ) {
            return value as StoredDeletionPreparation;
        }
    } catch {
        return null;
    }
    return null;
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
        await convex.mutation(
            "accountDeletion:submitGoogleLocalReceipt" as never,
            { receiptChallenge: preparation.receiptChallenge, resumeSecret: preparation.resumeSecret } as never
        );
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
    await convex.mutation(
        "accountDeletion:recordAppleRevocation" as never,
        { resumeSecret: preparation.resumeSecret } as never
    );
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
    const deletionClient = convex;
    const raw = await getItemAsync(deletionResumeSecretKey);
    const preparation = raw === null ? null : parsePreparation(raw);
    if (preparation === null) {
        if (required) {
            throw recoveryError();
        }
        return false;
    }
    const poll = async (): Promise<{ phase: DeletionPhase } | null> =>
        (await deletionClient.query(
            "accountDeletion:poll" as never,
            { resumeSecret: preparation.resumeSecret } as never
        )) as { phase: DeletionPhase } | null;
    const status = await poll();
    if (status === null) {
        throw recoveryError();
    }
    if (status.phase !== "complete") {
        await resumeCloudDeletion(status.phase, preparation, {
            advanceDeletion: async (resumeSecret) =>
                (await deletionClient.mutation("accountDeletion:advance" as never, { resumeSecret } as never)) as {
                    phase: DeletionPhase;
                },
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
