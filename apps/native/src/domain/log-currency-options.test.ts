import { logCurrencyOptions } from "./log-currency-options";

describe("logCurrencyOptions", () => {
    it("offers the ledger's currency alone on a single-currency ledger", () => {
        // This is what "the chip always shows" rests on: one option, still an
        // option, so the chip has something to render and stays tappable.
        expect(logCurrencyOptions({ favourites: [], global: "USD", produced: ["USD"] })).toStrictEqual(["USD"]);
    });

    it("offers the ledger's currency even when the period produced nothing", () => {
        expect(logCurrencyOptions({ favourites: [], global: "USD", produced: [] })).toStrictEqual(["USD"]);
    });

    it("leads with the ledger's currency whatever the period produced", () => {
        expect(
            logCurrencyOptions({
                favourites: [],
                global: "USD",
                produced: ["JPY", "EUR", "USD"],
            })
        ).toStrictEqual(["USD", "JPY", "EUR"]);
    });

    it("leads with the ledger's currency even when a favourite repeats it", () => {
        expect(
            logCurrencyOptions({
                favourites: ["EUR", "USD", "JPY"],
                global: "USD",
                produced: [],
            })
        ).toStrictEqual(["USD", "EUR", "JPY"]);
    });

    it("keeps favourites in the order they were arranged, not sorted", () => {
        expect(
            logCurrencyOptions({
                favourites: ["JPY", "EUR", "AUD"],
                global: "USD",
                produced: [],
            })
        ).toStrictEqual(["USD", "JPY", "EUR", "AUD"]);
    });

    it("appends a produced currency that is not already offered", () => {
        expect(
            logCurrencyOptions({
                favourites: ["EUR"],
                global: "USD",
                produced: ["VES"],
            })
        ).toStrictEqual(["USD", "EUR", "VES"]);
    });

    it("appends produced currencies after every favourite, in their own order", () => {
        expect(
            logCurrencyOptions({
                favourites: ["EUR", "JPY"],
                global: "USD",
                produced: ["VES", "COP"],
            })
        ).toStrictEqual(["USD", "EUR", "JPY", "VES", "COP"]);
    });

    it("collapses a produced currency that is already a favourite", () => {
        expect(
            logCurrencyOptions({
                favourites: ["EUR", "JPY"],
                global: "USD",
                produced: ["JPY", "USD", "EUR"],
            })
        ).toStrictEqual(["USD", "EUR", "JPY"]);
    });

    it("collapses repeats inside one list", () => {
        expect(
            logCurrencyOptions({
                favourites: ["EUR", "EUR"],
                global: "USD",
                produced: ["VES", "VES"],
            })
        ).toStrictEqual(["USD", "EUR", "VES"]);
    });

    it("collapses codes that differ only in case, keeping the first spelling", () => {
        // The kept spelling is the data's own: it is what a rate lookup and a
        // bucket label are matched against, so it must not be rewritten.
        expect(
            logCurrencyOptions({
                favourites: ["USD", "eur"],
                global: "usd",
                produced: ["EUR"],
            })
        ).toStrictEqual(["usd", "eur"]);
    });

    it("drops empty and whitespace-only codes rather than offering a blank", () => {
        expect(
            logCurrencyOptions({
                favourites: ["", " "],
                global: "USD",
                produced: ["\t", "EUR"],
            })
        ).toStrictEqual(["USD", "EUR"]);
    });

    it("trims the padding a hand-edited stored list would carry", () => {
        expect(
            logCurrencyOptions({
                favourites: [" EUR "],
                global: "USD",
                produced: ["EUR", " JPY"],
            })
        ).toStrictEqual(["USD", "EUR", "JPY"]);
    });

    it("offers a produced code the currency catalogue does not know", () => {
        // Dropping it would leave the one figure on screen unreadable: the user
        // could see the bucket and never switch the screen into it.
        expect(logCurrencyOptions({ favourites: [], global: "USD", produced: ["XXX"] })).toStrictEqual(["USD", "XXX"]);
    });

    it("never mutates the lists it is handed", () => {
        const favourites = ["EUR"];
        const produced = ["JPY"];
        logCurrencyOptions({ favourites, global: "USD", produced });
        expect(favourites).toStrictEqual(["EUR"]);
        expect(produced).toStrictEqual(["JPY"]);
    });

    describe("when a favourite cannot be reached", () => {
        const reaches =
            (...codes: string[]) =>
            (code: string) =>
                codes.includes(code);

        it("drops a favourite no rate can express a figure in", () => {
            // Offering it would put a code on the chip that the numbers beside it can
            // never be in — the screen would name CHF and print EUR.
            expect(
                logCurrencyOptions({
                    convertible: reaches("JPY"),
                    favourites: ["CHF", "JPY"],
                    global: "EUR",
                    produced: [],
                })
            ).toStrictEqual(["EUR", "JPY"]);
        });

        it("keeps the ledger's own currency even when nothing can reach it", () => {
            // It is the only way out of an override, so dropping it would trap the
            // screen in whatever it was last switched to.
            expect(
                logCurrencyOptions({
                    convertible: () => false,
                    favourites: [],
                    global: "VES",
                    produced: [],
                })
            ).toStrictEqual(["VES"]);
        });

        it("keeps a produced code even when nothing can reach it", () => {
            expect(
                logCurrencyOptions({
                    convertible: () => false,
                    favourites: [],
                    global: "USD",
                    produced: ["VES"],
                })
            ).toStrictEqual(["USD", "VES"]);
        });

        it("tests the trimmed code, not the stored spelling", () => {
            expect(
                logCurrencyOptions({
                    convertible: reaches("EUR"),
                    favourites: [" EUR "],
                    global: "USD",
                    produced: [],
                })
            ).toStrictEqual(["USD", "EUR"]);
        });

        it("offers every favourite when no predicate is given", () => {
            expect(
                logCurrencyOptions({
                    favourites: ["CHF"],
                    global: "USD",
                    produced: [],
                })
            ).toStrictEqual(["USD", "CHF"]);
        });
    });
});
