import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useMemo, useState } from "react";

import { bootstrapLocalData } from "@/data/bootstrap";
import { settleLegacyOnboarding } from "@/data/onboarding-core";
import { usePhotoReconcile } from "@/data/use-photo-reconcile";
import { usePhotoSync } from "@/data/use-photo-sync";
import { useRecurrenceSweep } from "@/data/use-recurrence-sweep";
import { useSyncEngine } from "@/data/use-sync-engine";
import { type Database, openDatabase } from "@/db/client";
import { useSystemSync } from "@/lib/use-system-sync";
import migrationsBundle from "../../drizzle/migrations";

export type LocalDataStatus =
	| "opening"
	| "migrating"
	| "seeding"
	| "ready"
	| "error";

export interface LocalDataContextValue {
	db: Database | null;
	status: LocalDataStatus;
	error: Error | null;
	/** Re-runs the whole open → migrate → seed sequence, not just the failed step. */
	retry: () => void;
}

const LocalDataContext = createContext<LocalDataContextValue | null>(null);

export function useLocalData(): LocalDataContextValue {
	const value = use(LocalDataContext);
	if (!value) {
		throw new Error("useLocalData must be used within LocalDataProvider");
	}
	return value;
}

/**
 * The root layout holds the splash until `status === "ready"`, so anything
 * mounted below it reads an open, migrated and seeded file. A throw here means
 * the splash gate was bypassed, not that the data is merely late.
 */
export function useDatabase(): Database {
	const { db } = useLocalData();
	if (db == null) {
		throw new Error(
			"useDatabase was called outside the root splash gate — the local database is not ready yet",
		);
	}
	return db;
}

/**
 * `ready` means open AND migrated AND seeded — the root layout holds the splash
 * on it, so no screen ever observes a half-built database.
 */
export function LocalDataProvider({ children }: { children: ReactNode }) {
	const [db, setDb] = useState<Database | null>(null);
	const [status, setStatus] = useState<LocalDataStatus>("opening");
	const [error, setError] = useState<Error | null>(null);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				setError(null);
				setStatus("opening");
				const database = openDatabase();
				if (cancelled) {
					return;
				}
				setStatus("migrating");
				await migrate(database, migrationsBundle);
				if (cancelled) {
					return;
				}
				setStatus("seeding");
				await bootstrapLocalData(database);
				if (cancelled) {
					return;
				}
				// Ahead of `setDb`/`ready`, so the onboarding guard's first evaluation
				// already reads post-backfill appMeta — no third "unknown" gate state.
				await settleLegacyOnboarding(database);
				if (cancelled) {
					return;
				}
				setDb(database);
				setStatus("ready");
			} catch (caught) {
				if (cancelled) {
					return;
				}
				setError(caught instanceof Error ? caught : new Error(String(caught)));
				setStatus("error");
			}
		})();

		return () => {
			cancelled = true;
		};
		// `attempt` is the whole point of this dependency: bumping it is what re-runs
		// open → migrate → seed after a failure. Nothing else may re-trigger it.
	}, [attempt]);

	useRecurrenceSweep(db);
	// Ordered after the sweep so a subscription that advanced on this foreground
	// is already in the table when the widgets are rebuilt from it.
	useSystemSync(db);
	// Inert until the sign-in flow opens the device-local sync gate.
	useSyncEngine(db);
	usePhotoReconcile(db);
	// After the reconciliation, which owns whether a row's path still resolves —
	// running first would upload against paths it is about to repair.
	usePhotoSync(db);

	const value = useMemo<LocalDataContextValue>(
		() => ({
			db,
			status,
			error,
			retry: () => {
				setAttempt((n) => n + 1);
			},
		}),
		[db, status, error],
	);

	return (
		<LocalDataContext.Provider value={value}>
			{children}
		</LocalDataContext.Provider>
	);
}
