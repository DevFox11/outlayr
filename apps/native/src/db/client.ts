import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

const DATABASE_NAME = "outlayr.db";

/**
 * `enableChangeListener` is what powers `useLiveQuery`. Migrations are NOT run
 * here — `LocalDataProvider` awaits `migrate(db, bundle)` right after this
 * resolves.
 */
export function openDatabase() {
	const sqlite = openDatabaseSync(DATABASE_NAME, {
		enableChangeListener: true,
	});

	// WAL lets readers and writers proceed without blocking each other. That
	// matters here because several `useLiveQuery` subscriptions re-run their
	// SELECT on every write, so the default rollback journal serialises them
	// against the write that woke them. Re-declaring WAL is a no-op.
	sqlite.execSync("PRAGMA journal_mode = WAL");

	// The schema declares `references(...)` with `onDelete: "cascade"`, but SQLite
	// ignores those unless foreign keys are switched on per connection — so today
	// they are documentation and `categoriesRepo.remove` cascades by hand.
	// Enabling enforcement retroactively would fail any write touching a row that
	// is already orphaned, so only turn it on for a store that checks out clean.
	const orphans = sqlite.getAllSync("PRAGMA foreign_key_check");
	if (orphans.length === 0) {
		sqlite.execSync("PRAGMA foreign_keys = ON");
	} else {
		console.warn(
			`[db] ${orphans.length} orphaned row(s) found — leaving foreign_keys off. ` +
				"The declared cascades stay inert until these are cleaned up."
		);
	}

	return drizzle(sqlite, { schema });
}

export type Database = ReturnType<typeof openDatabase>;
