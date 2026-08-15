import { describe, expect, it } from "@jest/globals";

import { RECURRING_TYPE } from "./recurrence";
import { logAgainDraft, transactionRowActions } from "./transaction-actions";

const NOW = new Date(2025, 5, 15, 10, 30);
const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

describe("transactionRowActions", () => {
    it("offers Delete and Log again on a plain settled row", () => {
        const actions = transactionRowActions({
            date: at(2025, 5, 1),
            future: false,
            now: NOW,
            recurringType: RECURRING_TYPE.none,
        });

        expect(actions.canStopRecurring).toBe(false);
        expect(actions.canDelete).toBe(true);
        expect(actions.canLogAgain).toBe(true);
    });

    it("offers Stop Recurring on a live carrier", () => {
        const actions = transactionRowActions({
            date: at(2025, 5, 15),
            future: false,
            now: NOW,
            recurringType: RECURRING_TYPE.monthly,
        });

        expect(actions.canStopRecurring).toBe(true);
        expect(actions.canDelete).toBe(true);
    });

    it("offers Log again on a settled carrier, whose charge did happen", () => {
        const actions = transactionRowActions({
            date: at(2025, 5, 15),
            future: false,
            now: NOW,
            recurringType: RECURRING_TYPE.monthly,
        });

        expect(actions.canLogAgain).toBe(true);
    });

    it("withholds Delete from a carrier Upcoming is projecting forward", () => {
        const actions = transactionRowActions({
            date: at(2025, 5, 15),
            future: true,
            now: NOW,
            recurringType: RECURRING_TYPE.monthly,
        });

        expect(actions.canStopRecurring).toBe(true);
        expect(actions.canDelete).toBe(false);
        expect(actions.canLogAgain).toBe(false);
    });

    it("keeps Delete on the pending charge itself", () => {
        const actions = transactionRowActions({
            date: at(2025, 7, 15),
            future: true,
            now: NOW,
            recurringType: RECURRING_TYPE.monthly,
        });

        expect(actions.canStopRecurring).toBe(true);
        expect(actions.canDelete).toBe(true);
    });

    it("withholds Log again from a charge that has not landed yet", () => {
        const actions = transactionRowActions({
            date: at(2025, 7, 15),
            future: true,
            now: NOW,
            recurringType: RECURRING_TYPE.monthly,
        });

        expect(actions.canLogAgain).toBe(false);
    });

    it("keeps Delete on an inert row shown under Upcoming", () => {
        const actions = transactionRowActions({
            date: at(2025, 7, 15),
            future: true,
            now: NOW,
            recurringType: RECURRING_TYPE.none,
        });

        expect(actions.canStopRecurring).toBe(false);
        expect(actions.canDelete).toBe(true);
        expect(actions.canLogAgain).toBe(false);
    });
});

describe("logAgainDraft", () => {
    // Shaped like the row `getTransactionById` returns, schedule and photo
    // included, so the projection is exercised against what it really receives.
    const row = {
        amount: 4.75,
        categoryId: "cat-coffee",
        currency: "EUR",
        customColor: "#8A5A2B",
        date: at(2025, 5, 1),
        details: "the one by the office",
        emoji: "☕️",
        icon: null,
        id: "tx-1",
        imageColor: "#111111",
        imageUri: "file:///var/photos/cup.jpg",
        income: false,
        note: "Flat white",
        onceRecurring: true,
        recurringCoefficient: 2,
        recurringEndDate: at(2026, 5, 1),
        recurringType: RECURRING_TYPE.monthly,
        reminderLeadDays: 3,
    };

    it("carries the charge over field for field", () => {
        expect(logAgainDraft(row)).toStrictEqual({
            amount: 4.75,
            categoryId: "cat-coffee",
            currency: "EUR",
            customColor: "#8A5A2B",
            details: "the one by the office",
            emoji: "☕️",
            icon: null,
            income: false,
            note: "Flat white",
        });
    });

    it("copies exactly these fields and no others", () => {
        expect(Object.keys(logAgainDraft(row)).sort()).toStrictEqual([
            "amount",
            "categoryId",
            "currency",
            "customColor",
            "details",
            "emoji",
            "icon",
            "income",
            "note",
        ]);
    });

    it("leaves the schedule and its reminder behind", () => {
        const copied = Object.keys(logAgainDraft(row));

        for (const field of [
            "recurringType",
            "recurringCoefficient",
            "recurringEndDate",
            "reminderLeadDays",
            "onceRecurring",
        ]) {
            expect(copied).not.toContain(field);
        }
    });

    it("carries no date, so the copy can only land today", () => {
        expect(Object.keys(logAgainDraft(row))).not.toContain("date");
    });

    it("carries no photo, whose stored bytes belong to the row it came from", () => {
        const copied = Object.keys(logAgainDraft(row));

        expect(copied).not.toContain("imageUri");
        expect(copied).not.toContain("imageColor");
    });

    it("keeps an income row income", () => {
        const earned = { ...row, income: true };

        expect(logAgainDraft(earned).income).toBe(true);
    });

    it("carries an absent note, category and detail through as they are", () => {
        const bare = {
            ...row,
            categoryId: null,
            currency: null,
            customColor: null,
            details: null,
            emoji: null,
            note: "",
        };

        expect(logAgainDraft(bare)).toStrictEqual({
            amount: 4.75,
            categoryId: null,
            currency: null,
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "",
        });
    });
});
