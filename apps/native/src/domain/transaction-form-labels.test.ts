import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";
import { ctaKey, leadLabel } from "./transaction-form-labels";

const en: TranslateFn = (key, params) =>
	translate(key, { catalog: EN, fallback: EN, params });

describe("ctaKey", () => {
	it("is the save key in edit mode regardless of subscription state", () => {
		assert.equal(ctaKey("edit", true), "transaction.cta.save");
		assert.equal(ctaKey("edit", false), "transaction.cta.save");
	});

	it("is the add-subscription key when creating a subscription", () => {
		assert.equal(ctaKey("create", true), "transaction.cta.addSubscription");
	});

	it("is the plain add key when creating a one-off", () => {
		assert.equal(ctaKey("create", false), "transaction.cta.add");
	});
});

describe("leadLabel", () => {
	it("reads Off for a null lead", () => {
		assert.equal(leadLabel(en, null), "Off");
	});

	it("reads the same-day phrasing for a zero lead", () => {
		assert.equal(leadLabel(en, 0), "On the day");
	});

	it("reads the singular day-before phrasing for a one-day lead", () => {
		assert.equal(leadLabel(en, 1), "1 day before");
	});

	it("reads the counted phrasing for a two-day lead", () => {
		assert.equal(leadLabel(en, 2), "2 days before");
	});

	it("reads the counted phrasing for a three-day lead", () => {
		assert.equal(leadLabel(en, 3), "3 days before");
	});

	it("reads the week-before phrasing for a seven-day lead", () => {
		assert.equal(leadLabel(en, 7), "1 week before");
	});

	it("falls back to the counted phrasing for a lead the picker never offers", () => {
		assert.equal(leadLabel(en, 14), "14 days before");
	});
});
