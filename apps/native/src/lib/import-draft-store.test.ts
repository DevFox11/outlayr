import {
	type ImportFlowEvent,
	INITIAL_IMPORT_FLOW_STATE,
	importFlowReducer,
} from "@/domain/import-flow";
import { createImportDraftStore } from "./import-draft-store";

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
