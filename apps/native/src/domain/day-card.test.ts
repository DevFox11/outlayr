import { DAY_CARD_WIDTH, type DayCardInput, layoutDayCard, truncateToWidth } from "./day-card";

const INPUT: DayCardInput = {
	dayLabel: "WEDNESDAY 29 JUL",
	rows: [
		{ amount: "-$12.50", meta: "9:30 am", note: "Bakery" },
		{ amount: "-$30.00", meta: "11:00 am", note: "Coffee" },
	],
	total: "-$42.50",
};

describe("layoutDayCard", () => {
	it("is as wide as the card", () => {
		expect(layoutDayCard(INPUT).width).toBe(DAY_CARD_WIDTH);
	});

	it("grows by a fixed height per transaction", () => {
		const row = INPUT.rows[0];
		expect(row).toBeTruthy();
		const heightOf = (count: number) =>
			layoutDayCard({
				...INPUT,
				rows: Array.from({ length: count }, () => row),
			}).height;
		expect(heightOf(2) > heightOf(1)).toBeTruthy();
		expect(heightOf(2) - heightOf(1)).toBe(heightOf(3) - heightOf(2));
	});

	it("keeps every glyph inside the horizontal padding", () => {
		for (const text of layoutDayCard(INPUT).texts) {
			expect(text.x >= 0 && text.x <= DAY_CARD_WIDTH).toBeTruthy();
		}
	});

	it("pins right-aligned figures to the trailing edge", () => {
		const amounts = layoutDayCard(INPUT).texts.filter((text) => text.align === "right");
		expect(amounts.length > 0).toBeTruthy();
		expect(amounts.every((text) => text.x === amounts[0]?.x)).toBeTruthy();
	});

	it("keeps every glyph inside the card vertically", () => {
		const layout = layoutDayCard(INPUT);
		for (const text of layout.texts) {
			expect(text.y > 0 && text.y < layout.height).toBeTruthy();
		}
	});

	it("prints the day label and the total", () => {
		const printed = layoutDayCard(INPUT).texts.map((text) => text.text);
		expect(printed.includes("WEDNESDAY 29 JUL")).toBeTruthy();
		expect(printed.includes("-$42.50")).toBeTruthy();
	});

	it("prints each row's note, meta and amount in order", () => {
		const printed = layoutDayCard(INPUT).texts.map((text) => text.text);
		expect(printed.indexOf("Bakery") < printed.indexOf("Coffee")).toBeTruthy();
		expect(printed.includes("9:30 am")).toBeTruthy();
		expect(printed.includes("-$30.00")).toBeTruthy();
	});

	it("signs the card", () => {
		expect(layoutDayCard(INPUT).texts.some((text) => text.text === "OUTLAYR")).toBeTruthy();
	});

	it("draws a rule under the header and above the signature", () => {
		expect(layoutDayCard(INPUT).rules.length >= 2).toBeTruthy();
	});

	it("still lays out a day with no rows", () => {
		const layout = layoutDayCard({ ...INPUT, rows: [] });
		expect(layout.height > 0).toBeTruthy();
		expect(layout.texts.length > 0).toBeTruthy();
	});

	it("truncates a note long enough to collide with its amount", () => {
		const layout = layoutDayCard({
			...INPUT,
			rows: [
				{
					amount: "-$12.50",
					meta: "9:30 am",
					note: "A note far longer than any card could ever hope to print in one line",
				},
			],
		});
		const note = layout.texts.find((text) => text.text.startsWith("A note"));
		if (!note) {
			throw new Error("expected the truncated note text");
		}
		expect(note.text.endsWith("…")).toBeTruthy();
	});
});

describe("truncateToWidth", () => {
	it("leaves a short string alone", () => {
		expect(truncateToWidth("Bakery", 15, 200)).toBe("Bakery");
	});

	it("ends a clipped string with an ellipsis", () => {
		expect(truncateToWidth("x".repeat(200), 15, 100).endsWith("…")).toBeTruthy();
	});

	it("never returns more than the ellipsis for an impossible width", () => {
		expect(truncateToWidth("Bakery", 15, 0)).toBe("…");
	});
});
