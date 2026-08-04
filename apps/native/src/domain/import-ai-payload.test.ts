import type { ColumnMapping, ParsedImportFile } from "@/data/transfer-core";
import { parseCsvAmount, parseCsvDate } from "@/domain/transaction-csv";
import {
	buildClassificationPayload,
	MAX_LABELS,
	scrubLabel,
} from "./import-ai-payload";

const DRAFT: Record<keyof ColumnMapping, number | null> = {
	category: 1,
	note: 1,
	date: 0,
	amount: 2,
	currency: null,
	type: null,
};

const CATEGORY_TREE = [{ name: "Food", children: ["Coffee"] }];

const PARSED: ParsedImportFile = {
	header: ["date", "description", "amount"],
	rows: [
		["03/08/2026", "Coffee Shop", "12,50"],
		["04/08/2026", "Unknown Store 12345", "99,99"],
	],
	width: 3,
};

describe("scrubLabel", () => {
	test("strips a run of 4 or more digits", () => {
		expect(scrubLabel("Card ending 1234 purchase")).toBe(
			"Card ending purchase",
		);
	});

	test("keeps 7-Eleven intact", () => {
		expect(scrubLabel("7-Eleven")).toBe("7-Eleven");
	});

	test("collapses the whitespace a stripped run leaves behind", () => {
		expect(scrubLabel("Store 987654 Branch")).toBe("Store Branch");
	});

	test("keeps a run of exactly 3 digits", () => {
		expect(scrubLabel("Aisle 123 Store")).toBe("Aisle 123 Store");
	});

	test("strips a run of 4+ fullwidth digits", () => {
		expect(scrubLabel("Card ending ４５６７ purchase")).toBe(
			"Card ending purchase",
		);
	});

	test("strips a run of 4+ Arabic-Indic digits", () => {
		expect(scrubLabel("Store ٠١٢٣ Branch")).toBe("Store Branch");
	});

	test("strips a mixed run of ASCII and fullwidth digits", () => {
		expect(scrubLabel("Ref 12３４ here")).toBe("Ref here");
	});
});

describe("buildClassificationPayload", () => {
	test("returns null when there are no unresolved labels", () => {
		expect(
			buildClassificationPayload({
				parsed: PARSED,
				draft: DRAFT,
				unresolvedLabels: [],
				categoryTree: CATEGORY_TREE,
			}),
		).toBeNull();
	});

	test("returns exactly the two declared keys, with no headers or sampleRows", () => {
		const payload = buildClassificationPayload({
			parsed: PARSED,
			draft: DRAFT,
			unresolvedLabels: ["Coffee Shop", "Unknown Store 12345"],
			categoryTree: CATEGORY_TREE,
		});

		expect(payload).not.toBeNull();
		expect(Object.keys(payload as object).sort()).toEqual(
			["categoryTree", "labels"].sort(),
		);
	});

	test("caps labels at MAX_LABELS", () => {
		const manyLabels = Array.from({ length: 250 }, (_, i) => `Merchant ${i}`);

		const payload = buildClassificationPayload({
			parsed: PARSED,
			draft: DRAFT,
			unresolvedLabels: manyLabels,
			categoryTree: CATEGORY_TREE,
		});

		expect(payload).not.toBeNull();
		expect(payload?.labels.length).toBeLessThanOrEqual(MAX_LABELS);
	});

	test("a genuinely non-null payload carries the requested category tree verbatim", () => {
		const payload = buildClassificationPayload({
			parsed: PARSED,
			draft: DRAFT,
			unresolvedLabels: ["Coffee Shop"],
			categoryTree: CATEGORY_TREE,
		});

		expect(payload).not.toBeNull();
		expect(payload?.categoryTree).toEqual(CATEGORY_TREE);
		expect(payload?.labels).toEqual(["Coffee Shop"]);
	});

	test("no raw CSV date or amount string appears anywhere in the stringified payload", () => {
		const payload = buildClassificationPayload({
			parsed: PARSED,
			draft: DRAFT,
			unresolvedLabels: ["Coffee Shop", "Unknown Store 12345"],
			categoryTree: CATEGORY_TREE,
		});

		expect(payload).not.toBeNull();
		const json = JSON.stringify(payload);

		const rawDate = "03/08/2026";
		const rawAmount = "12,50";
		expect(parseCsvDate(rawDate, "dd/MM/yyyy")).not.toBeNull();
		expect(parseCsvAmount(rawAmount, ",")).not.toBeNull();
		expect(json).not.toContain(rawDate);
		expect(json).not.toContain(rawAmount);
	});
});
