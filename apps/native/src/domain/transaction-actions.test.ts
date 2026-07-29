import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EN } from "@/i18n/catalog";
import { interpolate } from "@/i18n/translate";
import { RECURRING_TYPE } from "./recurrence";
import {
	stopRecurringPrompt,
	transactionRowActions,
} from "./transaction-actions";

const NOW = new Date(2025, 5, 15, 10, 30);
const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

describe("transactionRowActions", () => {
	it("offers only Delete on a plain settled row", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.none,
			date: at(2025, 5, 1),
			future: false,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, false);
		assert.equal(actions.canDelete, true);
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

	it("withholds Delete from a carrier Upcoming is projecting forward", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 5, 15),
			future: true,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, true);
		assert.equal(actions.canDelete, false);
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

	it("keeps Delete on an inert row shown under Upcoming", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.none,
			date: at(2025, 7, 15),
			future: true,
			now: NOW,
		});

		assert.equal(actions.canStopRecurring, false);
		assert.equal(actions.canDelete, true);
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
