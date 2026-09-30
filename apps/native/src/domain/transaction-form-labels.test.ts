import { describe, expect, it } from "@jest/globals";

import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";

import { RECURRING_TYPE } from "./recurrence";
import { cadenceLabel, ctaKey, leadLabel, namedWithCount, transactionWhenLabel } from "./transaction-form-labels";

const en: TranslateFn = (key, params) => translate(key, { catalog: EN, fallback: EN, params });

describe("ctaKey", () => {
    it("is the save key in edit mode regardless of subscription state", () => {
        expect(ctaKey("edit", true)).toBe("transaction.cta.save");
        expect(ctaKey("edit", false)).toBe("transaction.cta.save");
    });

    it("is the add-subscription key when creating a subscription", () => {
        expect(ctaKey("create", true)).toBe("transaction.cta.addSubscription");
    });

    it("is the plain add key when creating a one-off", () => {
        expect(ctaKey("create", false)).toBe("transaction.cta.add");
    });
});

describe("namedWithCount", () => {
    it("states every name that fits, and counts the rest", () => {
        expect(namedWithCount(["Development", "Subscription"])).toBe("Development, Subscription");
        expect(namedWithCount(["Development", "Subscription", "Work", "Tools"])).toBe("Development, Subscription +2");
        expect(namedWithCount(["A name longer than the whole chip allows", "Work"])).toBe(
            "A name longer than the whole chip allows +1"
        );
    });
});

describe("leadLabel", () => {
    it("reads Off for a null lead", () => {
        expect(leadLabel(en, null)).toBe("Off");
    });

    it("reads the same-day phrasing for a zero lead", () => {
        expect(leadLabel(en, 0)).toBe("On the day");
    });

    it("reads the singular day-before phrasing for a one-day lead", () => {
        expect(leadLabel(en, 1)).toBe("1 day before");
    });

    it("reads the counted phrasing for a two-day lead", () => {
        expect(leadLabel(en, 2)).toBe("2 days before");
    });

    it("reads the counted phrasing for a three-day lead", () => {
        expect(leadLabel(en, 3)).toBe("3 days before");
    });

    it("reads the week-before phrasing for a seven-day lead", () => {
        expect(leadLabel(en, 7)).toBe("1 week before");
    });

    it("falls back to the counted phrasing for a lead the picker never offers", () => {
        expect(leadLabel(en, 14)).toBe("14 days before");
    });
});

describe("cadenceLabel", () => {
    it("names each cadence the picker offers", () => {
        expect(cadenceLabel(en, RECURRING_TYPE.daily)).toBe("Daily");
        expect(cadenceLabel(en, RECURRING_TYPE.weekly)).toBe("Weekly");
        expect(cadenceLabel(en, RECURRING_TYPE.monthly)).toBe("Monthly");
        expect(cadenceLabel(en, RECURRING_TYPE.yearly)).toBe("Yearly");
    });

    it("falls back to the monthly phrasing for a cadence the picker never offers", () => {
        expect(cadenceLabel(en, RECURRING_TYPE.none)).toBe("Monthly");
        expect(cadenceLabel(en, 99)).toBe("Monthly");
    });
});

describe("transactionWhenLabel", () => {
    const now = new Date(2026, 7, 18, 14, 30);

    it("says today for any time on the current day", () => {
        expect(transactionWhenLabel(en, { date: new Date(2026, 7, 18, 1), interval: null, language: "en", now })).toBe(
            "today"
        );
    });

    it("says yesterday for the day before", () => {
        expect(transactionWhenLabel(en, { date: new Date(2026, 7, 17, 23), interval: null, language: "en", now })).toBe(
            "yesterday"
        );
    });

    it("says yesterday across a daylight-saving boundary", () => {
        const originalTimezone = process.env.TZ;
        process.env.TZ = "America/New_York";
        try {
            expect(
                transactionWhenLabel(en, {
                    date: new Date(2026, 2, 8, 23),
                    interval: null,
                    language: "en",
                    now: new Date(2026, 2, 9, 14),
                })
            ).toBe("yesterday");
        } finally {
            process.env.TZ = originalTimezone;
        }
    });

    it("names the date once it is older than yesterday", () => {
        expect(transactionWhenLabel(en, { date: new Date(2026, 7, 15), interval: null, language: "en", now })).toBe(
            "on 15 Aug"
        );
    });

    it("names a future date the same way", () => {
        expect(transactionWhenLabel(en, { date: new Date(2026, 8, 2), interval: null, language: "en", now })).toBe(
            "on 2 Sep"
        );
    });

    // A subscription's timing is its cadence, so the phrase replaces the day
    // rather than sitting beside it.
    it("states the cadence instead of the day for a subscription", () => {
        expect(transactionWhenLabel(en, { date: new Date(2026, 7, 18), interval: "month", language: "en", now })).toBe(
            "every month from 18 Aug"
        );
    });
});
