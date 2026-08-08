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
	swapTimeLabel: false,
	use24Hour: false,
};

describe("dayCardContent", () => {
	it("titles the card with the day", () => {
		expect(dayCardContent(SECTION, OPTIONS, DAY).dayLabel).toBe("TODAY");
	});

	it("falls back to the calendar label for a day that is not today", () => {
		const label = dayCardContent(
			SECTION,
			OPTIONS,
			new Date(2026, 7, 20),
		).dayLabel;
		expect(label.includes("JUL")).toBeTruthy();
	});

	it("prints the day's signed total", () => {
		expect(dayCardContent(SECTION, OPTIONS, DAY).total).toBe("-$42.50");
	});

	it("joins two currencies with a slash rather than adding them", () => {
		const mixed = {
			...SECTION,
			totals: [
				{ currencyCode: "USD", amount: -20, transactionCount: 1 },
				{ currencyCode: "EUR", amount: -12.5, transactionCount: 1 },
			],
		};
		expect(dayCardContent(mixed, OPTIONS, DAY).total).toBe("-$20.00 / -€12.50");
	});

	it("signs each row and uses the row's own currency", () => {
		const card = dayCardContent(SECTION, OPTIONS, DAY);
		expect(card.rows[0]?.amount).toBe("-€12.50");
		expect(card.rows[1]?.amount).toBe("+$30.00");
	});

	it("drops the cents when the setting is off", () => {
		const card = dayCardContent(SECTION, { ...OPTIONS, showCents: false }, DAY);
		expect(card.rows[0]?.amount).toBe("-€12");
	});

	it("subtitles a row with its time", () => {
		expect(dayCardContent(SECTION, OPTIONS, DAY).rows[0]?.meta).toBe("9:30 AM");
	});

	it("subtitles a row on a 24-hour clock when the setting asks for one", () => {
		const card = dayCardContent(SECTION, { ...OPTIONS, use24Hour: true }, DAY);
		expect(card.rows[0]?.meta).toBe("09:30");
	});

	it("subtitles with the category when the label is swapped", () => {
		const card = dayCardContent(
			SECTION,
			{ ...OPTIONS, swapTimeLabel: true },
			DAY,
		);
		expect(card.rows[0]?.meta).toBe("Groceries");
	});

	it("keeps the rows in the order the list painted them", () => {
		const card = dayCardContent(SECTION, OPTIONS, DAY);
		expect(card.rows.map((row) => row.note)).toStrictEqual([
			"Bakery",
			"Refund",
		]);
	});
});

describe("dayCardFileName", () => {
	it("names the file after the day it shows", () => {
		expect(dayCardFileName(DAY)).toBe("outlayr-2026-07-29.png");
	});
});
