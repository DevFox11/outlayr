import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DAY_CARD_WIDTH,
	type DayCardInput,
	layoutDayCard,
	truncateToWidth,
} from "./day-card";

const INPUT: DayCardInput = {
	dayLabel: "WEDNESDAY 29 JUL",
	total: "-$42.50",
	rows: [
		{ note: "Bakery", meta: "9:30 am", amount: "-$12.50" },
		{ note: "Coffee", meta: "11:00 am", amount: "-$30.00" },
	],
};

describe("layoutDayCard", () => {
	it("is as wide as the card", () => {
		assert.equal(layoutDayCard(INPUT).width, DAY_CARD_WIDTH);
	});

	it("grows by a fixed height per transaction", () => {
		const row = INPUT.rows[0];
		assert.ok(row);
		const heightOf = (count: number) =>
			layoutDayCard({
				...INPUT,
				rows: Array.from({ length: count }, () => row),
			}).height;
		assert.ok(heightOf(2) > heightOf(1));
		assert.equal(heightOf(2) - heightOf(1), heightOf(3) - heightOf(2));
	});

	it("keeps every glyph inside the horizontal padding", () => {
		for (const text of layoutDayCard(INPUT).texts) {
			assert.ok(text.x >= 0 && text.x <= DAY_CARD_WIDTH, text.text);
		}
	});

	it("pins right-aligned figures to the trailing edge", () => {
		const amounts = layoutDayCard(INPUT).texts.filter(
			(text) => text.align === "right",
		);
		assert.ok(amounts.length > 0);
		assert.ok(amounts.every((text) => text.x === amounts[0]?.x));
	});

	it("keeps every glyph inside the card vertically", () => {
		const layout = layoutDayCard(INPUT);
		for (const text of layout.texts) {
			assert.ok(text.y > 0 && text.y < layout.height, text.text);
		}
	});

	it("prints the day label and the total", () => {
		const printed = layoutDayCard(INPUT).texts.map((text) => text.text);
		assert.ok(printed.includes("WEDNESDAY 29 JUL"));
		assert.ok(printed.includes("-$42.50"));
	});

	it("prints each row's note, meta and amount in order", () => {
		const printed = layoutDayCard(INPUT).texts.map((text) => text.text);
		assert.ok(
			printed.indexOf("Bakery") < printed.indexOf("Coffee"),
			printed.join("|"),
		);
		assert.ok(printed.includes("9:30 am"));
		assert.ok(printed.includes("-$30.00"));
	});

	it("signs the card", () => {
		assert.ok(
			layoutDayCard(INPUT).texts.some((text) => text.text === "OUTLAYR"),
		);
	});

	it("draws a rule under the header and above the signature", () => {
		assert.ok(layoutDayCard(INPUT).rules.length >= 2);
	});

	it("still lays out a day with no rows", () => {
		const layout = layoutDayCard({ ...INPUT, rows: [] });
		assert.ok(layout.height > 0);
		assert.ok(layout.texts.length > 0);
	});

	it("truncates a note long enough to collide with its amount", () => {
		const layout = layoutDayCard({
			...INPUT,
			rows: [
				{
					note: "A note far longer than any card could ever hope to print in one line",
					meta: "9:30 am",
					amount: "-$12.50",
				},
			],
		});
		const note = layout.texts.find((text) => text.text.startsWith("A note"));
		assert.ok(note);
		assert.ok(note.text.endsWith("…"));
	});
});

describe("truncateToWidth", () => {
	it("leaves a short string alone", () => {
		assert.equal(truncateToWidth("Bakery", 15, 200), "Bakery");
	});

	it("ends a clipped string with an ellipsis", () => {
		assert.ok(truncateToWidth("x".repeat(200), 15, 100).endsWith("…"));
	});

	it("never returns more than the ellipsis for an impossible width", () => {
		assert.equal(truncateToWidth("Bakery", 15, 0), "…");
	});
});
