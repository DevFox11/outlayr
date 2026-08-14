import { describe, expect, it } from "@jest/globals";

import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";

import { RECURRING_TYPE } from "./recurrence";
import { cadenceLabel, ctaKey, leadLabel } from "./transaction-form-labels";

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
