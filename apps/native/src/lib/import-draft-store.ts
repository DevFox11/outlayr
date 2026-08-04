import { useSyncExternalStore } from "react";
import {
	type ImportFlowEvent,
	type ImportFlowState,
	type ImportStep,
	INITIAL_IMPORT_FLOW_STATE,
	importFlowReducer,
} from "@/domain/import-flow";
import type { TranslationKey } from "@/i18n";

export type FileStepError =
	| { cause: "io"; key: TranslationKey }
	| { cause: "tooLarge" }
	| { cause: "empty" }
	| { cause: "noDataRows" }
	| { cause: "tooFewColumns" };

export interface ImportDraftUi {
	step: ImportStep;
	fileError: FileStepError | null;
}

export interface ImportDraftSnapshot {
	flow: ImportFlowState;
	ui: ImportDraftUi;
}

export interface ImportDraftStore {
	getSnapshot(): ImportDraftSnapshot;
	subscribe(listener: () => void): () => void;
	dispatch(event: ImportFlowEvent): void;
	setStep(step: ImportStep): void;
	setFileError(error: FileStepError | null): void;
	clear(): void;
}

const INITIAL_UI: ImportDraftUi = { step: "source", fileError: null };
const INITIAL_SNAPSHOT: ImportDraftSnapshot = {
	flow: INITIAL_IMPORT_FLOW_STATE,
	ui: INITIAL_UI,
};

/**
 * Discard-only in this slice: the draft dies with the route on every
 * dismissal path. `commitDismissal`/`resumeStep`/`isResumable` land in the
 * resume slice (design §2.1) without reshaping this factory.
 */
export function createImportDraftStore(): ImportDraftStore {
	let snapshot: ImportDraftSnapshot = INITIAL_SNAPSHOT;
	const listeners = new Set<() => void>();

	function commit(next: ImportDraftSnapshot) {
		snapshot = next;
		for (const listener of listeners) {
			listener();
		}
	}

	return {
		getSnapshot() {
			return snapshot;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		dispatch(event) {
			const flow = importFlowReducer(snapshot.flow, event);
			if (flow !== snapshot.flow) {
				commit({ ...snapshot, flow });
			}
		},
		setStep(step) {
			if (step === snapshot.ui.step) {
				return;
			}
			commit({ ...snapshot, ui: { ...snapshot.ui, step } });
		},
		setFileError(error) {
			commit({ ...snapshot, ui: { ...snapshot.ui, fileError: error } });
		},
		clear() {
			commit(INITIAL_SNAPSHOT);
		},
	};
}

export const importDraftStore = createImportDraftStore();

export function useImportDraft(
	store: ImportDraftStore = importDraftStore,
): ImportDraftSnapshot {
	return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
