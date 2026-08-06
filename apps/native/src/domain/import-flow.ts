import type { ParsedImportFile } from "@/data/transfer-core";
import type {
	MappingDraft,
	MappingGap,
	ResolvedMapping,
} from "./import-mapping";
import type { ImportSourceId } from "./import-sources";

export type ImportStep = "source" | "file" | "resolve" | "review" | "done";
export type ResolutionOutcome = "applied" | "unavailable" | "declined";
export type UnavailableReason =
	| "offline"
	| "timeout"
	| "rateLimited"
	| "providerError"
	| "notConfigured"
	| "invalidResponse"
	| "overCap"
	| "unauthenticated";

export interface ImportResolution {
	outcome: ResolutionOutcome;
	reason: UnavailableReason | null;
	links: ReadonlyMap<string, string>;
	fromModel: ReadonlySet<string>;
}

export type ImportCommitState =
	| { phase: "idle" }
	| { phase: "writing" }
	| { phase: "failed"; detail: string | null }
	| {
			phase: "success";
			count: number;
			outAmount: number;
			duplicatesSkipped: number;
	  };

export interface ImportFlowState {
	sourceId: ImportSourceId | null;
	file: { name: string; chars: number } | null;
	parsed: ParsedImportFile | null;
	draft: MappingDraft | null;
	resolved: ResolvedMapping | null;
	mappingGaps: readonly MappingGap[];
	resolution: ImportResolution | null;
	excluded: ReadonlySet<number>;
	duplicates: ReadonlySet<number>;
	commit: ImportCommitState;
}

export const INITIAL_IMPORT_FLOW_STATE: ImportFlowState = {
	sourceId: null,
	file: null,
	parsed: null,
	draft: null,
	resolved: null,
	mappingGaps: [],
	resolution: null,
	excluded: new Set(),
	duplicates: new Set(),
	commit: { phase: "idle" },
};

export type ImportFlowEvent =
	| { type: "sourceSelected"; sourceId: ImportSourceId }
	| {
			type: "fileParsed";
			file: { name: string; chars: number };
			parsed: ParsedImportFile;
			draft: MappingDraft;
			resolved: ResolvedMapping | null;
			gaps: readonly MappingGap[];
	  }
	| {
			type: "resolutionSettled";
			outcome: ResolutionOutcome;
			reason: UnavailableReason | null;
			links: ReadonlyMap<string, string>;
			fromModel: ReadonlySet<string>;
	  }
	| { type: "rowToggled"; index: number }
	| { type: "duplicatesFlagged"; indices: ReadonlySet<number> }
	| { type: "commitStarted" }
	| { type: "commitFailed"; detail: string | null }
	| {
			type: "commitSucceeded";
			count: number;
			outAmount: number;
			duplicatesSkipped: number;
	  };

export function importFlowReducer(
	state: ImportFlowState,
	event: ImportFlowEvent,
): ImportFlowState {
	switch (event.type) {
		case "sourceSelected": {
			if (state.sourceId === event.sourceId) {
				return state;
			}
			return { ...INITIAL_IMPORT_FLOW_STATE, sourceId: event.sourceId };
		}

		case "fileParsed": {
			if (state.sourceId == null) {
				return state;
			}
			return {
				...state,
				file: event.file,
				parsed: event.parsed,
				draft: event.draft,
				resolved: event.resolved,
				mappingGaps: event.gaps,
				resolution: null,
				excluded: new Set(),
				duplicates: new Set(),
				commit: { phase: "idle" },
			};
		}

		case "resolutionSettled": {
			if (state.resolved == null) {
				return state;
			}
			return {
				...state,
				resolution: {
					outcome: event.outcome,
					reason: event.reason,
					links: event.links,
					fromModel: event.fromModel,
				},
				excluded: new Set(),
				duplicates: new Set(),
				commit: { phase: "idle" },
			};
		}

		case "rowToggled": {
			if (state.resolution == null) {
				return state;
			}
			const excluded = new Set(state.excluded);
			if (excluded.has(event.index)) {
				excluded.delete(event.index);
			} else {
				excluded.add(event.index);
			}
			return { ...state, excluded };
		}

		case "duplicatesFlagged": {
			if (state.resolution == null) {
				return state;
			}
			return {
				...state,
				duplicates: event.indices,
				excluded: new Set(event.indices),
			};
		}

		case "commitStarted": {
			if (state.resolution == null) {
				return state;
			}
			return { ...state, commit: { phase: "writing" } };
		}

		case "commitFailed": {
			if (state.resolution == null) {
				return state;
			}
			return { ...state, commit: { phase: "failed", detail: event.detail } };
		}

		case "commitSucceeded": {
			if (state.resolution == null) {
				return state;
			}
			return {
				...state,
				commit: {
					phase: "success",
					count: event.count,
					outAmount: event.outAmount,
					duplicatesSkipped: event.duplicatesSkipped,
				},
			};
		}

		default:
			return state;
	}
}

export const IMPORT_STEPS = [
	"source",
	"file",
	"resolve",
	"review",
	"done",
] as const;

export function canAdvance(state: ImportFlowState, step: ImportStep): boolean {
	switch (step) {
		case "source":
			return state.sourceId != null;
		case "file":
			return state.resolved != null;
		case "resolve":
			return state.resolution != null;
		case "review":
			return state.commit.phase === "success";
		default:
			return false;
	}
}
