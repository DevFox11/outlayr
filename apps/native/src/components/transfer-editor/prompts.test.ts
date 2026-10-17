import { describe, expect, it, jest } from "@jest/globals";

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

    it("says nothing would arrive when the fee takes precisely all of it", () => {
        expect(blockMessage(drafted({ kind: "fee", shortfall: 0 }), t, "en")).toBe("transfers.block.nothingArrives");
    });
});

function gapped(draft: Partial<Parameters<typeof gapPrompt>[0]>) {
    return gapPrompt(
        { crossCurrency: true, feeCurrency: "USD", gapFee: null, gapOnTop: false, outside: 0, ...draft } as Parameters<
            typeof gapPrompt
        >[0],
        t,
        "en"
    );
}

describe("what an unexplained remainder offers", () => {
    it("reads dollars lost on the way as less arriving, with a fee and never a rate to explain it", () => {
        expect(gapped({ gapAmount: 7.34, gapFee: 7.34, resolveAsFee: () => {} })).toMatchObject({
            feeLabel: "transfers.gap.itsAFee",
            message: 'transfers.gap.less:{"amount":"$7.34"}',
            outsideLabel: null,
        });
    });

    it("reads more arriving than the typed rate converts as money from another account", () => {
        const setOutside = jest.fn();
        const prompt = gapped({ gapAmount: -4.53, setOutside });

        expect(prompt).toMatchObject({
            feeLabel: null,
            message: 'transfers.gap.more:{"amount":"$4.53"}',
            outsideLabel: "transfers.gap.outside",
        });
        prompt?.onOutside?.();
        expect(setOutside).toHaveBeenCalledWith(true);
    });

    it("offers no fee for a surplus, where booking one would only shrink the fee typed", () => {
        expect(gapped({ gapAmount: -4.53, gapFee: 5.47, resolveAsFee: () => {} })).toMatchObject({
            feeLabel: null,
            onFee: null,
        });
    });

    it("offers no outside account between two accounts in one currency", () => {
        expect(gapped({ crossCurrency: false, gapAmount: -5 })).toMatchObject({ onOutside: null, outsideLabel: null });
    });

    it("goes quiet once the surplus is confirmed, because the sentence states it", () => {
        expect(gapped({ gapAmount: -4.53, outside: 4.53 })).toBeNull();
    });
});
