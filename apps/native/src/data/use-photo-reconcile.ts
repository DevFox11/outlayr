import { useEffect } from "react";

import type { Database } from "@/db/client";
import { replateLogos } from "@/lib/logo-replate";
import { photoFiles } from "@/lib/photo-storage";

import { reconcilePhotos } from "./photo-store-core";

/**
 * Repairs stale photo paths and collects unreferenced files, once per launch,
 * then puts a plate under any logo stored before logos had one.
 *
 * Once, not on every foreground: unreferenced files are how a replaced or
 * cascade-deleted photo is reclaimed, and running that sweep while the user is
 * inside the app widens the window in which a picked-but-unsaved photo survives
 * only on the purge grace period.
 */
export function usePhotoReconcile(db: Database | null): void {
    useEffect(() => {
        if (db == null) {
            return;
        }
        // The logo repair matches rows by their photo's path, so it waits for the
        // reconcile to repoint the stale ones.
        reconcilePhotos(db, photoFiles, Date.now())
            .then(() => replateLogos(db))
            .catch((error) => {
                console.error("Photo reconcile failed", error);
            });
    }, [db]);
}
