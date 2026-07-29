let revision = 0;
const listeners = new Set<() => void>();

/**
 * A refresh wipes the cache with an unqualified `DELETE FROM exchangeRates`, and
 * SQLite's truncate optimization exempts exactly that statement from the update
 * hook `addDatabaseChangeListener` is built on (expo-sqlite's vendored
 * `sqlite3.h:7090-7095`). So the half of a wipe-and-replace that invalidates a
 * screen's rate table is the half no change event reports. This counter is that
 * signal, threaded through the `deps` of the hooks that read rates.
 */
export function ratesRevision(): number {
	return revision;
}

export function bumpRatesRevision(): void {
	revision += 1;
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeRatesRevision(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
