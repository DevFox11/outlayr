import { describe, expect, it } from "@jest/globals";

import { goalBalanceSeries } from "./goal-balance-series";
import type { PlottedCell } from "./goal-balance-series";
import type { RateTable } from "./valuation";

/** Every cell here is already in the reading currency, so nothing consults it. */
const NO_RATES: RateTable = { earliest: () => null, get: () => null };

function cell(plotDay: string, amount: number, income = true): PlottedCell {
    return {
        amount,
        amountUsd: amount,
        currencyCode: "USD",
        // Same date here: these cells need no conversion, so the day they are
        // valued at and the day they are drawn on coincide.
        dateKey: plotDay,
        income,
        plotDay,
        unconvertedCount: 0,
    } as PlottedCell;
}

const localDay = (year: number, month: number, day: number) => new Date(year, month - 1, day).getTime();

describe("a goal's balance history", () => {
    it("places each day on the reader's own midnight", () => {
        const series = goalBalanceSeries([cell("2026-08-14", 100)], "USD", NO_RATES, 0, 0);
        expect(series).toStrictEqual([{ time: localDay(2026, 8, 14), value: 100 }]);
    });

    it("runs the total forward across days", () => {
        const series = goalBalanceSeries([cell("2026-08-14", 100), cell("2026-08-16", 50)], "USD", NO_RATES, 10, 0);
        expect(series.map((point) => point.value)).toStrictEqual([110, 160]);
    });

    it("counts what came before the goal without drawing it", () => {
        // The account held it when the goal started, so it belongs in the running
        // total and not on the line.
        const since = localDay(2026, 8, 15);
        const series = goalBalanceSeries([cell("2026-08-14", 100), cell("2026-08-16", 50)], "USD", NO_RATES, 0, since);
        expect(series).toStrictEqual([{ time: localDay(2026, 8, 16), value: 150 }]);
    });

    it("subtracts what left the account", () => {
        const series = goalBalanceSeries(
            [cell("2026-08-14", 100), cell("2026-08-15", 30, false)],
            "USD",
            NO_RATES,
            0,
            0
        );
        expect(series.map((point) => point.value)).toStrictEqual([100, 70]);
    });
});
