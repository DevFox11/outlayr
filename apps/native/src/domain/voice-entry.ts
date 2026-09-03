import { roundMoney } from "@outlayr/money/round";

import type { ProposedDraft, VoiceDraft, VoiceRecurrence, VoiceRecurrenceUnit } from "@/lib/convex";
import { PROPOSE_DRAFT_TOOL } from "@/lib/convex";

import { minorUnitsFor } from "./money";
import { RECURRING_TYPE } from "./recurrence";
import type { RecurringType } from "./recurrence";

/**
 * A spoken draft with the ledger's own ids on it: what the review step shows
 * and what the repos are handed. Names the model returned that this ledger
 * cannot resolve become nulls here, never guesses.
 */
/** A spoken cadence in the ledger's own terms: the stored `recurringType` and its multiplier. */
export interface ResolvedRecurrence {
    coefficient: number;
    type: RecurringType;
}

export interface ResolvedVoiceEntry {
    accountId: string | null;
    /** An account was named but did not resolve to exactly one; the form must ask which. */
    accountUnresolved: boolean;
    amount: number;
    categoryId: string | null;
    currency: string;
    date: Date;
    details: string | null;
    domain: string | null;
    income: boolean;
    kind: "entry";
    merchant: string;
    recurrence: ResolvedRecurrence | null;
}

/**
 * Both legs in one currency. A cross-currency move needs a rate, which nobody
 * speaks, so it is never saved from the review step: `currency` mismatching an
 * account's own is what sends it to the transfer editor instead.
 */
export interface ResolvedVoiceTransfer {
    amount: number;
    currency: string;
    date: Date;
    details: string | null;
    fromAccount: AccountCandidate | null;
    /** A source was named but did not resolve to exactly one account; the editor must ask. */
    fromUnresolved: boolean;
    kind: "transfer";
    toAccount: AccountCandidate | null;
    /** Likewise for the destination. */
    toUnresolved: boolean;
}

export type ResolvedVoiceDraft = ResolvedVoiceEntry | ResolvedVoiceTransfer;

export interface CategoryCandidate {
    id: string;
    income: boolean;
    name: string | null;
}

export interface AccountCandidate {
    currency: string;
    id: string;
    name: string;
}

interface ResolveArgs {
    accounts: readonly AccountCandidate[];
    categories: readonly CategoryCandidate[];
    /** The ledger's currency, for a draft that names none. */
    currency: string;
    draft: VoiceDraft;
    /** The instant the clip was sent — a draft dated today keeps its time of day. */
    now: Date;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The same fold `transfer-core.ts:categoryKey` links CSV values under. */
const foldName = (value: string) => value.trim().toLowerCase();

/**
 * `YYYY-MM-DD` to a local instant. Today keeps the clock so the entry sorts
 * where the user expects among the day's other rows; any other day lands at
 * noon, clear of both DST edges.
 */
export function spokenDateToLocal(date: string, now: Date): Date {
    const match = ISO_DATE.exec(date);
    if (match === null) {
        return now;
    }
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
    if (isToday) {
        return now;
    }
    const local = new Date(year, month, day, 12, 0, 0, 0);
    return Number.isNaN(local.getTime()) ? now : local;
}

const RECURRING_TYPE_OF = {
    day: RECURRING_TYPE.daily,
    month: RECURRING_TYPE.monthly,
    week: RECURRING_TYPE.weekly,
    year: RECURRING_TYPE.yearly,
} as const satisfies Record<VoiceRecurrenceUnit, RecurringType>;

export function resolveRecurrence(recurrence: VoiceRecurrence | null): ResolvedRecurrence | null {
    return recurrence === null ? null : { coefficient: recurrence.every, type: RECURRING_TYPE_OF[recurrence.unit] };
}

/**
 * The one candidate whose folded name is the spoken one. Two candidates with
 * that name are no match at all: the ledger allows duplicate account names,
 * and a draft that could land on either balance is not one to save unasked.
 */
function uniqueMatch<T>(
    candidates: readonly T[],
    name: string | null,
    nameOf: (candidate: T) => string | null
): T | null {
    if (name == null) {
        return null;
    }
    const wanted = foldName(name);
    const matches = candidates.filter((candidate) => {
        const candidateName = nameOf(candidate);
        return candidateName != null && foldName(candidateName) === wanted;
    });
    return matches.length === 1 ? (matches[0] ?? null) : null;
}

/**
 * The category is matched by folded name AND by direction: a model that files a
 * refund under "Groceries" has named a real category on the wrong side of the
 * ledger, and that is a miss, not a match.
 */
export function resolveVoiceDraft({ accounts, categories, currency, draft, now }: ResolveArgs): ResolvedVoiceDraft {
    const findAccount = (name: string | null) => uniqueMatch(accounts, name, (candidate) => candidate.name);

    if (draft.kind === "transfer") {
        const fromAccount = findAccount(draft.fromAccountName);
        const matchedTo = findAccount(draft.toAccountName);
        // The same account twice is a mishearing, not a move.
        const toAccount = matchedTo !== null && matchedTo.id === fromAccount?.id ? null : matchedTo;
        // Unspoken, the money is in whatever the leaving account holds.
        const moved = draft.currency ?? fromAccount?.currency ?? currency;
        return {
            amount: roundMoney(draft.amount, minorUnitsFor(moved)),
            currency: moved,
            date: spokenDateToLocal(draft.date, now),
            details: draft.details,
            fromAccount,
            fromUnresolved: draft.fromAccountName !== null && fromAccount === null,
            kind: "transfer",
            toAccount,
            toUnresolved: draft.toAccountName !== null && toAccount === null,
        };
    }

    const category = uniqueMatch(
        categories.filter((candidate) => candidate.income === draft.income),
        draft.categoryName,
        (candidate) => candidate.name
    );

    // The model answers as many decimals as it heard; the row holds the
    // currency's minor units, and so must the review, or they would disagree.
    const spent = draft.currency ?? currency;
    const account = findAccount(draft.accountName);
    return {
        accountId: account?.id ?? null,
        accountUnresolved: draft.accountName !== null && account === null,
        amount: roundMoney(draft.amount, minorUnitsFor(spent)),
        categoryId: category?.id ?? null,
        currency: spent,
        date: spokenDateToLocal(draft.date, now),
        details: draft.details,
        domain: draft.domain,
        income: draft.income,
        kind: "entry",
        merchant: draft.merchant,
        recurrence: resolveRecurrence(draft.recurrence),
    };
}

/**
 * An entry the review step may write as-is: a category this ledger has, an
 * amount that survived rounding, a merchant, and no account named that the
 * ledger could not place. "JPY 0.4" rounds to nothing, a blank name would be
 * replaced by the category's on save, and an unplaced account would leave the
 * row off the balance the person named — none is what the review showed.
 */
export function savableEntry(draft: ResolvedVoiceEntry): { categoryId: string } | null {
    const named = draft.merchant.trim().length > 0;
    const ready = draft.categoryId !== null && draft.amount > 0 && named && !draft.accountUnresolved;
    return ready && draft.categoryId !== null ? { categoryId: draft.categoryId } : null;
}

/**
 * A transfer the review step may write as-is: two distinct accounts, both in
 * the currency the amount is in, so the legs are equal and the rate is 1.
 */
export function savableTransfer(draft: ResolvedVoiceTransfer): { from: AccountCandidate; to: AccountCandidate } | null {
    const { fromAccount, toAccount, currency } = draft;
    if (fromAccount === null || toAccount === null || !(draft.amount > 0)) {
        return null;
    }
    return fromAccount.currency === currency && toAccount.currency === currency
        ? { from: fromAccount, to: toAccount }
        : null;
}

/**
 * The recorder meters in dBFS, roughly -160 for silence up to 0 at clipping.
 * Speech in a quiet room sits between -40 and -10, so that is the band mapped
 * onto 0–1; anything under the floor is the room.
 */
const METER_FLOOR_DB = -45;
const METER_CEILING_DB = -8;

export function meterToLevel(metering: number | undefined): number {
    if (metering == null || !Number.isFinite(metering)) {
        return 0;
    }
    const level = (metering - METER_FLOOR_DB) / (METER_CEILING_DB - METER_FLOOR_DB);
    return Math.min(1, Math.max(0, level));
}

/** A level this loud is the person, not the room. */
export const SPEECH_LEVEL = 0.22;
/** How long after the last word the entry is taken as finished. */
export const TRAILING_SILENCE_MS = 1400;
/** A listener with nothing said into it stops asking after this. */
export const NO_SPEECH_TIMEOUT_MS = 9000;
/** One entry is a sentence; the server caps the bytes, this caps the wait. */
export const MAX_RECORDING_MS = 45_000;

export interface SilenceWatch {
    /** When speech was last heard; null until the first word. */
    lastSpeechAt: number | null;
    startedAt: number;
}

export type SilenceVerdict = "keep" | "finished" | "nothingSaid" | "tooLong";

export interface SilenceJudgement {
    verdict: SilenceVerdict;
    watch: SilenceWatch;
}

/**
 * Decides, from one meter sample, whether the recorder should keep going.
 * Pure so the three thresholds above can be proven rather than tuned by ear.
 */
export function judgeSilence(watch: SilenceWatch, level: number, at: number): SilenceJudgement {
    const next: SilenceWatch = level >= SPEECH_LEVEL ? { ...watch, lastSpeechAt: at } : watch;
    if (at - next.startedAt >= MAX_RECORDING_MS) {
        return { verdict: next.lastSpeechAt === null ? "nothingSaid" : "tooLong", watch: next };
    }
    if (next.lastSpeechAt === null) {
        return { verdict: at - next.startedAt >= NO_SPEECH_TIMEOUT_MS ? "nothingSaid" : "keep", watch: next };
    }
    return { verdict: at - next.lastSpeechAt >= TRAILING_SILENCE_MS ? "finished" : "keep", watch: next };
}

/** `YYYY-MM-DD` on the device's own calendar, never UTC's. */
export function localIsoDate(now: Date): string {
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

/** The slice of a thread message this screen reads; the agent's `UIMessage` is a superset. */
export interface VoiceTurnMessage {
    order: number;
    parts: readonly { output?: unknown; state?: string; type: string }[];
    role: string;
    status: string;
    text: string;
}

/** One line of the thread strip: what was said, or what an answer proposed. */
export type VoiceTurn =
    | { kind: "said"; order: number; text: string }
    | { draft: VoiceDraft | null; kind: "proposed"; order: number };

const DRAFT_PART = `tool-${PROPOSE_DRAFT_TOOL}`;

/**
 * The draft an assistant message carries, once its tool has run. Until then
 * (or for a message that failed before calling the tool) there is none, and the
 * caller keeps waiting or gives up on the message's own status.
 */
export function proposedDraftOf(message: VoiceTurnMessage): ProposedDraft | null {
    if (message.role !== "assistant") {
        return null;
    }
    const part = message.parts.find(
        (candidate) => candidate.type === DRAFT_PART && candidate.state === "output-available"
    );
    if (part === undefined) {
        return null;
    }
    // SAFETY: the server's `proposeDraft` tool returns a `ProposedDraft`; the
    // part is that return value, as the agent stored it.
    return part.output as ProposedDraft;
}

/** The thread as the strip shows it: every sentence, and every answer that reached a draft. */
export function voiceTurnsOf(messages: readonly VoiceTurnMessage[]): VoiceTurn[] {
    const turns: VoiceTurn[] = [];
    for (const message of messages) {
        if (message.role === "user") {
            turns.push({ kind: "said", order: message.order, text: message.text });
            continue;
        }
        const proposed = proposedDraftOf(message);
        if (proposed !== null) {
            turns.push({ draft: proposed.draft, kind: "proposed", order: message.order });
        }
    }
    return turns;
}

export type VoiceDraftField = "amount" | "merchant" | "category" | "account" | "date" | "kind" | "schedule" | "details";

/**
 * What a correction changed, for the strip's "Updated · date" line. Compared
 * on the names the model answered, not on resolved ids: the strip narrates the
 * conversation, and the conversation is in names.
 */
export function draftDelta(previous: VoiceDraft, next: VoiceDraft): VoiceDraftField[] {
    const changed: VoiceDraftField[] = [];
    if (previous.kind !== next.kind) {
        changed.push("kind");
    }
    if (previous.amount !== next.amount || previous.currency !== next.currency) {
        changed.push("amount");
    }
    if (previous.date !== next.date) {
        changed.push("date");
    }
    if (previous.details !== next.details) {
        changed.push("details");
    }
    if (previous.kind === "entry" && next.kind === "entry") {
        if (previous.merchant !== next.merchant) {
            changed.push("merchant");
        }
        if (previous.categoryName !== next.categoryName || previous.income !== next.income) {
            changed.push("category");
        }
        if (previous.accountName !== next.accountName) {
            changed.push("account");
        }
        if (
            previous.recurrence?.every !== next.recurrence?.every ||
            previous.recurrence?.unit !== next.recurrence?.unit
        ) {
            changed.push("schedule");
        }
    } else if (
        previous.kind === "transfer" &&
        next.kind === "transfer" &&
        (previous.fromAccountName !== next.fromAccountName || previous.toAccountName !== next.toAccountName)
    ) {
        changed.push("account");
    }
    return changed;
}
