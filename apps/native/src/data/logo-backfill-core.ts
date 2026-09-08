import { and, desc, eq, gte, inArray, isNull, ne, notExists, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { appMeta, transactions } from "@/db/schema";
import { getCachedEnrichment } from "@/domain/enrichment-cache";
import type { RemoteEnrichmentResult } from "@/domain/enrichment-cache";
import { merchantKey, resolveMerchant } from "@/domain/merchant-resolver";
import type { LogoOutcome, MerchantImageRequest } from "@/lib/logo-fetch";

import { META_KEYS } from "./app-meta-core";
import { candidateLogoIds, dismissedLogoIds, readRetryDeadlines, writeRetryDeadlines } from "./logo-backfill-state";

/**
 * How far back a row is still worth a logo. A merchant the user logged this
 * fortnight is one they will scroll past; older rows stay as they were saved.
 */
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
/**
 * Logos fetched per pass. The window is read whole; a throttled name or one
 * waiting on the model budget costs nothing against this, so a run of names
 * that answer nothing can never starve an older row a curated hit would paint
 * at once.
 */
const FETCH_LIMIT = 12;
/**
 * Model calls per pass. The per-user bucket holds 8 and refills at 30/hour,
 * and the form's own lookups draw from the same bucket — a backfill that
 * drained it would cost the user their next typed merchant.
 */
const REMOTE_BUDGET = 3;
/**
 * A name the model classified but could not place is not asked again for a
 * while; a merchant whose grounded search is still running is, since its
 * answer lands in the shared cache within a minute or two. An answer with
 * nothing in it at all is neither: `suggest` returns that same empty shape
 * when the caller is signed out, rate-limited or the provider is down, which
 * a startup pass hits more often than a typed name does.
 */
const RETRY_MISS_MS = 6 * 60 * 60 * 1000;
const RETRY_GROUNDING_MS = 2 * 60 * 1000;
const RETRY_INDETERMINATE_MS = 30 * 60 * 1000;

export interface LogoBackfillDeps {
    /**
     * Null when the cloud is not configured or the setting keeps lookups
     * on-device. Resolving null means consent was withdrawn while the pass
     * was running: the pass stops there, nothing else is sent.
     */
    /**
     * Null when the cloud is not configured or the setting keeps lookups
     * on-device. Resolving null means consent was withdrawn at the moment of
     * sending: the pass stops there, nothing else is sent. A sent request
     * answers with the `groundedLookup` value it carried, read at that same
     * moment, because a classified name with no domain is only a real miss
     * when the web search that could still find one was allowed to run on
     * THAT request.
     */
    enrich:
        | ((args: {
              currency: string | null;
              income: boolean;
              name: string;
          }) => Promise<{ groundedLookup: boolean; result: RemoteEnrichmentResult } | null>)
        | null;
    /** True once the pass must stop: nothing more is asked, fetched or written. */
    cancelled?: () => boolean;
    /** Removes a persisted file whose paint did not land, so nothing is left behind. */
    discard?: (imageUri: string) => void;
    fetchImage: (request: MerchantImageRequest) => Promise<LogoOutcome>;
    now?: number;
    persist: (bytes: Uint8Array) => Promise<{ imageColor: string | null; imageUri: string }>;
}

interface PendingRow {
    currency: string | null;
    id: string;
    note: string;
    /** The `updatedAt` the candidate was matched on; the paint requires it too. */
    updatedAt: Date;
}

interface MerchantGroup {
    currency: string | null;
    /** Merchant key and currency together — see `pendingGroups`. */
    id: string;
    income: boolean;
    key: string;
    note: string;
    rows: PendingRow[];
}

/**
 * Still wearing its category tile: nothing chosen, nothing synced, nothing
 * painted. A colour alone is a choice too — the picker lets the user tint
 * the tile without picking a glyph, and an image would draw over it.
 */
function bare() {
    return and(
        isNull(transactions.deletedAt),
        isNull(transactions.imageUri),
        isNull(transactions.imageKey),
        isNull(transactions.icon),
        isNull(transactions.emoji),
        isNull(transactions.customColor)
    );
}

/**
 * The rows this device last wrote bare and has not painted or heard a
 * removal for since, grouped by merchant AND currency so one
 * lookup covers every row of the same name: the currency is the locator the
 * model is given, and a same-named business in two countries must not share
 * the logo one of them resolved to. See `logo-backfill-state.ts` for why the
 * candidate and dismissal lists exist at all.
 */
async function pendingGroups(db: Database, now: number): Promise<MerchantGroup[]> {
    const rows = await db
        .select({
            currency: transactions.currency,
            id: transactions.id,
            income: transactions.income,
            note: transactions.note,
            updatedAt: transactions.updatedAt,
        })
        .from(transactions)
        .where(and(bare(), ne(transactions.note, ""), gte(transactions.date, new Date(now - WINDOW_MS))))
        .orderBy(desc(transactions.date));
    const candidates = await candidateLogoIds(db);
    const dismissed = await dismissedLogoIds(db);

    const groups = new Map<string, MerchantGroup>();
    for (const row of rows) {
        const key = merchantKey(row.note);
        // A candidate is this device's last bare write of the row, by `updatedAt`.
        // A row that has moved on since — a peer's edit arriving by sync — is no
        // longer this device's to paint: the peer may have put a logo on and
        // taken it off again, and only it knows.
        // The window is on the stamp as well as the date: a future-dated row
        // (a pending charge) would otherwise stay eligible for as long as it
        // stays bare, and the stamp is when this device last wrote it so.
        const stamp = candidates.get(row.id);
        if (
            key.length === 0 ||
            stamp === undefined ||
            stamp !== row.updatedAt.getTime() ||
            now - stamp > WINDOW_MS ||
            dismissed.has(row.id)
        ) {
            continue;
        }
        const id = `${key}|${row.currency ?? ""}`;
        const group = groups.get(id);
        const pending: PendingRow = { currency: row.currency, id: row.id, note: row.note, updatedAt: row.updatedAt };
        if (group) {
            group.rows.push(pending);
        } else {
            groups.set(id, { currency: row.currency, id, income: row.income, key, note: row.note, rows: [pending] });
        }
    }
    return [...groups.values()];
}

/**
 * Paints one row, unless it moved while the lookup was out. The predicate
 * re-checks everything the row was selected on, plus the note and currency
 * the domain was resolved for, so a photo the user chose, a merchant they
 * renamed or a currency they corrected in the meantime is never overwritten,
 * and nor is a row a peer's edit reached by sync while the lookup was out;
 * the `returning` is how the caller learns which rows actually took it. A
 * logo removed by hand in that window is caught in the same statement: the
 * dismissal list is read by the UPDATE itself, so there is no gap between
 * checking it and writing for a removal to fall into.
 */
async function paintRow(db: Database, row: PendingRow, logo: { imageColor: string | null; imageUri: string }) {
    const sameCurrency =
        row.currency === null ? isNull(transactions.currency) : eq(transactions.currency, row.currency);
    // Ids carry no quotes, so the quoted id is exactly one JSON array element.
    const notDismissed = notExists(
        db
            .select({ key: appMeta.key })
            .from(appMeta)
            .where(and(eq(appMeta.key, META_KEYS.logoDismissals), sql`instr(${appMeta.value}, ${`"${row.id}"`}) > 0`))
    );
    const painted = await db
        .update(transactions)
        // Never behind the row's own clock: a row lifted ahead of wall time by
        // account adoption would otherwise lose the paint to the sync's
        // last-writer check.
        .set({
            imageColor: logo.imageColor,
            imageUri: logo.imageUri,
            updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)),
        })
        .where(
            and(
                eq(transactions.id, row.id),
                eq(transactions.note, row.note),
                eq(transactions.updatedAt, row.updatedAt),
                sameCurrency,
                bare(),
                notDismissed
            )
        )
        .returning({ id: transactions.id });
    return painted.length;
}

/**
 * Whether any row of the group is still what it was selected as. The pass
 * awaits the network between groups, and a row renamed, given an identity or
 * deleted in that time must not have its OLD name sent anywhere, nor spend
 * the budget on a lookup nothing will take.
 */
async function stillPending(db: Database, group: MerchantGroup): Promise<boolean> {
    const live = await db
        .select({
            currency: transactions.currency,
            id: transactions.id,
            note: transactions.note,
            updatedAt: transactions.updatedAt,
        })
        .from(transactions)
        .where(
            and(
                inArray(
                    transactions.id,
                    group.rows.map((row) => row.id)
                ),
                bare()
            )
        );
    return group.rows.some((row) =>
        live.some(
            (current) =>
                current.id === row.id &&
                current.note === row.note &&
                current.currency === row.currency &&
                current.updatedAt.getTime() === row.updatedAt.getTime()
        )
    );
}

type DomainAnswer =
    | { domain: string; kind: "domain"; spentRemote: boolean }
    | { kind: "none"; retryIn: number; spentRemote: boolean }
    /** Not now, and no deadline: nothing was asked, so nothing was refused. */
    | { kind: "later" }
    | { kind: "withdrawn" };

/**
 * The same ladder the form climbs, minus the parts that need a screen: the
 * curated map, then what the form learned this session, then the model — whose
 * own first tier is the shared knowledge cache the grounded search fills.
 *
 * Nothing is written back to the session cache. A painted row leaves the set
 * and a miss is throttled here, so there is no second ask to save; and the
 * empty shape `suggest` answers with when the caller is signed out or
 * rate-limited would poison the form's next lookup of the same name.
 */
async function resolveDomain(group: MerchantGroup, deps: LogoBackfillDeps, remoteLeft: number): Promise<DomainAnswer> {
    const curated = resolveMerchant(group.key)?.domain ?? null;
    if (curated !== null) {
        return { domain: curated, kind: "domain", spentRemote: false };
    }
    // Only a domain the form learned short-circuits. A session entry with none
    // is what the fast tier answered before its grounded follow-up published,
    // and the backend's own first tier is where that answer now lives.
    const cached = getCachedEnrichment(group.key, group.currency ?? undefined);
    if (cached.hit && cached.value?.domain != null) {
        return { domain: cached.value.domain, kind: "domain", spentRemote: false };
    }
    // Smart fill off, or this pass's budget spent: the name was never asked
    // about, so it must not be remembered as a miss — turning the setting on
    // should find it on the very next pass.
    if (deps.enrich === null || remoteLeft <= 0) {
        return { kind: "later" };
    }
    let sent: { groundedLookup: boolean; result: RemoteEnrichmentResult } | null;
    try {
        sent = await deps.enrich({ currency: group.currency, income: group.income, name: group.note.trim() });
    } catch {
        // Offline, signed out, or a server that is having a bad minute: the key is
        // left unknown so the next foreground asks again.
        return { kind: "none", retryIn: RETRY_GROUNDING_MS, spentRemote: true };
    }
    if (sent === null) {
        return { kind: "withdrawn" };
    }
    const { groundedLookup, result } = sent;
    if (result.domain != null) {
        return { domain: result.domain, kind: "domain", spentRemote: true };
    }
    if (result.grounding === true) {
        return { kind: "none", retryIn: RETRY_GROUNDING_MS, spentRemote: true };
    }
    // A classified name with no domain is a real miss, when the web search was
    // allowed to run. The all-null shape never is: it is also what a
    // signed-out, rate-limited or failed call answers.
    const definitive = result.categoryName !== null && groundedLookup;
    return {
        kind: "none",
        retryIn: definitive ? RETRY_MISS_MS : RETRY_INDETERMINATE_MS,
        spentRemote: true,
    };
}

/**
 * Gives a logo to every recent row that was saved without one — a Wallet
 * purchase committed by the drain, or a form saved before the grounded search
 * had an answer. Answers how many rows were painted.
 *
 * Runs after the queue drains and whenever the app comes back to the
 * foreground; it is idempotent and cheap when there is nothing to do, since a
 * row with an image no longer matches the query.
 */
export async function attachMissingLogos(db: Database, deps: LogoBackfillDeps): Promise<number> {
    const now = deps.now ?? Date.now();
    const pending = await pendingGroups(db, now);
    const retryAfter = await readRetryDeadlines(db, now);
    // Names never tried go first, then the ones whose deadline passed longest
    // ago; otherwise the newest rows' misses would take the budget every pass
    // and an older row could age out of the window without ever being asked.
    const groups = pending
        .filter((group) => (retryAfter.get(group.id) ?? 0) <= now)
        .sort((a, b) => (retryAfter.get(a.id) ?? 0) - (retryAfter.get(b.id) ?? 0));
    let remoteLeft = REMOTE_BUDGET;
    let fetchesLeft = FETCH_LIMIT;
    let painted = 0;

    /* oxlint-disable no-await-in-loop -- the remote and fetch budgets are running counts, so the groups have to be resolved one at a time */
    for (const group of groups) {
        if (fetchesLeft <= 0 || deps.cancelled?.()) {
            break;
        }
        if (!(await stillPending(db, group))) {
            continue;
        }
        // The re-read awaited; a cancel that landed during it sends nothing.
        if (deps.cancelled?.()) {
            break;
        }
        const answer = await resolveDomain(group, deps, remoteLeft);
        if (answer.kind === "withdrawn") {
            break;
        }
        if (answer.kind === "later") {
            continue;
        }
        if (answer.spentRemote) {
            remoteLeft -= 1;
        }
        if (answer.kind === "none") {
            retryAfter.set(group.id, now + answer.retryIn);
            continue;
        }
        // The domain may have arrived after the last row it was for moved, or
        // after a cancel: no request goes out on it either way. The cancel is
        // checked last, right before the request, since the re-read awaits.
        if (!(await stillPending(db, group))) {
            continue;
        }
        if (deps.cancelled?.()) {
            break;
        }
        fetchesLeft -= 1;
        const outcome = await deps.fetchImage({ domain: answer.domain, name: group.note.trim() });
        if (outcome.kind !== "logo") {
            // "none" covers a timeout and an offline device as well as a real
            // miss; the logo cache remembers the real ones itself, so asking
            // again soon costs nothing when it was and works when it was not.
            retryAfter.set(group.id, now + RETRY_INDETERMINATE_MS);
            continue;
        }
        // One file per row, as the import does: a photo is owned by the row
        // that names it, so deleting one row can never orphan another's image
        // and the uploader sees one object per row rather than one shared path.
        for (const row of group.rows) {
            if (deps.cancelled?.()) {
                break;
            }
            let logo: { imageColor: string | null; imageUri: string };
            try {
                logo = await deps.persist(outcome.bytes);
            } catch {
                continue;
            }
            // A file only the row was going to name is removed if the row did
            // not take it — the row moved, the pass was cancelled under it, or
            // the write itself failed (a connection closing under a reset).
            let took = 0;
            try {
                took = deps.cancelled?.() ? 0 : await paintRow(db, row, logo);
            } catch (error) {
                deps.discard?.(logo.imageUri);
                throw error;
            }
            if (took === 0) {
                deps.discard?.(logo.imageUri);
            }
            painted += took;
        }
    }
    /* oxlint-enable no-await-in-loop */

    if (!deps.cancelled?.()) {
        await writeRetryDeadlines(db, retryAfter);
    }
    return painted;
}
