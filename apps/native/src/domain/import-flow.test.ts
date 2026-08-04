import type { ParsedImportFile } from "@/data/transfer-core";
import {
	canAdvance,
	IMPORT_STEPS,
	type ImportFlowEvent,
	type ImportFlowState,
	INITIAL_IMPORT_FLOW_STATE,
	importFlowReducer,
} from "./import-flow";
import type { ResolvedMapping } from "./import-mapping";
import type { ImportSourceId } from "./import-sources";

const PARSED: ParsedImportFile = {
	header: ["date", "description", "amount"],
	rows: [["2026-07-28", "Bakery", "12.50"]],
	width: 3,
};

const DRAFT = {
	category: null,
	note: 1,
	date: 0,
	amount: 2,
	currency: null,
	type: null,
};

const RESOLVED: ResolvedMapping = {
	mapping: {
		category: 1,
		note: 1,
		date: 0,
		amount: 2,
		currency: null,
		type: null,
	},
	labelSource: "descriptionColumn",
};

function dispatch(
	state: ImportFlowState,
	event: ImportFlowEvent,
): ImportFlowState {
	return importFlowReducer(state, event);
}

function withSource(): ImportFlowState {
	return dispatch(INITIAL_IMPORT_FLOW_STATE, {
		type: "sourceSelected",
		sourceId: "csv",
	});
}

function withFile(): ImportFlowState {
	return dispatch(withSource(), {
		type: "fileParsed",
		file: { name: "bank.csv", chars: 120 },
		parsed: PARSED,
		draft: DRAFT,
		resolved: RESOLVED,
		gaps: [],
	});
}

function withResolution(): ImportFlowState {
	return dispatch(withFile(), {
		type: "resolutionSettled",
		outcome: "applied",
		reason: null,
		links: new Map([["bakery", "cat-food"]]),
		fromModel: new Set(["bakery"]),
	});
}

describe("importFlowReducer — legal transitions", () => {
	it("selects a source from the initial state", () => {
		expect(withSource().sourceId).toBe("csv");
	});

	it("advances through file selection with the resolved mapping", () => {
		const state = withFile();
		expect(state.parsed).toBe(PARSED);
		expect(state.resolved).toBe(RESOLVED);
		expect(state.mappingGaps).toStrictEqual([]);
	});

	it("settles a resolution outcome after the file step", () => {
		expect(withResolution().resolution).toStrictEqual({
			outcome: "applied",
			reason: null,
			links: new Map([["bakery", "cat-food"]]),
			fromModel: new Set(["bakery"]),
		});
	});

	it("toggles a row index in and out of the excluded set", () => {
		const once = dispatch(withResolution(), { type: "rowToggled", index: 3 });
		expect(once.excluded.has(3)).toBe(true);
		const twice = dispatch(once, { type: "rowToggled", index: 3 });
		expect(twice.excluded.has(3)).toBe(false);
	});

	it("moves into the writing phase and then reports a failure with its detail", () => {
		const writing = dispatch(withResolution(), { type: "commitStarted" });
		expect(writing.commit).toStrictEqual({ phase: "writing" });
		const failed = dispatch(writing, {
			type: "commitFailed",
			detail: "disk full",
		});
		expect(failed.commit).toStrictEqual({
			phase: "failed",
			detail: "disk full",
		});
	});
});

describe("importFlowReducer — illegal transitions are no-ops", () => {
	it("ignores a file-parsed event with no source selected", () => {
		const event: ImportFlowEvent = {
			type: "fileParsed",
			file: { name: "bank.csv", chars: 10 },
			parsed: PARSED,
			draft: DRAFT,
			resolved: RESOLVED,
			gaps: [],
		};
		expect(dispatch(INITIAL_IMPORT_FLOW_STATE, event)).toBe(
			INITIAL_IMPORT_FLOW_STATE,
		);
	});

	it("ignores a resolution settling with no resolved mapping yet", () => {
		const state = withSource();
		const event: ImportFlowEvent = {
			type: "resolutionSettled",
			outcome: "applied",
			reason: null,
			links: new Map(),
			fromModel: new Set(),
		};
		expect(dispatch(state, event)).toBe(state);
	});

	it("ignores a row toggle with no resolution yet", () => {
		const state = withFile();
		expect(dispatch(state, { type: "rowToggled", index: 0 })).toBe(state);
	});

	it("ignores a commit start with no resolution yet", () => {
		const state = withFile();
		expect(dispatch(state, { type: "commitStarted" })).toBe(state);
	});

	it("ignores a commit failure with no resolution yet", () => {
		const state = withFile();
		expect(dispatch(state, { type: "commitFailed", detail: null })).toBe(state);
	});

	it("ignores an event outside its known domain, which is why a bare pop needs no dispatch at all", () => {
		const state = withResolution();
		const unknown = { type: "popped" } as unknown as ImportFlowEvent;
		expect(dispatch(state, unknown)).toBe(state);
	});

	it("selecting the same source again changes nothing", () => {
		const state = withSource();
		expect(dispatch(state, { type: "sourceSelected", sourceId: "csv" })).toBe(
			state,
		);
	});
});

describe("importFlowReducer — invalidation cascade", () => {
	it("selecting a different source clears everything downstream", () => {
		const populated = dispatch(
			dispatch(withResolution(), { type: "rowToggled", index: 0 }),
			{ type: "commitStarted" },
		);
		const otherId = "ofx" as unknown as ImportSourceId;
		const reset = dispatch(populated, {
			type: "sourceSelected",
			sourceId: otherId,
		});
		expect(reset).toStrictEqual({
			...INITIAL_IMPORT_FLOW_STATE,
			sourceId: otherId,
		});
	});

	it("clears the prior resolution, exclusions and commit state on a new file", () => {
		const populated = dispatch(
			dispatch(withResolution(), { type: "rowToggled", index: 0 }),
			{ type: "commitStarted" },
		);
		const reparsed = dispatch(populated, {
			type: "fileParsed",
			file: { name: "other.csv", chars: 50 },
			parsed: PARSED,
			draft: DRAFT,
			resolved: RESOLVED,
			gaps: [],
		});
		expect(reparsed.resolution).toBe(null);
		expect(reparsed.excluded.size).toBe(0);
		expect(reparsed.commit).toStrictEqual({ phase: "idle" });
	});

	it("clears exclusions and commit state, but keeps the mapping, when a resolution re-settles", () => {
		const excludedAndWriting = dispatch(
			dispatch(withResolution(), { type: "rowToggled", index: 0 }),
			{ type: "commitStarted" },
		);
		const resettled = dispatch(excludedAndWriting, {
			type: "resolutionSettled",
			outcome: "unavailable",
			reason: "timeout",
			links: new Map(),
			fromModel: new Set(),
		});
		expect(resettled.excluded.size).toBe(0);
		expect(resettled.commit).toStrictEqual({ phase: "idle" });
		expect(resettled.resolved).toBe(RESOLVED);
	});

	it("toggling a row changes nothing else in state", () => {
		const state = withResolution();
		const toggled = dispatch(state, { type: "rowToggled", index: 5 });
		expect(toggled.resolution).toBe(state.resolution);
		expect(toggled.resolved).toBe(state.resolved);
		expect(toggled.commit).toBe(state.commit);
	});

	it("preserves the excluded set when a commit fails", () => {
		const excluded = dispatch(withResolution(), {
			type: "rowToggled",
			index: 2,
		});
		const writing = dispatch(excluded, { type: "commitStarted" });
		const failed = dispatch(writing, {
			type: "commitFailed",
			detail: "write error",
		});
		expect(failed.excluded).toBe(excluded.excluded);
	});
});

describe("IMPORT_STEPS", () => {
	it("orders all four steps the sheet serves, review last", () => {
		expect(IMPORT_STEPS).toStrictEqual(["source", "file", "resolve", "review"]);
	});
});

describe("duplicatesFlagged", () => {
	it("flags the given indices and excludes them by default", () => {
		const state = withResolution();
		const flagged = dispatch(state, {
			type: "duplicatesFlagged",
			indices: new Set([0, 2]),
		});
		expect(flagged.duplicates).toStrictEqual(new Set([0, 2]));
		expect(flagged.excluded).toStrictEqual(new Set([0, 2]));
	});

	it("overwrites any prior manual exclusions with the flagged set", () => {
		const toggled = dispatch(withResolution(), {
			type: "rowToggled",
			index: 5,
		});
		const flagged = dispatch(toggled, {
			type: "duplicatesFlagged",
			indices: new Set([1]),
		});
		expect(flagged.excluded).toStrictEqual(new Set([1]));
	});

	it("is a no-op with no settled resolution yet", () => {
		const state = withFile();
		const flagged = dispatch(state, {
			type: "duplicatesFlagged",
			indices: new Set([0]),
		});
		expect(flagged).toBe(state);
	});
});

describe("duplicates reset on invalidation", () => {
	it("clears duplicates alongside exclusions on a new file", () => {
		const flagged = dispatch(withResolution(), {
			type: "duplicatesFlagged",
			indices: new Set([0]),
		});
		const reparsed = dispatch(flagged, {
			type: "fileParsed",
			file: { name: "other.csv", chars: 50 },
			parsed: PARSED,
			draft: DRAFT,
			resolved: RESOLVED,
			gaps: [],
		});
		expect(reparsed.duplicates.size).toBe(0);
	});

	it("clears duplicates alongside exclusions when a resolution re-settles", () => {
		const flagged = dispatch(withResolution(), {
			type: "duplicatesFlagged",
			indices: new Set([0]),
		});
		const resettled = dispatch(flagged, {
			type: "resolutionSettled",
			outcome: "unavailable",
			reason: "timeout",
			links: new Map(),
			fromModel: new Set(),
		});
		expect(resettled.duplicates.size).toBe(0);
	});

	it("preserves duplicates when a commit fails", () => {
		const flagged = dispatch(withResolution(), {
			type: "duplicatesFlagged",
			indices: new Set([0]),
		});
		const writing = dispatch(flagged, { type: "commitStarted" });
		const failed = dispatch(writing, {
			type: "commitFailed",
			detail: "write error",
		});
		expect(failed.duplicates).toBe(flagged.duplicates);
	});
});

describe("canAdvance", () => {
	it("cannot advance past source with no source selected", () => {
		expect(canAdvance(INITIAL_IMPORT_FLOW_STATE, "source")).toBe(false);
	});

	it("can advance past source once one is selected", () => {
		expect(canAdvance(withSource(), "source")).toBe(true);
	});

	it("cannot advance past file with no resolved mapping", () => {
		expect(canAdvance(withSource(), "file")).toBe(false);
	});

	it("can advance past file once the mapping resolved", () => {
		expect(canAdvance(withFile(), "file")).toBe(true);
	});

	it("cannot advance past resolve with no settled resolution", () => {
		expect(canAdvance(withFile(), "resolve")).toBe(false);
	});

	it("can advance past resolve once it settles", () => {
		expect(canAdvance(withResolution(), "resolve")).toBe(true);
	});

	it("can always advance past review", () => {
		expect(canAdvance(INITIAL_IMPORT_FLOW_STATE, "review")).toBe(true);
	});
});
