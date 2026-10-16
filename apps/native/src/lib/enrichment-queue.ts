import { useEffect } from "react";
import { AppState } from "react-native";

import { applyEnrichmentAnswer, sendQueuedEnrichment } from "@/data/enrichment-queue-core";
import { readBoolSetting, readRemoteEnrichment } from "@/data/settings-core";
import type { Database } from "@/db/client";
import { firstLocale } from "@/i18n/device-language";
import { persistLogo } from "@/lib/persist-logo";

import {
    enrichmentQueueTransport,
    isCloudAuthenticated,
    useCloudAuthenticated,
    watchEnrichmentResults,
} from "./convex";
import { discardLogo } from "./logo-backfill";
import { fetchMerchantImage } from "./logo-fetch";

let sends: Promise<unknown> = Promise.resolve();

async function sendOnce(db: Database): Promise<number> {
    if (!isCloudAuthenticated() || !(await readRemoteEnrichment(db))) {
        return 0;
    }
    const device = firstLocale();
    return sendQueuedEnrichment(db, {
        enqueue: enrichmentQueueTransport().enqueue,
        groundedLookup: await readBoolSetting(db, "groundedLookup"),
        locale: device?.languageTag?.trim() || undefined,
        regionCode: device?.regionCode?.trim() || undefined,
    });
}

export function sendEnrichmentQueue(db: Database): void {
    sends = sends
        .then(() => sendOnce(db))
        .catch((error) => {
            console.warn("[outlayr] enrichment queue send failed", error);
        });
}

export function useEnrichmentQueue(db: Database | null): void {
    const authenticated = useCloudAuthenticated();
    useEffect(() => {
        if (db == null || !authenticated) {
            return;
        }
        let applying: Promise<unknown> = Promise.resolve();
        const stop = watchEnrichmentResults((jobs) => {
            applying = applying
                .then(async () => {
                    for (const job of jobs) {
                        try {
                            // oxlint-disable-next-line no-await-in-loop -- answers for one merchant may create the same category or tag, and `ensure*` only dedupes when they land one at a time
                            await applyEnrichmentAnswer(db, job, {
                                discard: discardLogo,
                                fetchImage: fetchMerchantImage,
                                persist: persistLogo,
                            });
                        } catch (error) {
                            console.warn("[outlayr] enrichment answer failed to apply", error);
                        }
                    }
                    await enrichmentQueueTransport().ack(jobs.map((job) => job.localId));
                })
                .catch((error) => {
                    console.warn("[outlayr] enrichment answers failed to settle", error);
                });
        });
        sendEnrichmentQueue(db);
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                sendEnrichmentQueue(db);
            }
        });
        return () => {
            stop();
            subscription.remove();
        };
    }, [db, authenticated]);
}
