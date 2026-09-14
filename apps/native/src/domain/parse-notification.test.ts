import { describe, expect, it } from "@jest/globals";

import { parseNotification } from "./parse-notification";

describe("parseNotification", () => {
    it("reads Wallet's own notification: merchant on the title, amount in the body", () => {
        expect(parseNotification("Blue Bottle Coffee\nApple Card\n$6.40")).toStrictEqual({
            amount: 6.4,
            amountText: "$6.40",
            merchant: "Blue Bottle Coffee",
        });
    });

    it("reads an English bank push", () => {
        const parsed = parseNotification(
            "Purchase alert\nYou made a $12.40 purchase at STARBUCKS with your card ending in 4321."
        );
        expect(parsed).toStrictEqual({ amount: 12.4, amountText: "$12.40", merchant: "STARBUCKS" });
    });

    it("reads a Spanish bank push with European grouping and a code", () => {
        const parsed = parseNotification("Compra aprobada por Bs. 1.250,00 en FARMATODO con tarjeta terminada en 1234");
        expect(parsed).toStrictEqual({ amount: 1250, amountText: "Bs. 1.250,00", merchant: "FARMATODO" });
        expect(parseNotification("Pago realizado por USD 25.00 en AMAZON.")).toStrictEqual({
            amount: 25,
            amountText: "USD 25.00",
            merchant: "AMAZON",
        });
    });

    it("takes the amount when the unit trails the number", () => {
        expect(parseNotification("Pago de 12,50 € en Mercadona")).toMatchObject({
            amount: 12.5,
            merchant: "Mercadona",
        });
    });

    it("does not read a card's last digits or a word as a currency", () => {
        expect(parseNotification("Your card ending in 4321 was used")).toBeNull();
        expect(parseNotification("Purchase alert\nYou spent 12 at the pen shop")).toBeNull();
    });

    it("stops the amount at a line break", () => {
        expect(parseNotification("Blue Bottle Coffee\n$6.40\n3 items")).toMatchObject({
            amount: 6.4,
            amountText: "$6.40",
        });
    });

    it("skips a notification with no amount", () => {
        expect(parseNotification("Your statement is ready")).toBeNull();
    });
});
