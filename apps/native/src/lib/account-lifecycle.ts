export type AccountLifecycleAction = "deleteAll" | "deleteCloud" | "signOut";
type AccountLifecycleStage = "deleteAccount" | "resetDevice" | "revokeProvider" | "signOut";

type DeletionPhase = "authDeleting" | "complete" | "prepared" | "providersRevoked" | "purged";

export interface DeletionPreparation {
    provider?: "apple" | "google";
    providerSubject?: string;
    receiptChallenge: string;
    resumeSecret: string;
}

export interface AccountLifecycleDependencies {
    advanceDeletion?: (resumeSecret: string) => Promise<{ phase: DeletionPhase }>;
    allowLocal: () => void;
    beginDeviceReset?: () => Promise<void>;
    clearDeletionSecret?: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    markDeviceCleanupReady?: () => Promise<void>;
    navigateToLedger: () => void;
    navigateToOnboarding?: () => void;
    persistDeletionSecret?: (preparation: DeletionPreparation) => Promise<void>;
    prepareDeletion?: () => Promise<DeletionPreparation>;
    quiesce: () => Promise<void>;
    resetDevice?: () => Promise<{ failures: readonly string[] }>;
    revokeProvider?: (preparation: DeletionPreparation) => Promise<void>;
    signOut?: () => Promise<void>;
}

class AccountLifecycleError extends Error {
    readonly stage: AccountLifecycleStage;

    constructor(stage: AccountLifecycleStage, options: ErrorOptions) {
        super(`Account lifecycle failed during ${stage}`, options);
        this.name = "AccountLifecycleError";
        this.stage = stage;
    }
}

export async function resumeCloudDeletion(
    phase: DeletionPhase,
    preparation: DeletionPreparation,
    deps: Pick<AccountLifecycleDependencies, "advanceDeletion" | "revokeProvider">
): Promise<void> {
    if (!(deps.advanceDeletion && deps.revokeProvider)) {
        throw new Error("Resumable account deletion is not configured");
    }
    const { advanceDeletion, revokeProvider } = deps;
    if (phase === "prepared") {
        await revokeProvider(preparation);
    }
    const advanceUntilComplete = async (): Promise<void> => {
        const next = await advanceDeletion(preparation.resumeSecret);
        if (next.phase !== "complete" && next.phase !== "prepared") {
            await advanceUntilComplete();
        }
    };
    await advanceUntilComplete();
}

async function completeCloudDeletion(deps: AccountLifecycleDependencies, clearSecret = true): Promise<void> {
    if (
        !(
            deps.prepareDeletion &&
            deps.persistDeletionSecret &&
            deps.revokeProvider &&
            deps.advanceDeletion &&
            deps.clearDeletionSecret
        )
    ) {
        throw new Error("Resumable account deletion is not configured");
    }
    const { advanceDeletion, clearDeletionSecret, persistDeletionSecret, prepareDeletion, revokeProvider } = deps;
    const preparation = await prepareDeletion();
    await persistDeletionSecret(preparation);
    await resumeCloudDeletion("prepared", preparation, { advanceDeletion, revokeProvider });
    if (clearSecret) {
        await clearDeletionSecret();
    }
}

export async function runAccountLifecycle(
    action: AccountLifecycleAction,
    deps: AccountLifecycleDependencies
): Promise<void> {
    deps.allowLocal();
    await deps.quiesce();

    if (action === "signOut") {
        try {
            await deps.signOut?.();
        } catch (cause) {
            throw new AccountLifecycleError("signOut", { cause });
        }
        deps.navigateToLedger();
        return;
    }

    if (action === "deleteAll") {
        try {
            await deps.beginDeviceReset?.();
        } catch (cause) {
            throw new AccountLifecycleError("resetDevice", { cause });
        }
    }

    try {
        await completeCloudDeletion(deps, action !== "deleteAll");
    } catch (cause) {
        throw new AccountLifecycleError("revokeProvider", { cause });
    }
    if (action === "deleteAll") {
        try {
            await deps.markDeviceCleanupReady?.();
            await deps.clearDeletionSecret?.();
            const result = await deps.resetDevice?.();
            if (result && result.failures.length > 0) {
                throw new Error(`Device cleanup incomplete: ${result.failures.join(", ")}`);
            }
        } catch (cause) {
            throw new AccountLifecycleError("resetDevice", { cause });
        }
    }
    if (action === "deleteAll") {
        deps.navigateToOnboarding?.();
        if (!deps.navigateToOnboarding) {
            deps.navigateToLedger();
        }
        return;
    }
    deps.navigateToLedger();
}
