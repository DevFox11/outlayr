import { act, renderHook } from "@testing-library/react-native";
import { useSyncExternalStore } from "react";
import type { ParsedImportFile } from "@/data/transfer-core";
import {
	type ImportFlowEvent,
	INITIAL_IMPORT_FLOW_STATE,
	importFlowReducer,
} from "@/domain/import-flow";
import type { MappingDraft } from "@/domain/import-mapping";
import { createImportDraftStore, isResumable } from "./import-draft-store";

const PARSED: ParsedImportFile = {
	header: ["date", "description", "amount"],
	rows: [["01/08/2026", "Coffee", "3,50"]],
	width: 3,
};

const DRAFT: MappingDraft = {
	category: null,
	note: 1,
	date: 0,
	amount: 2,
	currency: null,
	type: null,
};

function dispatchFileParsed(store: ReturnType<typeof createImportDraftStore>) {
	store.dispatch({
		type: "fileParsed",
		file: { name: "bank.csv", chars: 42 },
		parsed: PARSED,
		draft: DRAFT,
		resolved: null,
		gaps: ["noAmount"],
	});
}

describe("createImportDraftStore", () => {
	it("delegates dispatch to importFlowReducer verbatim", () => {
		const store = createImportDraftStore();
		const event: ImportFlowEvent = { type: "sourceSelected", sourceId: "csv" };
		const expected = importFlowReducer(INITIAL_IMPORT_FLOW_STATE, event);

		store.dispatch(event);

		expect(store.getSnapshot().flow).toStrictEqual(expected);
	});

	it("keeps getSnapshot identity stable across reads with no write between", () => {
		const store = createImportDraftStore();
		const first = store.getSnapshot();
		const second = store.getSnapshot();
		expect(first).toBe(second);
	});

	it("setStep updates ui.step and changes the snapshot identity", () => {
		const store = createImportDraftStore();
		const before = store.getSnapshot();

		store.setStep("file");

		expect(store.getSnapshot().ui.step).toBe("file");
		expect(store.getSnapshot()).not.toBe(before);
	});

	it("clear resets flow to INITIAL and ui.step to source", () => {
		const store = createImportDraftStore();
		store.dispatch({ type: "sourceSelected", sourceId: "csv" });
		store.setStep("file");
		store.setFileError({ cause: "empty" });

		store.clear();

		expect(store.getSnapshot().flow).toStrictEqual(INITIAL_IMPORT_FLOW_STATE);
		expect(store.getSnapshot().ui.step).toBe("source");
		expect(store.getSnapshot().ui.fileError).toBeNull();
	});

	it("notifies subscribers on dispatch and stops after unsubscribe", () => {
		const store = createImportDraftStore();
		const listener = jest.fn();
		const unsubscribe = store.subscribe(listener);

		store.dispatch({ type: "sourceSelected", sourceId: "csv" });
		expect(listener).toHaveBeenCalledTimes(1);

		unsubscribe();
		store.setStep("file");
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe("isResumable", () => {
	it("is true once and only once a file has been parsed", () => {
		expect(isResumable(INITIAL_IMPORT_FLOW_STATE)).toBe(false);
		expect(isResumable({ ...INITIAL_IMPORT_FLOW_STATE, parsed: PARSED })).toBe(
			true,
		);
	});
});

describe("commitDismissal", () => {
	it("clears the draft when the flow is not resumable (no file parsed yet)", () => {
		const store = createImportDraftStore();
		store.dispatch({ type: "sourceSelected", sourceId: "csv" });
		store.setStep("file");

		store.commitDismissal();

		expect(store.getSnapshot().flow).toStrictEqual(INITIAL_IMPORT_FLOW_STATE);
		expect(store.getSnapshot().ui.step).toBe("source");
		expect(store.getResumeStep()).toBe("source");
	});

	it("preserves the draft and marks it resumed at the current step when the flow is resumable", () => {
		const store = createImportDraftStore();
		store.dispatch({ type: "sourceSelected", sourceId: "csv" });
		dispatchFileParsed(store);
		store.setStep("resolve");

		store.commitDismissal();

		expect(store.getSnapshot().flow.sourceId).toBe("csv");
		expect(store.getSnapshot().flow.parsed).toStrictEqual(PARSED);
		expect(store.getSnapshot().ui.step).toBe("resolve");
		expect(store.getSnapshot().ui.resumed).toBe(true);
		expect(store.getResumeStep()).toBe("resolve");
	});
});

describe("clearing ui.resumed", () => {
	it("dispatch clears ui.resumed, even for an event the reducer treats as a no-op", () => {
		const store = createImportDraftStore();
		store.dispatch({ type: "sourceSelected", sourceId: "csv" });
		dispatchFileParsed(store);
		store.setStep("resolve");
		store.commitDismissal();
		expect(store.getSnapshot().ui.resumed).toBe(true);

		store.dispatch({ type: "rowToggled", index: 0 });

		expect(store.getSnapshot().ui.resumed).toBe(false);
	});

	it("setStep clears ui.resumed, even when called with the already-current step", () => {
		const store = createImportDraftStore();
		store.dispatch({ type: "sourceSelected", sourceId: "csv" });
		dispatchFileParsed(store);
		store.setStep("resolve");
		store.commitDismissal();
		expect(store.getSnapshot().ui.resumed).toBe(true);

		store.setStep("resolve");

		expect(store.getSnapshot().ui.resumed).toBe(false);
	});
});

describe("resume subscription minimizes root re-renders", () => {
	it("does not notify subscribeResume for dispatch/setStep, only for a resumeStep change from commitDismissal", async () => {
		const store = createImportDraftStore();
		let renders = 0;
		const { result } = await renderHook(() => {
			renders += 1;
			return useSyncExternalStore(store.subscribeResume, store.getResumeStep);
		});
		const rendersAfterMount = renders;

		await act(async () => {
			store.dispatch({ type: "sourceSelected", sourceId: "csv" });
			store.setStep("file");
		});
		expect(renders).toBe(rendersAfterMount);

		dispatchFileParsed(store);
		store.setStep("resolve");

		await act(async () => {
			store.commitDismissal();
		});

		expect(result.current).toBe("resolve");
		expect(renders).toBe(rendersAfterMount + 1);
	});
});
