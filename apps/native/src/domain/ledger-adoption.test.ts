import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ADOPTION_CHOICES,
	adoptionActions,
	adoptionPlan,
	choiceActions,
	isDestructiveChoice,
} from "./ledger-adoption";

describe("adoption plan", () => {
	it("has nothing to reconcile when neither side holds a ledger", () => {
		assert.equal(adoptionPlan("empty", "empty"), "fresh");
	});

	it("adopts a ledger built up before the account existed", () => {
		assert.equal(adoptionPlan("populated", "empty"), "adopt");
	});

	it("replaces an untouched install with the account's ledger", () => {
		assert.equal(adoptionPlan("empty", "populated"), "replace");
	});

	it("asks only when both sides hold a ledger", () => {
		assert.equal(adoptionPlan("populated", "populated"), "ask");
	});

	it("defers while the account's ledger cannot be read", () => {
		assert.equal(adoptionPlan("empty", "unknown"), "defer");
		assert.equal(adoptionPlan("populated", "unknown"), "defer");
	});
});

describe("adoption actions", () => {
	it("does nothing on a fresh pairing", () => {
		assert.deepEqual(adoptionActions("fresh"), {
			pushLocal: false,
			wipeLocal: false,
			wipeAccount: false,
		});
	});

	it("pushes and destroys nothing when adopting", () => {
		assert.deepEqual(adoptionActions("adopt"), {
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: false,
		});
	});

	it("keeps the account's ledger by discarding the local replica", () => {
		assert.deepEqual(adoptionActions("replace"), {
			pushLocal: false,
			wipeLocal: true,
			wipeAccount: false,
		});
	});

	it("has no actions of its own while the choice is unmade", () => {
		assert.equal(adoptionActions("ask"), null);
		assert.equal(adoptionActions("defer"), null);
	});
});

describe("adoption choice", () => {
	it("offers merge first, because it is the only one that keeps everything", () => {
		assert.deepEqual(ADOPTION_CHOICES, ["merge", "keep-local", "keep-account"]);
	});

	it("destroys nothing when merging", () => {
		assert.equal(isDestructiveChoice("merge"), false);
		assert.deepEqual(choiceActions("merge"), {
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: false,
		});
	});

	it("discards the account's rows to keep this device's", () => {
		assert.equal(isDestructiveChoice("keep-local"), true);
		assert.deepEqual(choiceActions("keep-local"), {
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: true,
		});
	});

	it("discards this device's rows to keep the account's", () => {
		assert.equal(isDestructiveChoice("keep-account"), true);
		assert.deepEqual(choiceActions("keep-account"), {
			pushLocal: false,
			wipeLocal: true,
			wipeAccount: false,
		});
	});

	it("never both pushes and wipes the side it is pushing from", () => {
		for (const choice of ADOPTION_CHOICES) {
			const actions = choiceActions(choice);
			assert.equal(actions.pushLocal && actions.wipeLocal, false, choice);
		}
	});
});
