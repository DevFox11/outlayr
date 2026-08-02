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

		expect(actions.canStopRecurring).toBe(false);
		expect(actions.canDelete).toBe(true);
		expect(actions.canLogAgain).toBe(true);
	});

	it("offers Stop Recurring on a live carrier", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 5, 15),
			future: false,
			now: NOW,
		});

		expect(actions.canStopRecurring).toBe(true);
		expect(actions.canDelete).toBe(true);
	});

	it("offers Log again on a settled carrier, whose charge did happen", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 5, 15),
			future: false,
			now: NOW,
		});

		expect(actions.canLogAgain).toBe(true);
	});

	it("withholds Delete from a carrier Upcoming is projecting forward", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 5, 15),
			future: true,
			now: NOW,
		});

		expect(actions.canStopRecurring).toBe(true);
		expect(actions.canDelete).toBe(false);
		expect(actions.canLogAgain).toBe(false);
	});

	it("keeps Delete on the pending charge itself", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 7, 15),
			future: true,
			now: NOW,
		});

		expect(actions.canStopRecurring).toBe(true);
		expect(actions.canDelete).toBe(true);
	});

	it("withholds Log again from a charge that has not landed yet", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.monthly,
			date: at(2025, 7, 15),
			future: true,
			now: NOW,
		});

		expect(actions.canLogAgain).toBe(false);
	});

	it("keeps Delete on an inert row shown under Upcoming", () => {
		const actions = transactionRowActions({
			recurringType: RECURRING_TYPE.none,
			date: at(2025, 7, 15),
			future: true,
			now: NOW,
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
		expect(logAgainDraft(row)).toStrictEqual({
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
			expect(copied.includes(field)).toBe(false);
		}
	});

	it("carries no date, so the copy can only land today", () => {
		expect(Object.keys(logAgainDraft(row)).includes("date")).toBe(false);
	});

	it("carries no photo, whose stored bytes belong to the row it came from", () => {
		const copied = Object.keys(logAgainDraft(row));

		expect(copied.includes("imageUri")).toBe(false);
		expect(copied.includes("imageColor")).toBe(false);
	});

	it("keeps an income row income", () => {
		const earned = { ...row, income: true };

		expect(logAgainDraft(earned).income).toBe(true);
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

		expect(logAgainDraft(bare)).toStrictEqual({
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
		expect(render("Netflix", false).title).toBe("Stop recurring 'Netflix'?");
	});

	it("falls back to a plain title when the entry has no note", () => {
		expect(render("  ", false).title).toBe("Stop recurring?");
	});

	it("carries no note to interpolate when the entry has none", () => {
		expect(stopRecurringPrompt("  ", false).note).toBe(null);
	});

	it("says the scheduled charge still lands when the row is the pending one", () => {
		const { message } = render("Netflix", true);

		expect(message).toMatch(/still lands/);
		expect(message).toMatch(/Nothing is logged after it/);
	});

	it("promises entries already logged survive when the row has settled", () => {
		const { message } = render("Netflix", false);

		expect(message).toMatch(/no longer be logged automatically/);
		expect(message).toMatch(/already logged are kept/);
	});
});
