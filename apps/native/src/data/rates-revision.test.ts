import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	bumpRatesRevision,
	ratesRevision,
	subscribeRatesRevision,
} from "./rates-revision";

describe("rates revision", () => {
	it("advances on every bump", () => {
		const before = ratesRevision();
		bumpRatesRevision();
		bumpRatesRevision();
		assert.equal(ratesRevision(), before + 2);
	});

	it("notifies a subscriber", () => {
		let seen = 0;
		const unsubscribe = subscribeRatesRevision(() => {
			seen += 1;
		});
		bumpRatesRevision();
		unsubscribe();
		assert.equal(seen, 1);
	});

	it("stops notifying once unsubscribed", () => {
		let seen = 0;
		const unsubscribe = subscribeRatesRevision(() => {
			seen += 1;
		});
		unsubscribe();
		bumpRatesRevision();
		assert.equal(seen, 0);
	});

	it("reads back the same value until something bumps it", () => {
		// `useSyncExternalStore` calls the getter on every render and loops forever
		// if it answers differently without a store notification.
		assert.equal(ratesRevision(), ratesRevision());
	});
});
