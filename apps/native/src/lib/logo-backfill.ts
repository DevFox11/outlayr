import { File } from "expo-file-system";

import { attachMissingLogos } from "@/data/logo-backfill-core";
import type { LogoBackfillDeps } from "@/data/logo-backfill-core";
import { readBoolSetting } from "@/data/settings-core";
import type { Database } from "@/db/client";
import { firstLocale } from "@/i18n/device-language";
import { persistLogo } from "@/lib/persist-logo";

import { convex, enrichmentTransport } from "./convex";
import { fetchMerchantImage } from "./logo-fetch";

/**
 * The production wiring for `attachMissingLogos`: the same consent gates the
 * form honours (`aiEnrichment` keeps every lookup on-device, `groundedLookup`
 * is passed through for the server to re-check), the device locale, and the
 * real image and photo pipelines.
 */
/**
 * Names the database the passes of this session will run against, before
 * the first one is queued, and lifts any halt: a cancel issued while the
 * launch drain is still pending then knows which handle to refuse, and a
 * restore that cancelled and kept the same handle runs again after arming.
 */
export function armLogoBackfill(db: Database): void {
    lastDb = db;
    halted = null;
}

export function backfillLogos(db: Database): Promise<number> {
    if (db === halted) {
        return Promise.resolve(0);
    }
    lastDb = db;
    if (inFlight === null) {
        const generation = cancelGeneration;
        inFlight = runBackfill(db, () => cancelGeneration !== generation).finally(() => {
            inFlight = null;
        });
    }
    return inFlight;
}

/**
 * Stops the running pass at its next step, refuses any later pass for this
 * database, and resolves once the running one has stopped. Called before the
 * device data is erased: a pass still awaiting the model or an image would
 * otherwise write a logo into a photo directory the erase had already emptied.
 */
export async function cancelLogoBackfill(): Promise<void> {
    cancelGeneration += 1;
    halted = lastDb;
    await inFlight?.catch(() => 0);
}

/**
 * One pass at a time. A foreground event during the launch pass would
 * otherwise start a second one over the same rows, with its own model budget
 * and its own copy of every logo.
 */
let inFlight: Promise<number> | null = null;
let cancelGeneration = 0;
/**
 * The database the last pass ran against, and the one a cancel was issued
 * for. A pass queued behind the Wallet drain can arrive after the cancel
 * returned; it must not start against a database being erased. The next
 * database the app opens is a new handle, which runs again.
 */
let lastDb: Database | null = null;
let halted: Database | null = null;

export function discardLogo(imageUri: string): void {
    try {
        new File(imageUri).delete();
    } catch {
        // A file that is already gone is the outcome wanted.
    }
}

async function runBackfill(db: Database, cancelled: () => boolean): Promise<number> {
    const remoteEnabled = await readBoolSetting(db, "aiEnrichment");
    const device = firstLocale();
    const locale = device?.languageTag?.trim() || undefined;
    const regionCode = device?.regionCode?.trim() || undefined;
    const transport = convex === null || !remoteEnabled ? null : enrichmentTransport();
    const deps: LogoBackfillDeps = {
        cancelled,
        discard: discardLogo,
        enrich:
            transport === null
                ? null
                : async (args) => {
                      // Both consents are read here, at the moment of sending: the
                      // pass outlives the screen the settings are on, a name must not
                      // leave the device after consent went, nor reach the web after
                      // that consent went.
                      const [aiEnrichment, groundedLookup] = await Promise.all([
                          readBoolSetting(db, "aiEnrichment"),
                          readBoolSetting(db, "groundedLookup"),
                      ]);
                      // The reads awaited; a cancel that landed during them (the
                      // device erase) sends nothing and is not made to wait.
                      if (!aiEnrichment || cancelled()) {
                          return null;
                      }
                      const result = await transport({
                          background: true,
                          categoryTree: [],
                          currency: args.currency ?? undefined,
                          groundedLookup,
                          income: args.income,
                          locale,
                          name: args.name,
                          regionCode,
                      });
                      return { groundedLookup, result };
                  },
        fetchImage: fetchMerchantImage,
        persist: persistLogo,
    };
    return attachMissingLogos(db, deps);
}
