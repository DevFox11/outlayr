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
});
