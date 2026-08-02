import {
	ADOPTION_CHOICES,
	adoptionActions,
	adoptionPlan,
	choiceActions,
	isDestructiveChoice,
} from "./ledger-adoption";

describe("adoption plan", () => {
	it("has nothing to reconcile when neither side holds a ledger", () => {
		expect(adoptionPlan("empty", "empty")).toBe("fresh");
	});

	it("adopts a ledger built up before the account existed", () => {
		expect(adoptionPlan("populated", "empty")).toBe("adopt");
	});

	it("replaces an untouched install with the account's ledger", () => {
		expect(adoptionPlan("empty", "populated")).toBe("replace");
	});

	it("asks only when both sides hold a ledger", () => {
		expect(adoptionPlan("populated", "populated")).toBe("ask");
	});

	it("defers while the account's ledger cannot be read", () => {
		expect(adoptionPlan("empty", "unknown")).toBe("defer");
		expect(adoptionPlan("populated", "unknown")).toBe("defer");
	});
});

describe("adoption actions", () => {
	it("does nothing on a fresh pairing", () => {
		expect(adoptionActions("fresh")).toStrictEqual({
			pushLocal: false,
			wipeLocal: false,
			wipeAccount: false,
		});
	});

	it("pushes and destroys nothing when adopting", () => {
		expect(adoptionActions("adopt")).toStrictEqual({
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: false,
		});
	});

	it("keeps the account's ledger by discarding the local replica", () => {
		expect(adoptionActions("replace")).toStrictEqual({
			pushLocal: false,
			wipeLocal: true,
			wipeAccount: false,
		});
	});

	it("has no actions of its own while the choice is unmade", () => {
		expect(adoptionActions("ask")).toBe(null);
		expect(adoptionActions("defer")).toBe(null);
	});
});

describe("adoption choice", () => {
	it("offers merge first, because it is the only one that keeps everything", () => {
		expect(ADOPTION_CHOICES).toStrictEqual([
			"merge",
			"keep-local",
			"keep-account",
		]);
	});

	it("destroys nothing when merging", () => {
		expect(isDestructiveChoice("merge")).toBe(false);
		expect(choiceActions("merge")).toStrictEqual({
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: false,
		});
	});

	it("discards the account's rows to keep this device's", () => {
		expect(isDestructiveChoice("keep-local")).toBe(true);
		expect(choiceActions("keep-local")).toStrictEqual({
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: true,
		});
	});

	it("discards this device's rows to keep the account's", () => {
		expect(isDestructiveChoice("keep-account")).toBe(true);
		expect(choiceActions("keep-account")).toStrictEqual({
			pushLocal: false,
			wipeLocal: true,
			wipeAccount: false,
		});
	});

	it("never both pushes and wipes the side it is pushing from", () => {
		for (const choice of ADOPTION_CHOICES) {
			const actions = choiceActions(choice);
			expect(actions.pushLocal && actions.wipeLocal).toBe(false);
		}
	});
});
