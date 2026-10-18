import { useEffect } from "react";
import { AppState } from "react-native";

import type { Database } from "@/db/client";

/**
 * Runs `sweep` once `db` is given and again every time the app returns to the
 * foreground. `BackgroundWork` passes null until the first idle frame, so the
 * launch pass never competes with the first render.
 *
 * The daily reminder reconciles against whatever iOS did while the process was
 * suspended, so "now, and whenever we are back" is its whole schedule. The
 * `catch` logs and swallows: a failed sweep must not take the screen with it,
 * because the next foreground tries again.
 *
 * `sweep` is a module-level function rather than a closure so that the effect's
 * dependencies stay honest — a fresh closure per render would tear the listener
 * down and re-run the pass on every render.
 */
export function useForegroundSweep(db: Database | null, sweep: (db: Database) => Promise<void>, label: string): void {
    useEffect(() => {
        if (db == null) {
            return;
        }

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
