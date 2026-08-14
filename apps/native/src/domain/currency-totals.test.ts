import { cellFigures, cellTotals, currencyTotals, toCells, valueCell } from "./currency-totals";
import { buildRateTable } from "./valuation";

function entry(amount: number, income = false, currency: string | null = null) {
    return { amount, currency, income };
}

describe("currencyTotals", () => {
    it("gives an empty set one zero bucket, so a caller always has something to draw", () => {
        expect(currencyTotals([], "USD")).toStrictEqual([{ amount: 0, currencyCode: "USD", transactionCount: 0 }]);
    });

    it("files a row with no currency of its own under the global one", () => {
        const [bucket] = currencyTotals([entry(10)], "USD");
        expect(bucket.currencyCode).toBe("USD");
        expect(bucket.amount).toBe(-10);
    });

    it("signs income up and expense down inside each bucket", () => {
        const [bucket] = currencyTotals([entry(40), entry(15, true)], "USD");
        expect(bucket.amount).toBe(-25);
    });

    it("never adds two currencies together", () => {
        const buckets = currencyTotals([entry(40), entry(10, false, "EUR")], "USD");
        expect(buckets).toHaveLength(2);
        expect(buckets.map((b) => b.amount)).toStrictEqual([-40, -10]);
    });

    it("ranks by transaction count first", () => {
        const buckets = currencyTotals([entry(1, false, "EUR"), entry(1, false, "EUR"), entry(999)], "USD");
        expect(buckets[0].currencyCode).toBe("EUR");
    });

    it("breaks a count tie in the user's own currency's favour", () => {
        const buckets = currencyTotals([entry(1, false, "EUR"), entry(1, false, "USD")], "USD");
        expect(buckets[0].currencyCode).toBe("USD");
    });

    it("breaks a remaining tie alphabetically rather than arbitrarily", () => {
        const buckets = currencyTotals([entry(1, false, "JPY"), entry(1, false, "EUR")], "USD");
        expect(buckets.map((b) => b.currencyCode)).toStrictEqual(["EUR", "JPY"]);
    });
});

const JULY_5 = new Date(Date.UTC(2026, 6, 5, 12));
const JULY_20 = new Date(Date.UTC(2026, 6, 20, 12));

/** USD→EUR at 0.90 from 1 July, 0.95 from 10 July. */
const eurRates = buildRateTable([
    { date: "2026-07-01", quote: "EUR", rate: 0.9 },
    { date: "2026-07-10", quote: "EUR", rate: 0.95 },
]);

function priced(amount: number, currency: string, amountUsd: number | null, date: Date, income = false) {
    return { amount, amountUsd, currency, date, income };
}

describe("currencyTotals with rates", () => {
    it("excludes pending custom from valueCell in another currency", () => {
        const [cell] = toCells([
            { ...priced(40, "VES", null, JULY_5), exchangeRate: null, exchangeRateType: "custom" },
        ]);
        expect(valueCell(cell, "EUR", eurRates)).toBe(0);
    });

    it("excludes pending custom from valueCell without a rate table", () => {
        const [cell] = toCells([
            { ...priced(40, "VES", null, JULY_5), exchangeRate: null, exchangeRateType: "custom" },
        ]);
        expect(valueCell(cell, "EUR")).toBe(0);
    });

    it("excludes an unresolved official foreign row from scalar totals", () => {
        const [cell] = toCells([
            { ...priced(40, "VES", null, JULY_5), exchangeRate: null, exchangeRateType: "official" },
        ]);
        expect(valueCell(cell, "EUR", eurRates)).toBe(0);
    });

    it("folds a foreign entry into the global currency at its own day's rate", () => {
        const buckets = currencyTotals([priced(100, "USD", 100, JULY_5)], "EUR", eurRates);
        expect(buckets).toStrictEqual([{ amount: -90, currencyCode: "EUR", transactionCount: 1 }]);
    });

    it("values two days at their own rates rather than one blended rate", () => {
        // $100 on the 5th is €90, $100 on the 20th is €95. A single conversion of
        // the $200 would print €180 or €190 — both wrong.
        const buckets = currencyTotals(
            [priced(100, "USD", 100, JULY_5), priced(100, "USD", 100, JULY_20)],
            "EUR",
            eurRates
        );
        expect(buckets).toStrictEqual([{ amount: -185, currencyCode: "EUR", transactionCount: 2 }]);
    });

    it("collapses a mixed-currency day to one figure", () => {
        const buckets = currencyTotals(
            [priced(50, "EUR", 55.56, JULY_5), priced(100, "USD", 100, JULY_5), priced(1000, "JPY", 6.4, JULY_5)],
            "EUR",
            eurRates
        );
        expect(buckets).toHaveLength(1);
        expect(buckets[0].currencyCode).toBe("EUR");
        // 50 + 90 + 5.76
        expect(buckets[0].amount).toBe(-145.76);
    });

    it("leaves an entry with no frozen USD value in its own currency", () => {
        const buckets = currencyTotals([priced(100, "USD", null, JULY_5)], "EUR", eurRates);
        expect(buckets).toStrictEqual([{ amount: -100, currencyCode: "USD", transactionCount: 1 }]);
    });

    it("splits a day where only some entries were canonicalized", () => {
        // The convertible half must not drag the other half in with it, and the
        // other half must not keep the convertible half out.
        const buckets = currencyTotals(
            [priced(100, "USD", 100, JULY_5), priced(40, "USD", null, JULY_5)],
            "EUR",
            eurRates
        );
        expect(buckets).toStrictEqual([
            { amount: -90, currencyCode: "EUR", transactionCount: 1 },
            { amount: -40, currencyCode: "USD", transactionCount: 1 },
        ]);
    });

    it("keeps an entry older than any rate in its own currency", () => {
        const buckets = currencyTotals([priced(100, "USD", 100, new Date(Date.UTC(2020, 0, 1)))], "EUR", eurRates);
        expect(buckets).toStrictEqual([{ amount: -100, currencyCode: "USD", transactionCount: 1 }]);
    });

    it("uses the frozen USD value directly when the ledger reads in USD", () => {
        // No rate table can cover USD→USD, and none is needed.
        const buckets = currencyTotals([priced(92, "EUR", 100, JULY_5)], "USD", eurRates);
        expect(buckets).toStrictEqual([{ amount: -100, currencyCode: "USD", transactionCount: 1 }]);
    });

    it("converts the day's sum once, not each entry", () => {
        // Three $0.10 charges are $0.30 → €0.27 at 0.90. Rounding each conversion
        // first gives 0.09 × 3 = €0.27 here, but the header aggregates in SQL where
        // only the sum survives — both paths must round the same figure.
        const cells = toCells([
            priced(0.1, "USD", 0.1, JULY_5),
            priced(0.1, "USD", 0.1, JULY_5),
            priced(0.1, "USD", 0.1, JULY_5),
        ]);
        expect(cells).toHaveLength(1);
        expect(cells[0].amountUsd).toBe(0.30000000000000004);
        expect(cellTotals(cells, "EUR", eurRates)).toStrictEqual([
            { amount: -0.27, currencyCode: "EUR", transactionCount: 3 },
        ]);
    });

    it("ignores rates when the entry carries no date", () => {
        const buckets = currencyTotals(
            [{ amount: 100, amountUsd: 100, currency: "USD", income: false }],
            "EUR",
            eurRates
        );
        expect(buckets).toStrictEqual([{ amount: -100, currencyCode: "USD", transactionCount: 1 }]);
    });
});

describe("figures over a whole result set", () => {
    // What the Search header prints: one in/out/net block per currency over every
    // matched row, whatever day each landed on.
    it("keeps in and out apart across every day in the set", () => {
        const figures = cellFigures(
            toCells([
                priced(30, "USD", 30, JULY_5),
                priced(70, "USD", 70, JULY_20),
                priced(200, "USD", 200, JULY_20, true),
            ]),
            "USD"
        );
        expect(figures).toStrictEqual([{ count: 3, currencyCode: "USD", expense: 100, income: 200 }]);
    });

    it("splits a mixed-currency result rather than inventing one sum", () => {
        // No frozen USD value on the euro rows, so no rate reaches them and the
        // result keeps two blocks. Counts put the dominant currency first.
        const figures = cellFigures(
            toCells([
                priced(100, "USD", 100, JULY_5),
                priced(50, "EUR", null, JULY_5),
                priced(20, "EUR", null, JULY_5, true),
            ]),
            "USD",
            eurRates
        );
        expect(figures).toStrictEqual([
            { count: 2, currencyCode: "EUR", expense: 50, income: 20 },
            { count: 1, currencyCode: "USD", expense: 100, income: 0 },
        ]);
    });

    it("nets each currency on its own, so neither block borrows the other's sign", () => {
        const figures = cellFigures(
            toCells([priced(10, "USD", 10, JULY_5, true), priced(40, "EUR", null, JULY_5)]),
            "USD",
            eurRates
        );
        expect(
            figures.map((figure) => ({
                code: figure.currencyCode,
                net: figure.income - figure.expense,
            }))
        ).toStrictEqual([
            { code: "USD", net: 10 },
            { code: "EUR", net: -40 },
        ]);
    });
});

describe("switching display currency", () => {
    // A ledger written entirely under one setting stores `currency: null` on every
    // row. Reading null as "already in the display currency" relabels the whole
    // history instead of converting it — $99.15 of lunches becoming €99.15.
    const nullCurrency = [
        {
            amount: 18.5,
            amountUsd: 18.5,
            currency: null,
            date: JULY_5,
            income: false,
        },
        {
            amount: 12.4,
            amountUsd: 12.4,
            currency: null,
            date: JULY_5,
            income: false,
        },
        {
            amount: 68.25,
            amountUsd: 68.25,
            currency: null,
            date: JULY_5,
            income: false,
        },
    ];

    it("leaves the figures alone while the setting still matches", () => {
        expect(currencyTotals(nullCurrency, "USD", eurRates)).toStrictEqual([
            { amount: -99.15, currencyCode: "USD", transactionCount: 3 },
        ]);
    });

    it("converts the whole history when the setting changes", () => {
        // 99.15 USD at the 5 July rate of 0.90, converted once.
        expect(currencyTotals(nullCurrency, "EUR", eurRates)).toStrictEqual([
            { amount: -89.24, currencyCode: "EUR", transactionCount: 3 },
        ]);
    });

    it("falls back to the ledger's currency for a row nothing can place", () => {
        const orphan = [
            {
                amount: 40,
                amountUsd: null,
                currency: null,
                date: JULY_5,
                income: false,
            },
        ];
        expect(currencyTotals(orphan, "EUR", eurRates)).toStrictEqual([
            { amount: -40, currencyCode: "EUR", transactionCount: 1 },
        ]);
    });
});
