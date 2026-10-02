import { z } from "zod";

/**
 * A transaction an App Intent accepted while the app was not running. The intent
 * cannot reach SQLite — the store lives in the app's own container and the whole
 * write path (category resolution, note fallback, recurrence projection) is
 * TypeScript — so it parks the request in the App Group and the app commits it
 * on next launch. See `targets/intents/LogTransactionIntent.swift` for the
 * writer; the field names are the wire format and cannot be renamed on one side
 * alone.
 */
export interface PendingWrite {
    amount: number;
    /**
     * The amount exactly as it arrived, e.g. "€12,40" — the drain reads the
     * currency back out of it. A Wallet purchase is in the card's currency, not
     * the ledger's, and this app is multi-currency.
     */
    amountText?: string | null;
    /**
     * The Wallet card the purchase was made with, as text from Shortcuts. The
     * drain maps it to an account — see `cardAccountId`. Null for a spoken
     * entry.
     */
    card?: string | null;
    /** Category name as spoken; resolved to a real category by the drain. */
    category: string | null;
    /** An explicit ISO code when the automation pinned one; beats `amountText`. */
    currency?: string | null;
    /** Epoch ms — when the intent ran, not when the app got around to it. */
    date: number;
    /**
     * Identifies the *purchase*, where `id` identifies the enqueue. A Wallet
     * automation fires once when the card authorizes and again when the charge
     * settles, and those are two separate intent runs describing one purchase.
     *
     * Carries no timestamp on purpose: how far apart two runs may be and still
     * mean the same purchase is a policy the app owns, not the extension — see
     * `WALLET_DEDUPE_WINDOW_MS` in `src/data/pending-writes-core.ts`.
     */
    dedupeKey?: string | null;
    id: string;
    income: boolean;
    note: string;
    /** Raw notification text; the drain parses amount and merchant out of it. */
    text?: string | null;
}

/** Where the intents append, inside the App Group container. */
export const QUEUE_DIRECTORY = "pending-writes";

/** The file every intent appends one JSON line to. */
export const QUEUE_FILE = "queue.jsonl";

const CLAIM_NAME = /^claimed-(\d+)\.jsonl$/;

/**
 * The files a drain works with. Split out so the queue's naming, ordering and
 * crash-recovery rules are exercised under `node --test`, which cannot load
 * `expo-file-system`.
 */
export interface QueueFiles {
    /** Moves the live queue aside under `name`. False when nothing was queued. */
    claim: (name: string) => boolean;
    discard: (name: string) => void;
    /** Every file currently in the queue directory. */
    list: () => string[];
    read: (name: string) => string;
    write: (name: string, text: string) => void;
}

/** Claimed files and their contents, oldest first. */
export interface ClaimedWrites {
    jobs: PendingWrite[];
    names: string[];
}

function claimOrder(name: string): number {
    return Number(CLAIM_NAME.exec(name)?.[1] ?? 0);
}

function claimNames(files: QueueFiles): string[] {
    return files
        .list()
        .filter((name) => CLAIM_NAME.test(name))
        .sort((a, b) => claimOrder(a) - claimOrder(b));
}

/**
 * The next name in sequence, so claimed files sort in the order they were taken
 * and a drain interrupted halfway still replays oldest first.
 */
function claimName(files: QueueFiles): string {
    const highest = claimNames(files).reduce((top, name) => Math.max(top, claimOrder(name)), 0);
    return `claimed-${highest + 1}.jsonl`;
}

/**
 * The wire format `LogTransactionIntent.swift` writes.
 *
 * Only the five fields a write is useless without are required. The rest default
 * to null rather than failing the line: an extension build older than the app is
 * normal, and every reader here tests them for truthiness, so a missing one and
 * an explicit null already mean the same thing.
 */
const pendingWriteSchema = z.object({
    amount: z.number().finite(),
    amountText: z.string().nullish(),
    card: z.string().nullish(),
    category: z
        .string()
        .nullish()
        .transform((value) => value ?? null),
    currency: z.string().nullish(),
    date: z.number().finite(),
    dedupeKey: z.string().nullish(),
    id: z.string(),
    income: z.boolean(),
    note: z.string(),
    text: z.string().nullish(),
});

/** Null for a line that is not JSON, or not a write this build can commit. */
function parsePendingWrite(line: string): PendingWrite | null {
    try {
        const parsed = pendingWriteSchema.safeParse(JSON.parse(line));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

/**
 * One JSON object per line. A line that does not parse is skipped rather than
 * failing the file: an append cut short by the extension being killed leaves a
 * partial last line, and the whole rest of the queue is still good.
 */
export function parseQueue(text: string): PendingWrite[] {
    const jobs: PendingWrite[] = [];
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        // A malformed line is skipped rather than losing the rest of the log.
        const write = parsePendingWrite(trimmed);
        if (write) {
            jobs.push(write);
        }
    }
    return jobs;
}

function toQueueText(jobs: PendingWrite[]): string {
    return jobs.map((job) => JSON.stringify(job)).join("\n");
}

/** The shape the pre-file queue used: one JSON array under a UserDefaults key. */
export function parseLegacyQueue(raw: string): PendingWrite[] {
    try {
        const parsed = z.array(pendingWriteSchema.nullable().catch(null)).safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data.filter((write) => write !== null) : [];
    } catch {
        return [];
    }
}

/** Parks `jobs` as a claimed file so they replay if this drain never finishes. */
export function adoptQueue(files: QueueFiles, jobs: PendingWrite[]): void {
    if (jobs.length === 0) {
        return;
    }
    files.write(claimName(files), toQueueText(jobs));
}

/**
 * Takes the queue out of the intents' reach and answers what was in it.
 *
 * The live file is renamed rather than read-and-cleared, so an intent appending
 * at the same moment either lands in what was claimed or in the fresh file the
 * next append creates — never in the gap between a read and a delete, which is
 * how the previous single-key queue lost writes.
 *
 * Files an earlier drain claimed and never released come back too: nothing is
 * deleted until the caller has committed, so a force-quit mid-drain replays
 * instead of dropping. Replaying is safe because every job carries an id the
 * drain remembers — see `applyPendingWrites`.
 */
export function claimPendingWrites(files: QueueFiles): ClaimedWrites {
    const names = claimNames(files);
    const next = claimName(files);
    if (files.claim(next)) {
        names.push(next);
    }
    return {
        jobs: names.flatMap((name) => parseQueue(files.read(name))),
        names,
    };
}

export function releasePendingWrites(files: QueueFiles, claimed: ClaimedWrites): void {
    for (const name of claimed.names) {
        files.discard(name);
    }
}
