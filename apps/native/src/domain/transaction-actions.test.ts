import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EN } from "@/i18n/catalog";
import { interpolate } from "@/i18n/translate";
import { RECURRING_TYPE } from "./recurrence";
import {
	logAgainDraft,
	stopRecurringPrompt,
	transactionRowActions,
} from "./transaction-actions";

const NOW = new Date(2025, 5, 15, 10, 30);
const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

describe("transactionRowActions", () => {
	it("offers Delete and Log again on a plain settled row", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.none,
			date: at(2025, 5, 1),
			future: false,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, false);
		assert.equal(actions.canDelete, true);
		assert.equal(actions.canLogAgain, true);
	});

	it("offers Stop Recurring on a live carrier", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 5, 15),
			future: false,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, true);
		assert.equal(actions.canDelete, true);
	});

	it("offers Log again on a settled carrier, whose charge did happen", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 5, 15),
			future: false,
			now: NOW,
		});

		assert.equal(actions.canLogAgain, true);
	});

	it("withholds Delete from a carrier Upcoming is projecting forward", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 5, 15),
			future: true,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, true);
		assert.equal(actions.canDelete, false);
		assert.equal(actions.canLogAgain, false);
	});

	it("keeps Delete on the pending charge itself", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 7, 15),
			future: true,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, true);
		assert.equal(actions.canDelete, true);
	});

	it("withholds Log again from a charge that has not landed yet", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 7, 15),
			future: true,
			now: NOW,
		});

		assert.equal(actions.canLogAgain, false);
	});

	it("keeps Delete on an inert row shown under Upcoming", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.none,
			date: at(2025, 7, 15),
			future: true,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, false);
		assert.equal(actions.canDelete, true);
		assert.equal(actions.canLogAgain, false);
	});
});

describe("logAgainDraft", () => {
	// Shaped like the row `getTransactionById` returns, schedule and photo
	// included, so the projection is exercised against what it really receives.
	const row = {
		id: "tx-1",
		amount: 4.75,
		income: false,
		categoryId: "cat-coffee",
		note: "Flat white",
		details: "the one by the office",
		currency: "EUR",
		date: at(2025, 5, 1),
		icon: null,
		emoji: "☕️",
		customColor: "#8A5A2B",
		imageUri: "file:///var/photos/cup.jpg",
		imageColor: "#111111",
		onceRecurring: true,
		recurringType: RECURRING_TYPE.monthly,
		recurringCoefficient: 2,
		recurringEndDate: at(2026, 5, 1),
		reminderLeadDays: 3,
	};

	it("carries the charge over field for field", () => {
		assert.deepEqual(logAgainDraft(row), {
			amount: 4.75,
			income: false,
			categoryId: "cat-coffee",
			note: "Flat white",
			details: "the one by the office",
			currency: "EUR",
			icon: null,
			emoji: "☕️",
			customColor: "#8A5A2B",
		});
	});

	it("copies exactly these fields and no others", () => {
		assert.deepEqual(Object.keys(logAgainDraft(row)).sort(), [
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
			assert.equal(
				copied.includes(field),
				false,
				`${field} must not be copied`,
			);
		}
	});

	it("carries no date, so the copy can only land today", () => {
		assert.equal(Object.keys(logAgainDraft(row)).includes("date"), false);
	});

	it("carries no photo, whose stored bytes belong to the row it came from", () => {
		const copied = Object.keys(logAgainDraft(row));

		assert.equal(copied.includes("imageUri"), false);
		assert.equal(copied.includes("imageColor"), false);
	});

	it("keeps an income row income", () => {
		const earned = { ...row, income: true };

		assert.equal(logAgainDraft(earned).income, true);
	});

	it("carries an absent note, category and detail through as they are", () => {
		const bare = {
			...row,
			note: "",
			details: null,
			categoryId: null,
			currency: null,
			emoji: null,
			customColor: null,
		};

		assert.deepEqual(logAgainDraft(bare), {
			amount: 4.75,
			income: false,
			categoryId: null,
			note: "",
			details: null,
			currency: null,
			icon: null,
			emoji: null,
			customColor: null,
		});
	});
});

describe("stopRecurringPrompt", () => {
	const render = (note: string, pending: boolean) => {
		const copy = stopRecurringPrompt(note, pending);
		return {
			title: interpolate(EN[copy.titleKey], { note: copy.note ?? undefined }),
			message: EN[copy.messageKey],
		};
	};

	it("names the entry it is about to stop", () => {
		assert.equal(render("Netflix", false).title, "Stop recurring 'Netflix'?");
	});

	it("falls back to a plain title when the entry has no note", () => {
		assert.equal(render("  ", false).title, "Stop recurring?");
	});

	it("carries no note to interpolate when the entry has none", () => {
		assert.equal(stopRecurringPrompt("  ", false).note, null);
	});

	it("says the scheduled charge still lands when the row is the pending one", () => {
		const { message } = render("Netflix", true);

		assert.match(message, /still lands/);
		assert.match(message, /Nothing is logged after it/);
	});

	it("promises entries already logged survive when the row has settled", () => {
		const { message } = render("Netflix", false);

		assert.match(message, /no longer be logged automatically/);
		assert.match(message, /already logged are kept/);
	});
});
