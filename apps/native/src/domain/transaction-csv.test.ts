import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv } from "./csv";
import {
	CSV_HEADER,
	deduceDateFormat,
	detectDecimalSeparator,
	formatCsvDate,
	parseCsvAmount,
	parseCsvDate,
	parseCsvType,
	serializeCsvAmount,
	transactionsToCsv,
} from "./transaction-csv";

describe("serializeCsvAmount", () => {
	it("pads to the currency's minor units", () => {
		assert.equal(serializeCsvAmount(12.5, "USD"), "12.50");
	});

	it("emits no fraction for a zero-decimal currency", () => {
		assert.equal(serializeCsvAmount(1240, "JPY"), "1240");
	});

	it("uses three decimals for a dinar", () => {
		assert.equal(serializeCsvAmount(1.5, "KWD"), "1.500");
	});

	it("never groups thousands", () => {
		assert.equal(serializeCsvAmount(1234567.89, "USD"), "1234567.89");
	});

	it("writes the magnitude, leaving the sign to the type column", () => {
		assert.equal(serializeCsvAmount(-9.99, "USD"), "9.99");
	});

	it("keeps precision the currency's minor units would round away", () => {
		assert.equal(serializeCsvAmount(0.125, "USD"), "0.125");
	});
});

describe("parseCsvAmount", () => {
	it("reads a plain decimal", () => {
		assert.equal(parseCsvAmount("12.50"), 12.5);
	});

	it("reads a bare integer", () => {
		assert.equal(parseCsvAmount("1240"), 1240);
	});

	it("strips a currency symbol", () => {
		assert.equal(parseCsvAmount("$12.50"), 12.5);
	});

	it("strips thousands separators", () => {
		assert.equal(parseCsvAmount("1,234,567.89"), 1234567.89);
	});

	it("reads a comma decimal when told the column uses one", () => {
		assert.equal(parseCsvAmount("1.234,56", ","), 1234.56);
	});

	it("reads a parenthesised figure as negative", () => {
		assert.equal(parseCsvAmount("(12.50)"), -12.5);
	});

	it("reads a leading minus as negative", () => {
		assert.equal(parseCsvAmount("-12.50"), -12.5);
	});

	it("rejects a field with no digits", () => {
		assert.equal(parseCsvAmount("n/a"), null);
	});

	it("rejects a field with two decimal points", () => {
		assert.equal(parseCsvAmount("1.2.3"), null);
	});

	it("rejects an empty field", () => {
		assert.equal(parseCsvAmount(""), null);
	});
});

describe("detectDecimalSeparator", () => {
	it("defaults to a point", () => {
		assert.equal(detectDecimalSeparator(["100", "200"]), ".");
	});

	it("reads a European column when both separators appear", () => {
		assert.equal(detectDecimalSeparator(["1.234,56", "9,90"]), ",");
	});

	it("reads a US column when both separators appear", () => {
		assert.equal(detectDecimalSeparator(["1,234.56", "9.90"]), ".");
	});

	it("treats a lone three-digit tail as grouping, not a decimal", () => {
		assert.equal(detectDecimalSeparator(["1,234", "5,678"]), ".");
	});

	it("reads a lone two-digit comma tail as a decimal", () => {
		assert.equal(detectDecimalSeparator(["9,90", "12,05"]), ",");
	});
});

describe("deduceDateFormat", () => {
	it("recognises an ISO instant", () => {
		assert.equal(deduceDateFormat(["2026-07-29T10:15:00.000Z"]), "ISO");
	});

	it("recognises a plain ISO day", () => {
		assert.equal(deduceDateFormat(["2026-07-29"]), "yyyy-MM-dd");
	});

	it("prefers day-first when a first component exceeds twelve", () => {
		assert.equal(deduceDateFormat(["01/02/2026", "29/07/2026"]), "dd/MM/yyyy");
	});

	it("prefers month-first when a second component exceeds twelve", () => {
		assert.equal(deduceDateFormat(["01/02/2026", "07/29/2026"]), "MM/dd/yyyy");
	});

	it("answers null when nothing parses", () => {
		assert.equal(deduceDateFormat(["last tuesday"]), null);
	});

	it("ignores blank values when deducing", () => {
		assert.equal(deduceDateFormat(["", "2026-07-29"]), "yyyy-MM-dd");
	});
});

describe("parseCsvDate", () => {
	it("parses an ISO instant to the exact moment", () => {
		const parsed = parseCsvDate("2026-07-29T10:15:00.000Z", "ISO");
		assert.equal(parsed?.getTime(), Date.UTC(2026, 6, 29, 10, 15));
	});

	it("parses a bare day to local midnight", () => {
		const parsed = parseCsvDate("2026-07-29", "yyyy-MM-dd");
		assert.deepEqual(parsed, new Date(2026, 6, 29, 0, 0, 0, 0));
	});

	it("parses a day and time in the local zone", () => {
		const parsed = parseCsvDate("29/07/2026 14:05:09", "dd/MM/yyyy HH:mm:ss");
		assert.deepEqual(parsed, new Date(2026, 6, 29, 14, 5, 9, 0));
	});

	it("parses a separator-free format by fixed width", () => {
		const parsed = parseCsvDate("20260729", "yyyyMMdd");
		assert.deepEqual(parsed, new Date(2026, 6, 29, 0, 0, 0, 0));
	});

	it("rejects a value the format does not match", () => {
		assert.equal(parseCsvDate("29/07/2026", "yyyy-MM-dd"), null);
	});

	it("rejects an impossible day rather than rolling it over", () => {
		assert.equal(parseCsvDate("2026-02-31", "yyyy-MM-dd"), null);
	});

	it("rejects a blank value", () => {
		assert.equal(parseCsvDate("", "yyyy-MM-dd"), null);
	});
});

describe("parseCsvType", () => {
	it("reads the exported words", () => {
		assert.equal(parseCsvType("Income"), true);
		assert.equal(parseCsvType("Expense"), false);
	});

	it("ignores case and padding", () => {
		assert.equal(parseCsvType("  income "), true);
	});

	it("accepts the common synonyms", () => {
		assert.equal(parseCsvType("credit"), true);
		assert.equal(parseCsvType("debit"), false);
	});

	it("answers null for anything else", () => {
		assert.equal(parseCsvType("transfer"), null);
	});
});

describe("transactionsToCsv", () => {
	const rows = [
		{
			date: new Date(Date.UTC(2026, 6, 29, 10, 15)),
			note: "Bakery, twice",
			amount: 12.5,
			currency: "EUR",
			categoryName: "Groceries",
			income: false,
		},
		{
			date: new Date(Date.UTC(2026, 6, 28, 9, 0)),
			note: "Paycheck",
			amount: 2400,
			currency: null,
			categoryName: null,
			income: true,
		},
	];

	it("leads with the header", () => {
		assert.equal(
			transactionsToCsv(rows, "USD").split("\n")[0],
			CSV_HEADER.join(","),
		);
	});

	it("writes the ledger currency for a row that stated none", () => {
		const parsed = parseCsv(transactionsToCsv(rows, "USD"));
		assert.equal(parsed[2]?.[3], "USD");
	});

	it("keeps a comma in the note instead of deleting it", () => {
		const parsed = parseCsv(transactionsToCsv(rows, "USD"));
		assert.equal(parsed[1]?.[1], "Bakery, twice");
	});

	it("ends with a newline", () => {
		assert.ok(transactionsToCsv(rows, "USD").endsWith("\n"));
	});

	it("round-trips date, amount, currency and type exactly", () => {
		const parsed = parseCsv(transactionsToCsv(rows, "USD"));
		for (const [index, row] of rows.entries()) {
			const cells = parsed[index + 1];
			assert.ok(cells);
			assert.equal(
				parseCsvDate(cells[0] ?? "", "ISO")?.getTime(),
				row.date.getTime(),
			);
			assert.equal(parseCsvAmount(cells[2] ?? ""), row.amount);
			assert.equal(cells[3], row.currency ?? "USD");
			assert.equal(parseCsvType(cells[5] ?? ""), row.income);
		}
	});

	it("emits only the header when there is nothing to export", () => {
		assert.equal(transactionsToCsv([], "USD"), `${CSV_HEADER.join(",")}\n`);
	});
});

describe("formatCsvDate", () => {
	it("writes an ISO instant that parses back to the same moment", () => {
		const date = new Date(Date.UTC(2026, 6, 29, 10, 15, 30, 250));
		assert.equal(
			parseCsvDate(formatCsvDate(date), "ISO")?.getTime(),
			date.getTime(),
		);
	});
});
