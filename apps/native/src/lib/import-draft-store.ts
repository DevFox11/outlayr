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
	/** True only for the first render after a resumed reopen; cleared by any dispatch/setStep. */
	resumed: boolean;
}

export interface ImportDraftSnapshot {
	flow: ImportFlowState;
	ui: ImportDraftUi;
}

export interface ImportDraftStore {
	getSnapshot(): ImportDraftSnapshot;
	subscribe(listener: () => void): () => void;
	/** Committed only by `commitDismissal`/`clear`, so this rarely changes. */
	getResumeStep(): ImportStep;
	dispatch(event: ImportFlowEvent): void;
	setStep(step: ImportStep): void;
	setFileError(error: FileStepError | null): void;
	/** Called from the sheet modal's onDismiss. */
	commitDismissal(): void;
	clear(): void;
}

const INITIAL_UI: ImportDraftUi = {
	step: "source",
	fileError: null,
	resumed: false,
};
const INITIAL_SNAPSHOT: ImportDraftSnapshot = {
	flow: INITIAL_IMPORT_FLOW_STATE,
	ui: INITIAL_UI,
};

export function isResumable(flow: ImportFlowState): boolean {
	return flow.parsed != null;
}

export function createImportDraftStore(): ImportDraftStore {
	let snapshot: ImportDraftSnapshot = INITIAL_SNAPSHOT;
	let resumeStep: ImportStep = "source";
	const listeners = new Set<() => void>();

	function commit(next: ImportDraftSnapshot) {
		snapshot = next;
		for (const listener of listeners) {
			listener();
		}
	}

	function commitResumeStep(next: ImportStep) {
		resumeStep = next;
	}

	function clear() {
		commit(INITIAL_SNAPSHOT);
		commitResumeStep("source");
	}

	function commitDismissal() {
		if (!isResumable(snapshot.flow)) {
			clear();
			return;
		}
		commitResumeStep(snapshot.ui.step);
		commit({ ...snapshot, ui: { ...snapshot.ui, resumed: true } });
	}

	return {
		getSnapshot() {
			return snapshot;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getResumeStep() {
			return resumeStep;
		},
		dispatch(event) {
			const flow = importFlowReducer(snapshot.flow, event);
			if (flow !== snapshot.flow || snapshot.ui.resumed) {
				commit({ ...snapshot, flow, ui: { ...snapshot.ui, resumed: false } });
			}
		},
		setStep(step) {
			if (step === snapshot.ui.step) {
				return;
			}
			commit({ ...snapshot, ui: { ...snapshot.ui, step, resumed: false } });
		},
		setFileError(error) {
			commit({ ...snapshot, ui: { ...snapshot.ui, fileError: error } });
		},
		commitDismissal,
		clear,
	};
}

export const importDraftStore = createImportDraftStore();

export function useImportDraft(
	store: ImportDraftStore = importDraftStore,
): ImportDraftSnapshot {
	return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
