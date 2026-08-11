import { act, renderHook } from "@testing-library/react-native";
import type { Account } from "@/data/accounts-core";
import type { Database } from "@/db/client";
import { type TransferDraft, useTransferDraft } from "./use-transfer-draft";

const mockAccounts = [
	{ currency: "USD", id: "usd", initialBalance: 0, name: "Checking" } as Account,
	{ currency: "VES", id: "ves", initialBalance: 0, name: "Bolivares" } as Account,
];

jest.mock("@/data/accounts", () => ({
	useAccountBalance: () => ({ total: 0 }),
	useAccounts: () => mockAccounts,
}));

jest.mock("@/data/transfer-rates", () => ({
	useTransferRates: () => ({ get: () => null }),
}));

jest.mock("@/data/transfers-core", () => ({
	lastFeeCategoryId: () => null,
}));

const SENT = "1000";
const PINNED_ARRIVAL = "33333.33";
const TYPED_RATE = "30";

/**
 * 1000 at 33.3333 lands three cents short of 33,333.33, so no rate carried at
 * four decimals reproduces this arrival — the residual a silent re-derive hides.
 */
async function overpaidDraft(): Promise<{ current: TransferDraft }> {
	const { result } = await renderHook(() => useTransferDraft({} as Database));
	await act(async () => {
		result.current.setRateType("custom");
	});
	await act(async () => {
		result.current.setCustomRate(TYPED_RATE);
	});
	await act(async () => {
		result.current.setSent(SENT);
	});
	await act(async () => {
		result.current.pinArrival();
	});
	await act(async () => {
		result.current.setArrived(PINNED_ARRIVAL);
	});
	return result;
}

describe("an arrival above everything the rate ever converted", () => {
	it("has no fee that could explain it, only a rate", async () => {
		const result = await overpaidDraft();
		expect(result.current.gapAmount).toBeLessThan(0);
		expect(result.current.gapFee).toBeNull();
		expect(result.current.gapRate).toBe(33.3333);
	});
});

describe("accepting the suggested rate", () => {
	it("leaves the arrival the user pinned untouched", async () => {
		const result = await overpaidDraft();
		await act(async () => {
			result.current.resolveAsRate();
		});
		expect(result.current.arrived).toBe(33_333.33);
		expect(result.current.arrivedText).toBe(PINNED_ARRIVAL);
	});

	it("adopts the rate it offered", async () => {
		const result = await overpaidDraft();
		await act(async () => {
			result.current.resolveAsRate();
		});
		expect(result.current.rateType).toBe("custom");
		expect(result.current.customRatePadText).toBe("33.3333");
	});

	it("still reports the remainder four decimals of rate cannot reconcile", async () => {
		const result = await overpaidDraft();
		await act(async () => {
			result.current.resolveAsRate();
		});
		expect(result.current.gapAmount).toBe(-0.03);
	});
});
