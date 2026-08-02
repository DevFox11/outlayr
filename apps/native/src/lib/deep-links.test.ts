import {
	budgetLink,
	DEEP_LINKS,
	redirectLaunchPath,
	resolveDeepLink,
	transactionLink,
} from "./deep-links";

describe("resolveDeepLink", () => {
	it("maps every canonical link the widgets and intents emit", () => {
		expect(resolveDeepLink(DEEP_LINKS.log)).toBe("/");
		expect(resolveDeepLink(DEEP_LINKS.insights)).toBe("/insights");
		expect(resolveDeepLink(DEEP_LINKS.budgets)).toBe("/budgets");
		expect(resolveDeepLink(DEEP_LINKS.overallBudget)).toBe("/budgets/overall");
		expect(resolveDeepLink(DEEP_LINKS.search)).toBe("/search");
		expect(resolveDeepLink(DEEP_LINKS.newExpense)).toBe("/transaction/new");
		expect(resolveDeepLink(DEEP_LINKS.newIncome)).toBe(
			"/transaction/new?income=1",
		);
	});

	it("accepts the bare path form expo-router hands it while running", () => {
		expect(resolveDeepLink("/budgets/overall")).toBe("/budgets/overall");
		expect(resolveDeepLink("new?income=1")).toBe("/transaction/new?income=1");
	});

	it("routes a single transaction, which is what Spotlight opens", () => {
		expect(resolveDeepLink(transactionLink("abc123"))).toBe(
			"/transaction/abc123",
		);
		expect(resolveDeepLink(budgetLink("b7"))).toBe("/budgets/b7");
	});

	it("degrades a host with no id to its section rather than to not-found", () => {
		expect(resolveDeepLink("outlayr://transaction")).toBe("/transaction");
	});

	it("routes a single budget by id", () => {
		expect(resolveDeepLink("outlayr://budgets/abc123")).toBe("/budgets/abc123");
	});

	it("still answers the retired Swift hosts", () => {
		expect(resolveDeepLink("outlayr://newExpense")).toBe("/transaction/new");
		expect(resolveDeepLink("outlayr://budget")).toBe("/budgets");
		expect(resolveDeepLink("outlayr://transactions")).toBe("/");
	});

	it("is case-insensitive on the host, as URLs are", () => {
		expect(resolveDeepLink("outlayr://Budgets")).toBe("/budgets");
	});

	it("declines anything outside the contract so ordinary paths pass through", () => {
		expect(resolveDeepLink("outlayr://")).toBe(null);
		expect(resolveDeepLink("/settings/currency")).toBe(null);
		expect(resolveDeepLink("exp://192.168.1.4:8081")).toBe(null);
	});
});

describe("redirectLaunchPath", () => {
	function drainSpy() {
		const calls = { count: 0 };
		return [
			() => {
				calls.count++;
			},
			calls,
		] as const;
	}

	it("still routes the link the app was launched from", () => {
		const [drain, calls] = drainSpy();
		expect(
			redirectLaunchPath({ path: DEEP_LINKS.newExpense, initial: true }, drain),
		).toBe("/transaction/new");
		expect(calls.count).toBe(1);
	});

	it("drains a launch that carried no deep link", () => {
		const [drain, calls] = drainSpy();
		expect(
			redirectLaunchPath({ path: "outlayr:///", initial: true }, drain),
		).toBe("outlayr:///");
		expect(calls.count).toBe(1);
	});

	it("leaves the registry alone for a link arriving while the app runs", () => {
		const [drain, calls] = drainSpy();
		expect(
			redirectLaunchPath({ path: DEEP_LINKS.budgets, initial: false }, drain),
		).toBe("/budgets");
		expect(calls.count).toBe(0);
	});

	it("passes a null path through with nothing to drain", () => {
		const [drain, calls] = drainSpy();
		expect(redirectLaunchPath({ path: null, initial: true }, drain)).toBe(null);
		expect(calls.count).toBe(0);
	});
});
