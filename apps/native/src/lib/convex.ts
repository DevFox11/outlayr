import type { StreamArgs, SyncStreamsReturnValue, UIMessage } from "@convex-dev/agent";
import { makeFunctionReference } from "convex/server";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { z } from "zod";

import type { PhotoTransport } from "@/data/photo-sync-core";
import type { PullRatesFn } from "@/data/rates";
import type { PullFn, PushFn } from "@/data/sync-engine-core";
import type { RemoteEnrichmentResult } from "@/domain/enrichment-cache";

import { cloudRuntime } from "./cloud-runtime";
import type { CloudRuntime } from "./cloud-runtime";

export const convex = cloudRuntime?.convex ?? null;

function cloudClient(): CloudRuntime["convex"] {
    if (cloudRuntime === null) {
        throw new Error("Cloud runtime is not configured");
    }
    return cloudRuntime.convex;
}

/**
 * Every backend call in this file goes through one of these three.
 *
 * Convex functions are addressed by their string path rather than through the
 * generated `api` object: `packages/backend` is not a build dependency of the
 * app, so that object does not exist here and the client's overloads — which are
 * keyed on it — have nothing to match. The three assertions below are the whole
 * cost of that, stated once instead of at twenty call sites.
 *
 * What pins each shape instead is the `Result` the caller names plus the
 * backend's own tests over the same function's validators.
 */
export function cloudQuery<Args, Result>(path: string, args: Args): Promise<Result> {
    // SAFETY: `never` satisfies the generated-API overload for both the path and
    // the args; the real values are a deployed function's name and its arguments.
    return cloudClient().query(path as never, args as never) as Promise<Result>;
}

export function cloudMutation<Args, Result>(path: string, args: Args): Promise<Result> {
    // SAFETY: as in `cloudQuery`.
    return cloudClient().mutation(path as never, args as never) as Promise<Result>;
}

export function cloudAction<Args, Result>(path: string, args: Args): Promise<Result> {
    // SAFETY: as in `cloudQuery`.
    return cloudClient().action(path as never, args as never) as Promise<Result>;
}

export function ratesPuller(): PullRatesFn {
    return async (args) => cloudQuery("exchangeRates:pullRates", { ...args, at: Date.now() });
}

/**
 * The replication transport.
 *
 * Authentication rides on the client rather than on these calls:
 * `ConvexBetterAuthProvider` sets the token on `convex` itself, so a signed-out
 * device reaches `requireUserId` and is refused there. Nothing here decides who
 * the caller is, which is the point — the server never accepts a user id as an
 * argument.
 */
export interface SyncTransport {
    pull: PullFn;
    push: PushFn;
}

export function syncTransport(): SyncTransport {
    return {
        pull: async (args) => cloudQuery("sync:pullSince", args),
        push: async (args) => cloudMutation("sync:push", args),
    };
}

/**
 * A live subscription to the account's replication watermark. Returns the
 * unsubscribe.
 *
 * This is the one call in this file that is not request/response, and it is what
 * makes replication realtime: any device's push moves the watermark, which
 * invalidates the query on every other device and delivers a value here without
 * anybody polling.
 *
 * A refusal is swallowed rather than surfaced. A signed-out device reaches
 * `requireUserId` and is turned away, and the subscription has to survive that —
 * the same socket delivers a number as soon as `ConvexBetterAuthProvider` sets a
 * token, so tearing it down on the first error would mean no realtime until the
 * next remount.
 */
export function watchSyncWatermark(onWatermark: (watermark: number) => void): () => void {
    if (cloudRuntime === null) {
        return () => undefined;
    }
    // SAFETY: addressed by path for the reason given on `cloudQuery`; this is the
    // subscribing counterpart, which takes the same two arguments.
    const watch = cloudRuntime.convex.watchQuery("sync:currentSeq" as never, {} as never);
    return watch.onUpdate(() => {
        try {
            // The socket can also deliver the refusal described above, so the
            // watermark is read rather than assumed.
            const watermark = z.number().safeParse(watch.localQueryResult());
            if (watermark.success) {
                onWatermark(watermark.data);
            }
        } catch {
            // The refusal described above. The subscription stays up.
        }
    });
}

export interface CategoryBranch {
    children: string[];
    name: string;
}

export interface EnrichmentRequest {
    /** Names only — the shape of the ledger, never its figures. */
    categoryTree: CategoryBranch[];
    /**
     * The ISO code the entry is in — a code, never an amount. Where the money
     * was spent is a better locator than where the device is registered.
     */
    currency?: string;
    /** The synced `groundedLookup` setting; the server re-checks it too. */
    groundedLookup: boolean;
    income: boolean;
    knowledgeOnly?: boolean;
    locale?: string;
    name: string;
    /**
     * The device's own region — a signal `locale` cannot substitute for, since a
     * user may run an English UI on a device set to a different region.
     */
    regionCode?: string;
}

export type EnrichmentFn = (args: EnrichmentRequest) => Promise<RemoteEnrichmentResult>;

/**
 * Only the merchant name and the user's own category names are sent — the
 * action's argument validator is asserted against that exact field set in
 * `packages/backend/convex/enrichment.test.ts`, so amounts, dates, accounts
 * and balances cannot be added here without failing that test.
 *
 * Signed-out callers are refused server-side and answered with the empty
 * suggestion rather than an error, so there is no client-side identity check
 * to keep in step: authentication rides on `convex` itself, exactly as it does
 * for `syncTransport`.
 */
export function enrichmentTransport(): EnrichmentFn {
    return async (args) => cloudAction("enrichment:suggest", args);
}

export interface LabelSuggestion {
    categoryName: string;
    /** Absent from a backend deployed before the merchantKnowledge tier. */
    domain?: string | null;
    label: string;
}

export type CsvImportStatus =
    | "ok"
    | "unauthenticated"
    | "notConfigured"
    | "rateLimited"
    | "notEntitled"
    | "invalid"
    | "providerError"
    | "invalidResponse";

export interface CsvImportResult {
    degraded?: boolean;
    status: CsvImportStatus;
    suggestions: LabelSuggestion[] | null;
}

export interface CsvImportRequest {
    categoryTree: CategoryBranch[];
    /** The synced `groundedLookup` setting; the server re-checks it too. */
    groundedLookup?: boolean;
    labels: string[];
    regionCode?: string;
}

export type CsvImportFn = (args: CsvImportRequest) => Promise<CsvImportResult>;

/**
 * Args are `{labels, categoryTree}` plus the grounded consent flag and device
 * region — the same privacy boundary the action's own validator asserts in
 * `packages/backend/convex/csvImport.ts`. Authentication rides on `convex`
 * itself, exactly as it does for `enrichmentTransport`.
 */
export function csvImportTransport(): CsvImportFn {
    return async (args) => cloudAction("csvImport:csvImport", args);
}

interface VoiceDraftBase {
    amount: number;
    /** ISO 4217; null is the ledger's own currency. */
    currency: string | null;
    /** `YYYY-MM-DD` on the device's calendar, as it was sent. */
    date: string;
    details: string | null;
}

export type VoiceRecurrenceUnit = "day" | "week" | "month" | "year";

/** "Every month", "every 2 weeks": the cadence a subscription repeats on. */
export interface VoiceRecurrence {
    every: number;
    unit: VoiceRecurrenceUnit;
}

interface VoiceEntryDraft extends VoiceDraftBase {
    accountName: string | null;
    categoryName: string | null;
    /** The merchant's web domain when the model knew it; the logo lookup's long tail. */
    domain: string | null;
    income: boolean;
    kind: "entry";
    merchant: string;
    /** Null for a one-off; a transfer never repeats. */
    recurrence: VoiceRecurrence | null;
}

/** Money moved between two of the person's own accounts; names only, as spoken. */
interface VoiceTransferDraft extends VoiceDraftBase {
    fromAccountName: string | null;
    kind: "transfer";
    toAccountName: string | null;
}

export type VoiceDraft = VoiceEntryDraft | VoiceTransferDraft;

/** What the agent's `proposeDraft` tool answered; a null draft is "no transaction in those words". */
export interface ProposedDraft {
    draft: VoiceDraft | null;
}

type SpeakStatus =
    | "ok"
    | "unauthenticated"
    | "notConfigured"
    | "rateLimited"
    | "notEntitled"
    | "quotaExceeded"
    | "invalid"
    | "providerError"
    | "unclear";

interface SpeakResult {
    /** The turn the words landed on; the draft answers at the same order. */
    order: number | null;
    status: SpeakStatus;
    transcript: string | null;
}

export interface SpeakRequest {
    accounts: string[];
    /** AAC in an MP4 container, under `MAX_AUDIO_BYTES` on the server. */
    audio: ArrayBuffer;
    categoryTree: CategoryBranch[];
    currency: string;
    language?: string;
    threadId: string;
    today: string;
}

/** The name the server registers the draft tool under; its UI part is `tool-${name}`. */
export const PROPOSE_DRAFT_TOOL = "proposeDraft";

/** The turns query `useUIMessages` subscribes to, addressed by path like every other call here. */
export const VOICE_TURNS_QUERY = makeFunctionReference<
    "query",
    { paginationOpts: PaginationOptions; streamArgs?: StreamArgs; threadId: string },
    PaginationResult<UIMessage> & { streams: SyncStreamsReturnValue }
>("voiceEntry:listTurns");

export interface StartThreadResult {
    status: "ok" | "unauthenticated" | "rateLimited";
    threadId: string | null;
}

export interface VoiceThreadTransport {
    /** The screen closed; the thread's sentences go with it. */
    end: (threadId: string) => Promise<null>;
    /** One clip on the thread. The draft it produces arrives through `VOICE_TURNS_QUERY`. */
    speak: (args: SpeakRequest) => Promise<SpeakResult>;
    start: () => Promise<StartThreadResult>;
}

/**
 * The clip plus names only — no ids, no history — the boundary
 * `packages/backend/convex/voiceEntry.ts` asserts. Authentication rides on
 * `convex` itself, exactly as it does for `csvImportTransport`.
 */
export function voiceThreadTransport(): VoiceThreadTransport {
    return {
        end: async (threadId) => cloudMutation("voiceEntry:endThread", { threadId }),
        speak: async (args) => cloudAction("voiceEntry:speak", args),
        start: async () => cloudMutation("voiceEntry:startThread", {}),
    };
}

/** Convex file storage answers the PUT with the id it allocated; R2 sends nothing. */
const uploadReceipt = z.object({ storageId: z.string().optional() });

/**
 * The bytes never touch Convex: the signed urls address R2 directly, so a
 * multi-megabyte PUT is not a mutation argument and does not count against any
 * function limit. Only the three small calls that mint and account for those
 * urls go through the client, and they authenticate exactly as `syncTransport`
 * does — on the client, never on an argument.
 */
export function photoTransport(): PhotoTransport {
    return {
        confirmUpload: async (key, storageId) => {
            await cloudAction("photos:confirmUpload", storageId ? { key, storageId } : { key });
        },
        get: async (url) => {
            const response = await fetch(url);
            if (response.status === 404 || response.status === 403) {
                // Gone, or the url outlived its signature. Both are the same thing to
                // the caller: no bytes this pass, try again next one.
                return null;
            }
            if (!response.ok) {
                throw new Error(`Photo download failed: ${response.status}`);
            }
            return new Uint8Array(await response.arrayBuffer());
        },
        put: async (url, bytes) => {
            const response = await fetch(url, {
                // SAFETY: React Native sends a typed array as raw bytes, but its
                // `BodyInit` lists only Blob/FormData/URLSearchParams/string, so
                // the byte array has no overlap to assert against directly.
                body: bytes as unknown as BodyInit,
                headers: { "Content-Type": "image/jpeg" },
                method: "PUT",
            });
            if (!response.ok) {
                throw new Error(`Photo upload failed: ${response.status}`);
            }
            // Convex file storage answers the PUT with the id it allocated; R2
            // answers with nothing, because its key is already the address.
            try {
                const body = uploadReceipt.safeParse(await response.json());
                return body.success ? (body.data.storageId ?? null) : null;
            } catch {
                return null;
            }
        },
        // A mutation, though it writes nothing: a query's result is cached until
        // its read set changes, and an expired signed url served from that cache
        // is one the retry below can never get past. See `photos.readUrls`.
        readUrls: async (keys) => cloudMutation("photos:readUrls", { keys: [...keys] }),
        release: async (key) => {
            await cloudMutation("photos:releaseUnreferenced", { key });
        },
        requestUpload: async (name) => cloudMutation("photos:requestUpload", { name }),
    };
}

export interface ReceiptItem {
    name: string;
    /** The line's total in the receipt's currency, quantity included. */
    price: number;
    quantity: number;
}

/** One photographed receipt as `receiptScan:scan` read it; names only, as printed. */
export interface ReceiptDraft {
    /** A ledger account the payment line names, in the ledger's spelling. */
    accountName: string | null;
    categoryName: string | null;
    /** ISO 4217; null is the ledger's own currency. */
    currency: string | null;
    /** Whether the code was printed, or inferred from a symbol and the device's region. */
    currencySource: "printed" | "inferred";
    /** The receipt named a code the ledger cannot price; `currency` is null as a stand-in, never a guess. */
    currencyUnresolved: boolean;
    /** `YYYY-MM-DD` on the device's calendar, as it was sent. */
    date: string;
    domain: string | null;
    /** A refund or return slip. */
    income: boolean;
    items: ReceiptItem[];
    merchant: string;
    paymentMethod: string | null;
    subtotal: number | null;
    tax: number | null;
    tip: number | null;
    total: number;
}

type ScanStatus =
    | "ok"
    | "unauthenticated"
    | "notConfigured"
    | "rateLimited"
    | "notEntitled"
    | "quotaExceeded"
    | "invalid"
    | "providerError"
    | "invalidResponse"
    | "unclear";

interface ScanResult {
    receipt: ReceiptDraft | null;
    status: ScanStatus;
}

export interface ScanRequest {
    accounts: string[];
    categoryTree: CategoryBranch[];
    currency: string;
    /** JPEG, under `MAX_IMAGE_BYTES` on the server. */
    image: ArrayBuffer;
    language?: string;
    regionCode?: string;
    today: string;
}

export type ReceiptScanFn = (args: ScanRequest) => Promise<ScanResult>;

/**
 * The photo plus names only — no ids, no history — the boundary
 * `packages/backend/convex/receiptScan.ts` asserts. Authentication rides on
 * `convex` itself, exactly as it does for `voiceThreadTransport`.
 */
export function receiptScanTransport(): ReceiptScanFn {
    return async (args) => cloudAction("receiptScan:scan", args);
}
