import { describe, expect, it } from "@jest/globals";

import { parseNotification } from "./parse-notification";

describe("parseNotification", () => {
    it("reads Wallet's own notification: card, then merchant with its place, then the amount", () => {
        expect(
            parseNotification("PAYONEER EUROPE LIMITED\nSumUp *Fantoni Grazia, Florence, Tuscany\n€22.60")
        ).toStrictEqual({
            amount: 22.6,
            amountText: "€22.60",
            income: false,
            merchant: "Fantoni Grazia",
        });
    });

    it("reads an English bank push", () => {
        const parsed = parseNotification(
            "Purchase alert\nYou made a $12.40 purchase at STARBUCKS with your card ending in 4321."
        );
        expect(parsed).toStrictEqual({ amount: 12.4, amountText: "$12.40", income: false, merchant: "STARBUCKS" });
    });

    it("reads Revolut's and Wise's card pushes", () => {
        expect(parseNotification("Card payment\nPaid 4,200 HUF to Wolt Hungary")).toMatchObject({
            amount: 4200,
            merchant: "Wolt Hungary",
        });
        expect(parseNotification("You spent 12.50 EUR at Spotify")).toMatchObject({
            amount: 12.5,
            merchant: "Spotify",
        });
    });

    it("reads a Spanish bank push with European grouping and a code", () => {
        const parsed = parseNotification("Compra aprobada por Bs. 1.250,00 en FARMATODO con tarjeta terminada en 1234");
        expect(parsed).toStrictEqual({
            amount: 1250,
            amountText: "Bs. 1.250,00",
            income: false,
            merchant: "FARMATODO",
        });
        expect(parseNotification("Pago realizado por USD 25.00 en AMAZON.")).toStrictEqual({
            amount: 25,
            amountText: "USD 25.00",
            income: false,
            merchant: "AMAZON",
        });
    });

    it("takes the amount when the unit trails the number", () => {
        expect(parseNotification("Pago de 12,50 € en Mercadona")).toMatchObject({
            amount: 12.5,
            merchant: "Mercadona",
        });
    });

    it("drops a declined charge", () => {
        expect(parseNotification("Declined\n$12.40 at STARBUCKS. Insufficient funds.")).toBeNull();
        expect(parseNotification("Compra rechazada por Bs. 1.250,00 en FARMATODO")).toBeNull();
        expect(parseNotification("Payment failed\nWe couldn't charge €9.99 for Netflix")).toBeNull();
    });

    it("reads money coming in as income, named by who sent it", () => {
        expect(parseNotification("You received $500.00 from Acme Inc")).toStrictEqual({
            amount: 500,
            amountText: "$500.00",
            income: true,
            merchant: "Acme Inc",
        });
        expect(parseNotification("Refund of $12.40 from STARBUCKS")).toMatchObject({
            income: true,
            merchant: "STARBUCKS",
        });
        expect(parseNotification("Recibiste USD 25.00 de Juan Pérez")).toMatchObject({
            income: true,
            merchant: "Juan Pérez",
        });
    });

    it("strips the payment processor's prefix off the merchant", () => {
        expect(parseNotification("You made a $9.00 purchase at SQ *BLUE BOTTLE with your card")).toMatchObject({
            merchant: "BLUE BOTTLE",
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
            merchant: "Blue Bottle Coffee",
        });
    });

    it("skips a notification with no amount", () => {
        expect(parseNotification("Your statement is ready")).toBeNull();
    });
});
