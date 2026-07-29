import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayCardContent, dayCardFileName } from "./day-card-content";

const DAY = new Date(2026, 6, 29);

const ROWS = [
	{
		note: "Bakery",
		amount: 12.5,
		income: false,
		currency: "EUR",
		date: new Date(2026, 6, 29, 9, 30),
		categoryName: "Groceries",
	},
	{
		note: "Refund",
		amount: 30,
		income: true,
		currency: null,
		date: new Date(2026, 6, 29, 11, 0),
		categoryName: "Shopping",
	},
];

const SECTION = {
	day: DAY,
	totals: [{ currencyCode: "USD", amount: -42.5, transactionCount: 2 }],
	data: ROWS,
};

const OPTIONS = {
	currency: "USD",
	showCents: true,
	showSign: true,
	swapTimeLabel: false,
};

describe("dayCardContent", () => {
	it("titles the card with the day", () => {
		assert.equal(dayCardContent(SECTION, OPTIONS, DAY).dayLabel, "TODAY");
	});

	it("falls back to the calendar label for a day that is not today", () => {
		const label = dayCardContent(
			SECTION,
			OPTIONS,
			new Date(2026, 7, 20),
		).dayLabel;
		assert.ok(label.includes("JUL"));
	});

	it("prints the day's signed total", () => {
		assert.equal(dayCardContent(SECTION, OPTIONS, DAY).total, "-$42.50");
	});

	it("joins two currencies with a slash rather than adding them", () => {
		const mixed = {
			...SECTION,
			totals: [
				{ currencyCode: "USD", amount: -20, transactionCount: 1 },
				{ currencyCode: "EUR", amount: -12.5, transactionCount: 1 },
			],
		};
		assert.equal(
			dayCardContent(mixed, OPTIONS, DAY).total,
			"-$20.00 / -€12.50",
		);
	});

	it("signs each row and uses the row's own currency", () => {
		const card = dayCardContent(SECTION, OPTIONS, DAY);
		assert.equal(card.rows[0]?.amount, "-€12.50");
		assert.equal(card.rows[1]?.amount, "+$30.00");
	});

	it("drops the sign when the setting is off", () => {
		const card = dayCardContent(SECTION, { ...OPTIONS, showSign: false }, DAY);
		assert.equal(card.rows[0]?.amount, "€12.50");
	});

	it("drops the cents when the setting is off", () => {
		const card = dayCardContent(SECTION, { ...OPTIONS, showCents: false }, DAY);
		assert.equal(card.rows[0]?.amount, "-€12");
	});

	it("subtitles a row with its time", () => {
		assert.equal(
			dayCardContent(SECTION, OPTIONS, DAY).rows[0]?.meta,
			"9:30 AM",
		);
	});

	it("subtitles with the category when the label is swapped", () => {
		const card = dayCardContent(
			SECTION,
			{ ...OPTIONS, swapTimeLabel: true },
			DAY,
		);
		assert.equal(card.rows[0]?.meta, "Groceries");
	});

	it("keeps the rows in the order the list painted them", () => {
		const card = dayCardContent(SECTION, OPTIONS, DAY);
		assert.deepEqual(
			card.rows.map((row) => row.note),
			["Bakery", "Refund"],
		);
	});
});

describe("dayCardFileName", () => {
	it("names the file after the day it shows", () => {
		assert.equal(dayCardFileName(DAY), "outlayr-2026-07-29.png");
	});
});
