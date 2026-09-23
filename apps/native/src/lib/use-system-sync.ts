import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";

import { getMeta, META_KEYS, setMeta } from "@/data/app-meta-core";
import { backfillBudgetUsd, backfillCanonicalUsd, stampLedgerCurrency } from "@/data/canonicalize-backfill";
import { settlePendingFees } from "@/data/card-fees-core";
import { drainPendingWrites } from "@/data/pending-writes-core";
import { pullRatesIfDue } from "@/data/rates";
import type { Database } from "@/db/client";
import { ratesPuller } from "@/lib/convex";
import { armLogoBackfill, backfillLogos } from "@/lib/logo-backfill";
import { publishWidgets } from "@/widgets/publish";

import { indexSpotlight } from "./spotlight";
import { affectsSpotlight, affectsWidgets, debounce, PUBLISH_DEBOUNCE_MS, SPOTLIGHT_DEBOUNCE_MS } from "./sync-cadence";
import { claimPendingWrites, readWalletLastRun, releasePendingWrites } from "./widget-bridge";

/**
 * Keeps the widget tiles and the Spotlight index current, each on its own
 * cadence — see `sync-cadence.ts` for which tables reach which surface and why
 * the index trails the tiles so far.
 *
 * `db` is nullable so this can be called before the database is open, matching
 * `useRecurrenceSweep`.
 */
export function useSystemSync(db: Database | null): void {
    useEffect(() => {
        if (db == null) {
            return;
        }
        armLogoBackfill(db);

        const publish = debounce(PUBLISH_DEBOUNCE_MS, () => {
            publishWidgets(db);
        });
        const reindex = debounce(SPOTLIGHT_DEBOUNCE_MS, () => {
            indexSpotlight(db);
        });

        // Applying the queue writes rows, which trips the change listener below and
        // publishes on its own — so this deliberately does not publish itself.
        // The logo pass runs after the drain so a Wallet purchase that just landed
        // is in the set it reads.
        const catchUp = () => {
            mirrorWalletRun(db).catch((error) => {
                console.warn("[outlayr] wallet run stamp failed", error);
            });
            drainPendingWrites(db, claimPendingWrites, releasePendingWrites)
                .then((applied) => {
                    if (applied === 0) {
                        publish.schedule();
                    }
                })
                .catch((error) => {
                    console.warn("[outlayr] pending writes failed to apply", error);
                    publish.schedule();
                })
                .then(() => backfillLogos(db))
                .catch((error) => {
                    console.warn("[outlayr] logo backfill failed", error);
                });
        };

        catchUp();
        indexSpotlight(db);
        // Republished explicitly, because the listener below does not cover it: a
        // refresh opens with an unqualified `DELETE FROM exchangeRates`, and SQLite's
        // truncate optimization exempts that statement from the update hook the
        // listener is built on (expo-sqlite's vendored `sqlite3.h:7090-7095`). Adding
        // exchangeRates to the watched set was tried and does not fix it; this call
        // is what keeps the tiles honest after a refresh.
        refreshRates(db).then((changed) => {
            if (changed) {
                publish.schedule();
            }
        });

        const listener = addDatabaseChangeListener((event) => {
            if (affectsWidgets(event.tableName)) {
                publish.schedule();
            }
            if (affectsSpotlight(event.tableName)) {
                reindex.schedule();
            }
        });

        const subscription = AppState.addEventListener("change", (state) => {
            // Background is the last moment the app can guarantee the tile behind it
            // is current.
            if (state === "active") {
                catchUp();
                refreshRates(db).then((changed) => {
                    if (changed) {
                        publish.schedule();
                    }
                });
            } else if (state === "background") {
                publish.cancel();
                reindex.cancel();
                publishWidgets(db);
                indexSpotlight(db);
            }
        });

        return () => {
            publish.cancel();
            reindex.cancel();
            listener.remove();
            subscription.remove();
        };
    }, [db]);
}

/**
 * Commits what the intents queued and answers how many landed.
 *
 * The claim is released only once the whole batch is through, so a throw leaves
 * the queue file in place for the next launch instead of dropping money writes.
 * A job that can never apply is retried on every launch rather than dropped,
 * which is the trade this takes: the ledger cannot invent a row it already has
 * (`applyPendingWrites` remembers what it committed) but it can lose one nobody
 * ever writes again.
 */
async function mirrorWalletRun(db: Database): Promise<void> {
    const at = readWalletLastRun();
    if (at == null) {
        return;
    }
    const stamp = String(at);
    if ((await getMeta(db, META_KEYS.walletLastRunAt)) === stamp) {
        return;
    }
    await setMeta(db, META_KEYS.walletLastRunAt, stamp);
}

/**
 * Refreshes the local exchange-rate replica. `pullRatesIfDue` owns the 12-hour
 * throttle, and a build with no `EXPO_PUBLIC_CONVEX_URL` has no puller at all —
 * a failed or absent backend must cost nothing here.
 */
async function refreshRates(db: Database): Promise<boolean> {
    const pull = ratesPuller();
    let changed = false;
    try {
        changed = await pullRatesIfDue(db, pull);
    } catch (error) {
        console.warn("[outlayr] rate refresh failed", error);
    }
    // Before canonicalizing, so a row about to be valued already names what it
    // was kept in — canonicalization skips the ones that still do not.
    try {
        changed = (await stampLedgerCurrency(db)) > 0 || changed;
    } catch (error) {
        console.warn("[outlayr] currency stamp failed", error);
    }
    // Always, not only after a successful pull: rows can be left unvalued by an
    // entry made offline even when the cache was already fresh, and the pass is
    // a no-op when there is nothing to do.
    try {
        changed = (await backfillCanonicalUsd(db)) > 0 || changed;
        changed = (await backfillBudgetUsd(db)) > 0 || changed;
        changed = (await settlePendingFees(db)) > 0 || changed;
    } catch (error) {
        console.warn("[outlayr] canonicalization backfill failed", error);
    }
    return changed;
}
