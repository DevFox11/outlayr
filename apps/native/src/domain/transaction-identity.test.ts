import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	FALLBACK_IDENTITY_COLOR,
	resolveTransactionIdentity,
	type TransactionIdentitySource,
} from "./transaction-identity";

const NONE: TransactionIdentitySource = {
	icon: null,
	emoji: null,
	customColor: null,
	imageColor: null,
	categoryIcon: null,
	categoryEmoji: null,
	categoryColor: null,
};

const source = (
	overrides: Partial<TransactionIdentitySource>,
): TransactionIdentitySource => ({ ...NONE, ...overrides });

describe("resolveTransactionIdentity symbol", () => {
	it("prefers the transaction's own icon", () => {
		const identity = resolveTransactionIdentity(
			source({
				icon: "Coffee02",
				categoryIcon: "Restaurant01",
				categoryEmoji: "🍕",
			}),
		);
		assert.equal(identity.icon, "Coffee02");
		assert.equal(identity.emoji, null);
	});

	it("uses the transaction's own emoji when it names no icon", () => {
		const identity = resolveTransactionIdentity(source({ emoji: "🍕" }));
		assert.equal(identity.icon, null);
		assert.equal(identity.emoji, "🍕");
	});

	it("lets a legacy row carrying both fall to its icon", () => {
		const identity = resolveTransactionIdentity(
			source({ icon: "Coffee02", emoji: "🍕" }),
		);
		assert.equal(identity.icon, "Coffee02");
		assert.equal(identity.emoji, null);
	});

	it("suppresses the category symbol whenever the transaction names one", () => {
		const identity = resolveTransactionIdentity(
			source({ emoji: "🍕", categoryIcon: "Restaurant01" }),
		);
		assert.equal(identity.icon, null);
		assert.equal(identity.emoji, "🍕");
	});

	it("falls through to the category icon", () => {
		const identity = resolveTransactionIdentity(
			source({ categoryIcon: "Restaurant01" }),
		);
		assert.equal(identity.icon, "Restaurant01");
		assert.equal(identity.emoji, null);
	});

	it("falls through to the category emoji", () => {
		const identity = resolveTransactionIdentity(
			source({ categoryEmoji: "🍕" }),
		);
		assert.equal(identity.icon, null);
		assert.equal(identity.emoji, "🍕");
	});

	it("reports no symbol when neither names one", () => {
		const identity = resolveTransactionIdentity(NONE);
		assert.equal(identity.icon, null);
		assert.equal(identity.emoji, null);
	});

	it("treats an empty stored symbol as absent", () => {
		const identity = resolveTransactionIdentity(
			source({ icon: "", emoji: "", categoryIcon: "Restaurant01" }),
		);
		assert.equal(identity.icon, "Restaurant01");
		assert.equal(identity.emoji, null);
	});
});

describe("resolveTransactionIdentity colour", () => {
	it("prefers the user's override", () => {
		const identity = resolveTransactionIdentity(
			source({
				customColor: "#FF0000",
				imageColor: "#00FF00",
				categoryColor: "#0000FF",
			}),
		);
		assert.equal(identity.color, "#FF0000");
	});

	it("uses the photo colour next", () => {
		const identity = resolveTransactionIdentity(
			source({ imageColor: "#00FF00", categoryColor: "#0000FF" }),
		);
		assert.equal(identity.color, "#00FF00");
	});

	it("uses the category colour next", () => {
		const identity = resolveTransactionIdentity(
			source({ categoryColor: "#0000FF" }),
		);
		assert.equal(identity.color, "#0000FF");
	});

	it("falls back when nothing names a colour", () => {
		assert.equal(
			resolveTransactionIdentity(NONE).color,
			FALLBACK_IDENTITY_COLOR,
		);
	});

	it("treats an empty stored colour as absent", () => {
		const identity = resolveTransactionIdentity(
			source({ customColor: "", imageColor: "", categoryColor: "#0000FF" }),
		);
		assert.equal(identity.color, "#0000FF");
	});
});
