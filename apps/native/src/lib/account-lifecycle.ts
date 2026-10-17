import type { ProviderBinding } from "./provider-revocation";

export type AccountLifecycleAction = "deleteAll" | "deleteCloud" | "signOut";
type AccountLifecycleStage = "deleteAccount" | "resetDevice" | "revokeProvider" | "signOut";

type DeletionPhase = "authDeleting" | "billingErased" | "complete" | "prepared" | "providersRevoked" | "purged";

export interface DeletionPreparation {
    provider?: ProviderBinding["provider"];
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
    eraseBilling?: (resumeSecret: string) => Promise<{ phase: DeletionPhase }>;
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
    deps: Pick<AccountLifecycleDependencies, "advanceDeletion" | "eraseBilling" | "revokeProvider">
): Promise<void> {
    if (!(deps.advanceDeletion && deps.eraseBilling && deps.revokeProvider)) {
        throw new Error("Resumable account deletion is not configured");
    }
    const { advanceDeletion, eraseBilling, revokeProvider } = deps;
    if (phase === "prepared") {
        await revokeProvider(preparation);
    }
    const advanceFrom = async (current: DeletionPhase): Promise<void> => {
        if (current === "complete" || current === "prepared") {
            return;
        }
        const next =
            current === "purged"
                ? await eraseBilling(preparation.resumeSecret)
                : await advanceDeletion(preparation.resumeSecret);
        await advanceFrom(next.phase);
    };
    await advanceFrom(phase === "prepared" ? "providersRevoked" : phase);
}

async function completeCloudDeletion(deps: AccountLifecycleDependencies, clearSecret = true): Promise<void> {
    if (
        !(
            deps.prepareDeletion &&
            deps.persistDeletionSecret &&
            deps.revokeProvider &&
            deps.advanceDeletion &&
            deps.eraseBilling &&
            deps.clearDeletionSecret
        )
    ) {
        throw new Error("Resumable account deletion is not configured");
    }
    const {
        advanceDeletion,
        clearDeletionSecret,
        eraseBilling,
        persistDeletionSecret,
        prepareDeletion,
        revokeProvider,
    } = deps;
    const preparation = await prepareDeletion();
    await persistDeletionSecret(preparation);
    await resumeCloudDeletion("prepared", preparation, { advanceDeletion, eraseBilling, revokeProvider });
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
        (deps.navigateToOnboarding ?? deps.navigateToLedger)();
        return;
    }
    deps.navigateToLedger();
}
