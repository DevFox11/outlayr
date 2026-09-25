import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { Account } from "@/data/accounts-core";
import type { Database } from "@/db/client";

import { useTransferDraft } from "./use-transfer-draft";
import type { TransferDraft } from "./use-transfer-draft";

const mockAccounts = [
    { currency: "USD", id: "usd", initialBalance: 0, name: "Zinli" } as Account,
    { currency: "VES", id: "ves", initialBalance: 0, name: "Banesco" } as Account,
    { currency: "EUR", id: "eur", initialBalance: 0, name: "Wise" } as Account,
    { currency: "USD", id: "usd-2", initialBalance: 0, name: "Mercantil" } as Account,
];

const mockRates = new Map<string, number>();

jest.mock("@/data/accounts", () => ({
    useAccountBalance: () => ({ total: 0 }),
    useAccounts: () => mockAccounts,
}));

jest.mock("@/data/transfer-rates", () => ({
    useTransferRates: () => ({ get: (code: string) => mockRates.get(code) ?? null }),
}));

const SENT = "1000";
const PINNED_ARRIVAL = "33333.33";
const TYPED_RATE = "30";
const OFFICIAL_VES_PER_USD = 55.5;

beforeEach(() => {
    mockRates.clear();
});

async function draft(): Promise<{ current: TransferDraft }> {
    const { result } = await renderHook(() => useTransferDraft({} as Database));
    return result;
}

/**
 * 1000 at 33.3333 lands three cents short of 33,333.33, so no rate carried at
 * four decimals reproduces this arrival — the residual a silent re-derive hides.
 */
async function overpaidDraft(): Promise<{ current: TransferDraft }> {
    const result = await draft();
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

/** $10 at the official 55,50 arrives as Bs 555, and the bank takes exactly all of it. */
async function feeEatsArrivalDraft(): Promise<{ current: TransferDraft }> {
    const result = await draft();
    await act(async () => {
        result.current.setSent("10");
    });
    await act(async () => {
        result.current.toggleFeeSide();
    });
    await act(async () => {
        result.current.setFee("555");
    });
    return result;
}

/** $10 at the official 55,50 arrives as Bs 555, and the bank takes Bs 600 of it. */
async function feeOverArrivalDraft(): Promise<{ current: TransferDraft }> {
    const result = await draft();
    await act(async () => {
        result.current.setSent("10");
    });
    await act(async () => {
        result.current.toggleFeeSide();
    });
    await act(async () => {
        result.current.setFee("600");
    });
    return result;
}

async function customRateDraft(): Promise<{ current: TransferDraft }> {
    const result = await draft();
    await act(async () => {
        result.current.setRateType("custom");
    });
    await act(async () => {
        result.current.setCustomRate("600");
    });
    await act(async () => {
        result.current.setSent("100");
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

describe("a fee larger than what reaches the other side", () => {
    beforeEach(() => {
        mockRates.set("VES", OFFICIAL_VES_PER_USD);
    });

    it("cannot be saved as a transfer that credits the fee", async () => {
        const result = await feeOverArrivalDraft();
        expect(result.current.legs).toBeNull();
        expect(result.current.canSave).toBe(false);
    });

    it("claims no arrival and names what the fee overshoots by", async () => {
        const result = await feeOverArrivalDraft();
        expect(result.current.arrived).toBeNull();
        expect(result.current.block).toStrictEqual({ kind: "fee", shortfall: -45 });
    });

    it("keeps the official rate it was quoted at instead of one the fee implies", async () => {
        const result = await feeOverArrivalDraft();
        expect(result.current.effectiveRate).toBe(OFFICIAL_VES_PER_USD);
    });

    it("names the shortfall in the sender's own currency when the sender charges it", async () => {
        const result = await draft();
        await act(async () => {
            result.current.setSent("10");
        });
        await act(async () => {
            result.current.setFee("600");
        });
        expect(result.current.feeCurrency).toBe("USD");
        expect(result.current.block).toStrictEqual({ kind: "fee", shortfall: -590 });
    });

    it("saves again once the fee fits inside the arrival", async () => {
        const result = await feeOverArrivalDraft();
        await act(async () => {
            result.current.setFee("55");
        });
        expect(result.current.arrived).toBe(500);
        expect(result.current.legs).toStrictEqual({ exchangeRate: 55.5, fromAmount: 10, toAmount: 555 });
        expect(result.current.block).toBeNull();
        expect(result.current.canSave).toBe(true);
    });
});

describe("a fee that outruns what arrives", () => {
    beforeEach(() => {
        mockRates.set("VES", OFFICIAL_VES_PER_USD);
    });

    it("refuses a transfer whose fee takes every last unit that arrives", async () => {
        const result = await feeEatsArrivalDraft();

        expect(result.current.canSave).toBe(false);
        expect(result.current.legs).toBeNull();
        expect(result.current.block).not.toBeNull();
    });

    /** The rate is quoted, so the refusal has to be about the fee — an earlier
     * version derived a rate from the fee instead and saved. */
    it("refuses rather than deriving a rate that makes the fee fit", async () => {
        const result = await feeOverArrivalDraft();

        expect(result.current.legs).toBeNull();
        expect(result.current.canSave).toBe(false);
        expect(result.current.block).toStrictEqual({ kind: "fee", shortfall: -45 });
    });
});

describe("a pair no rate table covers", () => {
    it("has no rate to offer, and will not invent one", async () => {
        const result = await feeOverArrivalDraft();

        expect(result.current.effectiveRate).toBeNull();
        expect(result.current.legs).toBeNull();
        expect(result.current.canSave).toBe(false);
        expect(result.current.block).toStrictEqual({ kind: "rate" });
    });
});

describe("moving a fee to the other side", () => {
    beforeEach(() => {
        mockRates.set("VES", OFFICIAL_VES_PER_USD);
    });

    it("carries the fee through the rate instead of relabelling its digits", async () => {
        const result = await draft();
        await act(async () => {
            result.current.setSent("10");
        });
        await act(async () => {
            result.current.setFee("2");
        });
        await act(async () => {
            result.current.toggleFeeSide();
        });
        expect(result.current.feeCurrency).toBe("VES");
        expect(result.current.fee).toBe(2 * OFFICIAL_VES_PER_USD);
    });
});

describe("swapping a transfer that carries a custom rate", () => {
    beforeEach(() => {
        mockRates.set("VES", OFFICIAL_VES_PER_USD);
    });

    it("converts 100 USD at the typed 600 before the swap", async () => {
        const result = await customRateDraft();
        expect(result.current.legs).toStrictEqual({ exchangeRate: 600, fromAmount: 100, toAmount: 60_000 });
    });

    it("values the inverted pair at its own rate, never at the one typed for the other", async () => {
        const result = await customRateDraft();
        await act(async () => {
            result.current.swap();
        });
        expect(result.current.legs).toStrictEqual({ exchangeRate: 0.018, fromAmount: 100, toAmount: 1.8 });
        expect(result.current.customRatePadText).toBe("0.0180");
    });

    it("stays empty once the rate is deleted, rather than refilling with the market's", async () => {
        const result = await customRateDraft();
        await act(async () => {
            result.current.setCustomRate("");
        });
        expect(result.current.customRatePadText).toBe("");
        expect(result.current.rateType).toBe("custom");
        expect(result.current.canSave).toBe(false);
    });

    it("gives the rate back to the pair it was typed for", async () => {
        const result = await customRateDraft();
        await act(async () => {
            result.current.swap();
        });
        await act(async () => {
            result.current.swap();
        });
        expect(result.current.customRatePadText).toBe("600");
        expect(result.current.effectiveRate).toBe(600);
    });
});

describe("changing the destination under a custom rate", () => {
    beforeEach(() => {
        mockRates.set("VES", OFFICIAL_VES_PER_USD);
        mockRates.set("EUR", 0.9);
    });

    it("values the new pair at its own rate", async () => {
        const result = await customRateDraft();
        await act(async () => {
            result.current.chooseTo(mockAccounts[2] ?? null);
        });
        expect(result.current.legs).toStrictEqual({ exchangeRate: 0.9, fromAmount: 100, toAmount: 90 });
    });
});

describe("useTransferDraft seed", () => {
    it("lands the amount on the leg whose currency it was spoken in, and nowhere when neither matches", async () => {
        const seededSent = await renderHook(() =>
            useTransferDraft({} as Database, { amount: 100, currency: "EUR", fromAccountId: "eur", toAccountId: "usd" })
        );
        expect(seededSent.result.current.sentText).toBe("100");
        expect(seededSent.result.current.arrivedText).toBe("");

        const seededArrival = await renderHook(() =>
            useTransferDraft({} as Database, { amount: 100, currency: "USD", fromAccountId: "eur", toAccountId: "usd" })
        );
        expect(seededArrival.result.current.sentText).toBe("");
        expect(seededArrival.result.current.arrivedText).toBe("100");
        expect(seededArrival.result.current.arrived).toBe(100);

        const seededNeither = await renderHook(() =>
            useTransferDraft({} as Database, { amount: 100, currency: "GBP", fromAccountId: "eur", toAccountId: "usd" })
        );
        expect(seededNeither.result.current.sentText).toBe("");
        expect(seededNeither.result.current.arrivedText).toBe("");
    });

    it("fills the leg the seed left open with an account other than the resolved one", async () => {
        const onlyFrom = await renderHook(() => useTransferDraft({} as Database, { fromAccountId: "usd" }));
        expect(onlyFrom.result.current.from?.id).toBe("usd");
        expect(onlyFrom.result.current.to?.id).toBe("ves");

        const onlyTo = await renderHook(() => useTransferDraft({} as Database, { toAccountId: "usd" }));
        expect(onlyTo.result.current.to?.id).toBe("usd");
        expect(onlyTo.result.current.from?.id).toBe("ves");
    });

    it("keeps a pinned arrival when the source is chosen afterwards, and drops it when the destination changes", async () => {
        const { result } = await renderHook(() =>
            useTransferDraft({} as Database, { amount: 100, currency: "USD", fromUnresolved: true, toAccountId: "usd" })
        );
        expect(result.current.from).toBeNull();
        expect(result.current.arrivedText).toBe("100");
        await act(async () => {
            result.current.chooseFrom(mockAccounts[1] ?? null);
        });
        expect(result.current.from?.id).toBe("ves");
        expect(result.current.arrivedText).toBe("100");
        expect(result.current.arrived).toBe(100);
        await act(async () => {
            result.current.chooseTo(mockAccounts[0] ?? null);
        });
        expect(result.current.arrived).toBe(100);
        await act(async () => {
            result.current.chooseTo(mockAccounts[2] ?? null);
        });
        expect(result.current.to?.id).toBe("eur");
        expect(result.current.arrived).not.toBe(100);
    });

    it("fills the sent side from a pinned arrival when the chosen source shares the destination's currency", async () => {
        const { result } = await renderHook(() =>
            useTransferDraft({} as Database, { amount: 100, currency: "USD", fromUnresolved: true, toAccountId: "usd" })
        );
        expect(result.current.canSave).toBeFalsy();
        await act(async () => {
            result.current.chooseFrom(mockAccounts[3] ?? null);
        });
        expect(result.current.from?.id).toBe("usd-2");
        expect(result.current.sentText).toBe("100");
        expect(result.current.arrived).toBe(100);
        expect(result.current.canSave).toBeTruthy();
    });

    it("leaves a leg empty when it was named but could not be placed", async () => {
        const missedSource = await renderHook(() =>
            useTransferDraft({} as Database, { fromUnresolved: true, toAccountId: "usd" })
        );
        expect(missedSource.result.current.from).toBeNull();
        expect(missedSource.result.current.to?.id).toBe("usd");
        expect(missedSource.result.current.canSave).toBeFalsy();

        const missedDestination = await renderHook(() =>
            useTransferDraft({} as Database, { fromAccountId: "usd", toUnresolved: true })
        );
        expect(missedDestination.result.current.from?.id).toBe("usd");
        expect(missedDestination.result.current.to).toBeNull();
    });
});
