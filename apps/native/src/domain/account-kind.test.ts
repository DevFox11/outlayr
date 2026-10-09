import { describe, expect, it } from "@jest/globals";
import { netWorth, toAccountKind } from "@outlayr/money/account-kind";

describe("reading a stored kind", () => {
    it("treats every account written before the column existed as an asset", () => {
        expect(toAccountKind(null)).toBe("asset");
        expect(toAccountKind(undefined)).toBe("asset");
    });

    it("refuses a value it does not know rather than trusting it", () => {
        expect(toAccountKind("chequing")).toBe("asset");
    });

    it("reads a liability", () => {
        expect(toAccountKind("liability")).toBe("liability");
    });
});

describe("splitting the accounts total into own and owe", () => {
    it("states a debt as a positive figure", () => {
        const worth = netWorth([
            { balance: 5012.4, kind: "asset" },
            { balance: -200, kind: "liability" },
        ]);
        expect(worth.own).toBe(5012.4);
        expect(worth.owe).toBe(200);
    });

    it("leaves the total exactly as the accounts card already reports it", () => {
        // The whole point: this adds a reading, it does not restate the figure.
        const accounts = [
            { balance: 5012.4, kind: "asset" as const },
            { balance: -200, kind: "liability" as const },
            { balance: -12.2, kind: "asset" as const },
        ];
        const plainTotal = accounts.reduce((sum, one) => sum + one.balance, 0);
        expect(netWorth(accounts).net).toBeCloseTo(plainTotal, 10);
    });

    it("keeps an overdrawn asset in own rather than reading it as a debt", () => {
        const worth = netWorth([{ balance: -200, kind: "asset" }]);
        expect(worth.own).toBe(-200);
        expect(worth.owe).toBe(0);
    });

    it("reports an overpaid card as a negative debt, which is what it is", () => {
        const worth = netWorth([{ balance: 40, kind: "liability" }]);
        expect(worth.owe).toBe(-40);
        expect(worth.net).toBe(40);
    });

    it("never hands a negative zero to a formatter", () => {
        expect(Object.is(netWorth([{ balance: 10, kind: "asset" }]).owe, 0)).toBe(true);
    });

    it("answers zero for a ledger with no accounts", () => {
        expect(netWorth([])).toStrictEqual({ net: 0, owe: 0, own: 0 });
    });
});
