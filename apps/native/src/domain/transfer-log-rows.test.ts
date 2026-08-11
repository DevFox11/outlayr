import { mergeByRecency, toTransferLogRow } from "./transfer-log-rows";

const DAY = new Date(2026, 7, 9);

const TRANSFER = {
	date: DAY,
	day: DAY,
	fromAccountId: "a",
	fromAmount: 100,
	fromAmountUsd: 100,
	fromCurrency: "USD",
	id: "t1",
	note: "",
	toAccountId: "b",
	toAmount: 5550,
	toAmountUsd: 100,
	toCurrency: "VES",
};

const NAMES = new Map([
	["a", "Zinli"],
	["b", "Banesco"],
]);

describe("toTransferLogRow", () => {
	it("names both ends in the direction the money went", () => {
		expect(toTransferLogRow(TRANSFER, NAMES).note).toBe("Zinli → Banesco");
	});

	it("falls back to the transfer's own note when the user wrote one", () => {
		expect(toTransferLogRow({ ...TRANSFER, note: "Cambio" }, NAMES).note).toBe("Cambio");
	});

	it("carries the outbound leg, so the figure is what left", () => {
		const row = toTransferLogRow(TRANSFER, NAMES);
		expect(row.amount).toBe(100);
		expect(row.currency).toBe("USD");
	});

	it("is excluded from day totals", () => {
		expect(toTransferLogRow(TRANSFER, NAMES).excludedFromTotals).toBe(true);
	});

	it("is marked a transfer so the row can be drawn unsigned and in transfer blue", () => {
		expect(toTransferLogRow(TRANSFER, NAMES).transferId).toBe("t1");
	});

	it("reads as an expense so nothing downstream has to learn a third direction", () => {
		expect(toTransferLogRow(TRANSFER, NAMES).income).toBe(false);
	});

	it("keeps an unknown account readable rather than blank", () => {
		expect(toTransferLogRow(TRANSFER, new Map()).note).toContain("→");
	});
});

describe("mergeByRecency", () => {
	const older = { date: new Date(2026, 7, 8), day: new Date(2026, 7, 8), id: "x" };
	const newer = { date: new Date(2026, 7, 9, 10), day: new Date(2026, 7, 9), id: "y" };
	const newest = { date: new Date(2026, 7, 9, 18), day: new Date(2026, 7, 9), id: "z" };

	it("interleaves two newest-first lists into one", () => {
		expect(mergeByRecency([newest, older], [newer]).map((row) => row.id)).toEqual(["z", "y", "x"]);
	});

	it("keeps day order ahead of time order", () => {
		const lateOnOlderDay = { date: new Date(2026, 7, 8, 23), day: new Date(2026, 7, 8), id: "late" };
		expect(mergeByRecency([newer], [lateOnOlderDay]).map((row) => row.id)).toEqual(["y", "late"]);
	});

	it("returns the other list untouched when one is empty", () => {
		expect(mergeByRecency([], [newer]).map((row) => row.id)).toEqual(["y"]);
		expect(mergeByRecency([newer], []).map((row) => row.id)).toEqual(["y"]);
	});
});
