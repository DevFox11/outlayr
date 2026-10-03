import { useEffect } from "react";

import type { Database } from "@/db/client";
import { photoFiles } from "@/lib/photo-storage";

import { reconcilePhotos } from "./photo-store-core";

/**
 * Repairs stale photo paths and collects unreferenced files, once per launch.
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
        reconcilePhotos(db, photoFiles, Date.now()).catch((error) => {
            console.error("Photo reconcile failed", error);
        });
    }, [db]);
}
