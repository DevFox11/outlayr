import type { Database } from "@/db/client";
import type { LocalDataStatus } from "./local-data-context";

export interface LocalDataState {
	attempt: number;
	db: Database | null;
	error: Error | null;
	status: LocalDataStatus;
}

/**
 * A reopen is a single state transition: no render may keep the `ready` promise
 * after its database has been released for a device erase.
 */
export function reopenLocalData(state: LocalDataState): LocalDataState {
	return { ...state, attempt: state.attempt + 1, db: null, error: null, status: "opening" };
}
