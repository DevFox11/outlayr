import { useEffect } from "react";
import { AppState } from "react-native";

import type { Database } from "@/db/client";

/**
 * Runs `sweep` on mount and again every time the app returns to the foreground.
 *
 * The reminder passes reconcile against whatever iOS did while the process was
 * suspended, so "now, and whenever we are back" is their whole schedule. Both of
 * them wrote this out identically, down to the `catch` that logs and swallows: a
 * failed sweep must not take the screen with it, because the next foreground
 * tries again.
 *
 * `sweep` is a module-level function rather than a closure so that the effect's
 * dependencies stay honest — a fresh closure per render would tear the listener
 * down and re-run the pass on every render.
 */
export function useForegroundSweep(db: Database, sweep: (db: Database) => Promise<void>, label: string): void {
    useEffect(() => {
        const run = () => {
            sweep(db).catch((error) => {
                console.error(`${label} failed`, error);
            });
        };

        run();
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                run();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [db, sweep, label]);
}
