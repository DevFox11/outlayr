import { describe, expect, it } from "@jest/globals";

import { blockMessage, gapPrompt } from "./prompts";

type Draft = Parameters<typeof blockMessage>[0];

const t = ((key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key) as Parameters<typeof blockMessage>[1];

function drafted(block: Draft["block"]): Draft {
    return { block, feeCurrency: "VES" } as Draft;
}

describe("what a blocked transfer says", () => {
    it("asks for a rate when no source quotes the pair", () => {
        expect(blockMessage(drafted({ kind: "rate" }), t, "en")).toBe("transfers.rate.unavailable");
    });

    it("names how far over the fee is, so the user knows what to change", () => {
        expect(blockMessage(drafted({ kind: "fee", shortfall: 45 }), t, "en")).toContain(
            "transfers.block.feeOverArrival"
        );
    });

    /** The boundary that used to save: the fee equals the arrival exactly, so there
     * is nothing over to report and "0 unaccounted" would say nothing at all. */
    it("says nothing would arrive when the fee takes precisely all of it", () => {
        expect(blockMessage(drafted({ kind: "fee", shortfall: 0 }), t, "en")).toBe("transfers.block.nothingArrives");
    });

    it("says the same when the fee overruns it entirely", () => {
        expect(blockMessage(drafted({ kind: "fee", shortfall: -12 }), t, "en")).toBe("transfers.block.nothingArrives");
    });
});

describe("what an unexplained remainder offers", () => {
    it("offers the rate that would close it even when it rounds to the same five digits", () => {
        const prompt = gapPrompt(
            {
                fromCurrency: "USD",
                gapAmount: -0.4,
                gapFee: null,
                gapRate: 55.5004,
                quotedRate: 55.5,
                resolveAsRate: () => {},
                toCurrency: "VES",
            } as Parameters<typeof gapPrompt>[0],
            t,
            "en"
        );

        expect(prompt?.rateLabel).toBe('transfers.gap.rateWas:{"rate":"55.5004"}');
    });

    it("offers no rate between two accounts in one currency, where a rate changes nothing", () => {
        const prompt = gapPrompt(
            {
                fromCurrency: "USD",
                gapAmount: 1,
                gapFee: 3,
                gapRate: 0.9898,
                quotedRate: 1,
                resolveAsFee: () => {},
                resolveAsRate: () => {},
                toCurrency: "USD",
            } as Parameters<typeof gapPrompt>[0],
            t,
            "en"
        );

        expect(prompt).toMatchObject({ feeLabel: "transfers.gap.itsAFee", onRate: null, rateLabel: null });
    });
});

describe("the sign on an unexplained remainder", () => {
    it("reads dollars lost on the way as a minus in the sender's currency, with a fee to explain it", () => {
        const prompt = gapPrompt(
            {
                feeCurrency: "USD",
                fromCurrency: "USD",
                gapAmount: 7.34,
                gapFee: 7.34,
                gapRate: 1031.5188,
                quotedRate: 1031.52,
                resolveAsFee: () => {},
                resolveAsRate: () => {},
                toCurrency: "VES",
            } as Parameters<typeof gapPrompt>[0],
            t,
            "en"
        );

        expect(prompt).toMatchObject({
            feeLabel: "transfers.gap.itsAFee",
            message: 'transfers.gap.unaccounted:{"amount":"-$7.34"}',
        });
    });

    it("reads more arriving than the rate implies as an explicit plus, with only the rate to explain it", () => {
        const prompt = gapPrompt(
            {
                feeCurrency: "USD",
                fromCurrency: "USD",
                gapAmount: -4.53,
                gapFee: null,
                gapRate: 157_471.66 / 160,
                quotedRate: 957.1,
                resolveAsRate: () => {},
                toCurrency: "VES",
            } as Parameters<typeof gapPrompt>[0],
            t,
            "en"
        );

        expect(prompt).toMatchObject({
            feeLabel: null,
            message: 'transfers.gap.unaccounted:{"amount":"+$4.53"}',
            rateLabel: 'transfers.gap.rateWas:{"rate":"984.1979"}',
        });
    });
});
