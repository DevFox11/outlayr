import {
	FALLBACK_IDENTITY_COLOR,
	resolveTransactionIdentity,
	type TransactionIdentitySource,
} from "./transaction-identity";

const NONE: TransactionIdentitySource = {
	categoryColor: null,
	categoryEmoji: null,
	categoryIcon: null,
	customColor: null,
	emoji: null,
	icon: null,
	imageColor: null,
};

const source = (overrides: Partial<TransactionIdentitySource>): TransactionIdentitySource => ({
	...NONE,
	...overrides,
});

describe("resolveTransactionIdentity symbol", () => {
	it("prefers the transaction's own icon", () => {
		const identity = resolveTransactionIdentity(
			source({
				categoryEmoji: "🍕",
				categoryIcon: "Restaurant01",
				icon: "Coffee02",
			})
		);
		expect(identity.icon).toBe("Coffee02");
		expect(identity.emoji).toBe(null);
	});

	it("uses the transaction's own emoji when it names no icon", () => {
		const identity = resolveTransactionIdentity(source({ emoji: "🍕" }));
		expect(identity.icon).toBe(null);
		expect(identity.emoji).toBe("🍕");
	});

	it("lets a legacy row carrying both fall to its icon", () => {
		const identity = resolveTransactionIdentity(source({ emoji: "🍕", icon: "Coffee02" }));
		expect(identity.icon).toBe("Coffee02");
		expect(identity.emoji).toBe(null);
	});

	it("suppresses the category symbol whenever the transaction names one", () => {
		const identity = resolveTransactionIdentity(source({ categoryIcon: "Restaurant01", emoji: "🍕" }));
		expect(identity.icon).toBe(null);
		expect(identity.emoji).toBe("🍕");
	});

	it("falls through to the category icon", () => {
		const identity = resolveTransactionIdentity(source({ categoryIcon: "Restaurant01" }));
		expect(identity.icon).toBe("Restaurant01");
		expect(identity.emoji).toBe(null);
	});

	it("falls through to the category emoji", () => {
		const identity = resolveTransactionIdentity(source({ categoryEmoji: "🍕" }));
		expect(identity.icon).toBe(null);
		expect(identity.emoji).toBe("🍕");
	});

	it("reports no symbol when neither names one", () => {
		const identity = resolveTransactionIdentity(NONE);
		expect(identity.icon).toBe(null);
		expect(identity.emoji).toBe(null);
	});

	it("treats an empty stored symbol as absent", () => {
		const identity = resolveTransactionIdentity(source({ categoryIcon: "Restaurant01", emoji: "", icon: "" }));
		expect(identity.icon).toBe("Restaurant01");
		expect(identity.emoji).toBe(null);
	});
});

describe("resolveTransactionIdentity colour", () => {
	it("prefers the user's override", () => {
		const identity = resolveTransactionIdentity(
			source({
				categoryColor: "#0000FF",
				customColor: "#FF0000",
				imageColor: "#00FF00",
			})
		);
		expect(identity.color).toBe("#FF0000");
	});

	it("uses the photo colour next", () => {
		const identity = resolveTransactionIdentity(source({ categoryColor: "#0000FF", imageColor: "#00FF00" }));
		expect(identity.color).toBe("#00FF00");
	});

	it("uses the category colour next", () => {
		const identity = resolveTransactionIdentity(source({ categoryColor: "#0000FF" }));
		expect(identity.color).toBe("#0000FF");
	});

	it("falls back when nothing names a colour", () => {
		expect(resolveTransactionIdentity(NONE).color).toBe(FALLBACK_IDENTITY_COLOR);
	});

	it("treats an empty stored colour as absent", () => {
		const identity = resolveTransactionIdentity(source({ categoryColor: "#0000FF", customColor: "", imageColor: "" }));
		expect(identity.color).toBe("#0000FF");
	});
});
