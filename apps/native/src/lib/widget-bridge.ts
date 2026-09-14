import { ExtensionStorage } from "@bacons/apple-targets";
import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import {
    adoptQueue,
    claimPendingWrites as claimQueue,
    parseLegacyQueue,
    QUEUE_DIRECTORY,
    QUEUE_FILE,
    releasePendingWrites as releaseQueue,
} from "./pending-writes-core";
import type { ClaimedWrites, QueueFiles } from "./pending-writes-core";

/**
 * The App Group the app and the App Intents target meet in, declared once in
 * `app.config.ts` and carried here through `extra`. Reading it back rather than
 * repeating the literal is what stops the two from drifting onto different
 * containers — a mismatch neither build complains about, and which surfaces only
 * as an intent whose work silently never arrives.
 *
 * The widgets do NOT come through here: `expo-widgets` owns its own transport
 * (`Widget.updateTimeline`). This group exists solely for the intent queue below.
 */
// SAFETY: as in `device-data-stores` — `extra` is an open record.
const APP_GROUP = Constants.expoConfig?.extra?.appGroup as string | undefined;

/**
 * Where `targets/intents` used to append. Read once and retired: the key held
 * the whole queue as one JSON string, so appending meant read-modify-write and
 * two intents running while the app was closed could overwrite each other. The
 * queue is a file now — see {@link claimPendingWrites}.
 */
export const PENDING_WRITES_KEY = "pendingWrites";

/** The key the read-only intents decode; see {@link publishIntentSnapshot}. */
export const INTENT_SNAPSHOT_KEY = "intentSnapshot";

/** Epoch ms string `SignalWalletRunIntent` writes on every Wallet automation run. */
export const WALLET_LAST_RUN_KEY = "walletLastRunAt";

let storage: ExtensionStorage | null = null;

function getStorage(): ExtensionStorage | null {
    if (Platform.OS !== "ios" || !APP_GROUP) {
        return null;
    }
    storage ??= new ExtensionStorage(APP_GROUP);
    return storage;
}

/**
 * What `BudgetLeftoverIntent` and `SpendingSummaryIntent` report. Mirrors
 * `IntentSnapshot` in `targets/intents/SharedStore.swift`; the field names are
 * the wire format and cannot be renamed on one side alone.
 *
 * A narrow projection of the widget props on purpose: widening it copies more of
 * the ledger into a second store the intents never read.
 */
export interface IntentSnapshot {
    budget: {
        present: boolean;
        name: string;
        periodLabel: string;
        remaining: string;
        remainingCaption: string;
        spent: string;
        limit: string;
        percent: string;
    };
    /**
     * Every budget, so `BudgetQuery` can resolve a spoken name. Ordered overall
     * first, which is what the intent falls back to when no budget is named.
     */
    budgets: {
        id: string;
        name: string;
        remaining: string;
        remainingCaption: string;
        spent: string;
        limit: string;
        percent: string;
        periodLabel: string;
    }[];
    insights: {
        periodLabel: string;
        rangeLabel: string;
        net: string;
        netPositive: boolean;
        spent: string;
        income: string;
    };
}

export function readWalletLastRun(): number | null {
    const at = Number(getStorage()?.get(WALLET_LAST_RUN_KEY));
    return at > 0 ? at : null;
}

export function publishIntentSnapshot(snapshot: IntentSnapshot): void {
    const store = getStorage();
    if (!store) {
        return;
    }
    try {
        store.set(INTENT_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (error) {
        console.warn("[outlayr] intent snapshot failed", error);
    }
}

/**
 * The queue directory inside the App Group container, which both this app and
 * the intents can reach. `Paths.appleSharedContainers` is keyed by the group id,
 * so a build whose entitlement does not carry the group resolves to nothing
 * rather than silently writing somewhere the intents cannot see.
 */
function queueDirectory(): Directory | null {
    if (Platform.OS !== "ios" || !APP_GROUP) {
        return null;
    }
    const container = Paths.appleSharedContainers[APP_GROUP];
    if (!container) {
        return null;
    }
    const directory = new Directory(container, QUEUE_DIRECTORY);
    directory.create({ idempotent: true, intermediates: true });
    return directory;
}

const queueFiles: QueueFiles = {
    claim(name) {
        const directory = queueDirectory();
        if (!directory) {
            return false;
        }
        const live = new File(directory, QUEUE_FILE);
        if (!live.exists || live.size === 0) {
            return false;
        }
        live.moveSync(new File(directory, name));
        return true;
    },

    discard(name) {
        const directory = queueDirectory();
        if (!directory) {
            return;
        }
        const file = new File(directory, name);
        if (file.exists) {
            file.delete();
        }
    },
    list() {
        const directory = queueDirectory();
        if (!directory) {
            return [];
        }
        return directory
            .list()
            .filter((entry): entry is File => entry instanceof File)
            .map((file) => file.name);
    },

    read(name) {
        const directory = queueDirectory();
        if (!directory) {
            return "";
        }
        const file = new File(directory, name);
        return file.exists ? file.textSync() : "";
    },

    write(name, text) {
        const directory = queueDirectory();
        if (!directory) {
            return;
        }
        const file = new File(directory, name);
        file.create({ overwrite: true });
        file.write(text);
    },
};

/** Moves anything still under the retired key into the file queue, once. */
function adoptLegacyQueue(): void {
    const store = getStorage();
    if (!store) {
        return;
    }
    const raw = store.get(PENDING_WRITES_KEY);
    if (!raw) {
        return;
    }
    adoptQueue(queueFiles, parseLegacyQueue(raw));
    store.remove(PENDING_WRITES_KEY);
}

/**
 * Takes the intent queue, oldest first, so a burst of Siri entries lands in the
 * order it was spoken.
 *
 * Nothing is deleted here. The caller commits what it gets and only then calls
 * {@link releasePendingWrites}, so a force-quit mid-drain replays rather than
 * dropping a *money* write. Replaying is safe because `applyPendingWrites`
 * records the enqueue id of every job it commits alongside the row, in the same
 * SQLite transaction — the idempotency key this queue used to lack.
 */
export function claimPendingWrites(): ClaimedWrites {
    try {
        adoptLegacyQueue();
        return claimQueue(queueFiles);
    } catch (error) {
        console.warn("[outlayr] pending writes unreadable", error);
        return { jobs: [], names: [] };
    }
}

export function releasePendingWrites(claimed: ClaimedWrites): void {
    try {
        releaseQueue(queueFiles, claimed);
    } catch (error) {
        console.warn("[outlayr] pending writes not released", error);
    }
}
