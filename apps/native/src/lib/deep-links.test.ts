import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	budgetLink,
	DEEP_LINKS,
	redirectLaunchPath,
	resolveDeepLink,
	transactionLink,
} from "./deep-links";

describe("resolveDeepLink", () => {
	it("maps every canonical link the widgets and intents emit", () => {
		assert.equal(resolveDeepLink(DEEP_LINKS.log), "/");
		assert.equal(resolveDeepLink(DEEP_LINKS.insights), "/insights");
		assert.equal(resolveDeepLink(DEEP_LINKS.budgets), "/budgets");
		assert.equal(resolveDeepLink(DEEP_LINKS.overallBudget), "/budgets/overall");
		assert.equal(resolveDeepLink(DEEP_LINKS.search), "/search");
		assert.equal(resolveDeepLink(DEEP_LINKS.newExpense), "/transaction/new");
		assert.equal(
			resolveDeepLink(DEEP_LINKS.newIncome),
			"/transaction/new?income=1",
		);
	});

	it("accepts the bare path form expo-router hands it while running", () => {
		assert.equal(resolveDeepLink("/budgets/overall"), "/budgets/overall");
		assert.equal(resolveDeepLink("new?income=1"), "/transaction/new?income=1");
	});

	it("routes a single transaction, which is what Spotlight opens", () => {
		assert.equal(
			resolveDeepLink(transactionLink("abc123")),
			"/transaction/abc123",
		);
		assert.equal(resolveDeepLink(budgetLink("b7")), "/budgets/b7");
	});

	it("degrades a host with no id to its section rather than to not-found", () => {
		assert.equal(resolveDeepLink("outlayr://transaction"), "/transaction");
	});

	it("routes a single budget by id", () => {
		assert.equal(
			resolveDeepLink("outlayr://budgets/abc123"),
			"/budgets/abc123",
		);
	});

	it("still answers the retired Swift hosts", () => {
		assert.equal(resolveDeepLink("outlayr://newExpense"), "/transaction/new");
		assert.equal(resolveDeepLink("outlayr://budget"), "/budgets");
		assert.equal(resolveDeepLink("outlayr://transactions"), "/");
	});

	it("is case-insensitive on the host, as URLs are", () => {
		assert.equal(resolveDeepLink("outlayr://Budgets"), "/budgets");
	});

	it("declines anything outside the contract so ordinary paths pass through", () => {
		assert.equal(resolveDeepLink("outlayr://"), null);
		assert.equal(resolveDeepLink("/settings/currency"), null);
		assert.equal(resolveDeepLink("exp://192.168.1.4:8081"), null);
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
		assert.equal(
			redirectLaunchPath({ path: DEEP_LINKS.newExpense, initial: true }, drain),
			"/transaction/new",
		);
		assert.equal(calls.count, 1);
	});

	it("drains a launch that carried no deep link", () => {
		const [drain, calls] = drainSpy();
		assert.equal(
			redirectLaunchPath({ path: "outlayr:///", initial: true }, drain),
			"outlayr:///",
		);
		assert.equal(calls.count, 1);
	});

	it("leaves the registry alone for a link arriving while the app runs", () => {
		const [drain, calls] = drainSpy();
		assert.equal(
			redirectLaunchPath({ path: DEEP_LINKS.budgets, initial: false }, drain),
			"/budgets",
		);
		assert.equal(calls.count, 0);
	});

	it("passes a null path through with nothing to drain", () => {
		const [drain, calls] = drainSpy();
		assert.equal(
			redirectLaunchPath({ path: null, initial: true }, drain),
			null,
		);
		assert.equal(calls.count, 0);
	});
});
