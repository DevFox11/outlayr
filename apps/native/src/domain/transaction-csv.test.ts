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
		expect(serializeCsvAmount(12.5, "USD")).toBe("12.50");
	});

	it("emits no fraction for a zero-decimal currency", () => {
		expect(serializeCsvAmount(1240, "JPY")).toBe("1240");
	});

	it("uses three decimals for a dinar", () => {
		expect(serializeCsvAmount(1.5, "KWD")).toBe("1.500");
	});

	it("never groups thousands", () => {
		expect(serializeCsvAmount(1_234_567.89, "USD")).toBe("1234567.89");
	});

	it("writes the magnitude, leaving the sign to the type column", () => {
		expect(serializeCsvAmount(-9.99, "USD")).toBe("9.99");
	});

	it("keeps precision the currency's minor units would round away", () => {
		expect(serializeCsvAmount(0.125, "USD")).toBe("0.125");
	});
});

describe("parseCsvAmount", () => {
	it("reads a plain decimal", () => {
		expect(parseCsvAmount("12.50")).toBe(12.5);
	});

	it("reads a bare integer", () => {
		expect(parseCsvAmount("1240")).toBe(1240);
	});

	it("strips a currency symbol", () => {
		expect(parseCsvAmount("$12.50")).toBe(12.5);
	});

	it("strips thousands separators", () => {
		expect(parseCsvAmount("1,234,567.89")).toBe(1_234_567.89);
	});

	it("reads a comma decimal when told the column uses one", () => {
		expect(parseCsvAmount("1.234,56", ",")).toBe(1234.56);
	});

	it("reads a parenthesised figure as negative", () => {
		expect(parseCsvAmount("(12.50)")).toBe(-12.5);
	});

	it("reads a leading minus as negative", () => {
		expect(parseCsvAmount("-12.50")).toBe(-12.5);
	});

	it("rejects a field with no digits", () => {
		expect(parseCsvAmount("n/a")).toBe(null);
	});

	it("rejects a field with two decimal points", () => {
		expect(parseCsvAmount("1.2.3")).toBe(null);
	});

	it("rejects an empty field", () => {
		expect(parseCsvAmount("")).toBe(null);
	});
});

describe("detectDecimalSeparator", () => {
	it("defaults to a point", () => {
		expect(detectDecimalSeparator(["100", "200"])).toBe(".");
	});

	it("reads a European column when both separators appear", () => {
		expect(detectDecimalSeparator(["1.234,56", "9,90"])).toBe(",");
	});

	it("reads a US column when both separators appear", () => {
		expect(detectDecimalSeparator(["1,234.56", "9.90"])).toBe(".");
	});

	it("treats a lone three-digit tail as grouping, not a decimal", () => {
		expect(detectDecimalSeparator(["1,234", "5,678"])).toBe(".");
	});

	it("reads a lone two-digit comma tail as a decimal", () => {
		expect(detectDecimalSeparator(["9,90", "12,05"])).toBe(",");
	});
});

describe("deduceDateFormat", () => {
	it("recognises an ISO instant", () => {
		expect(deduceDateFormat(["2026-07-29T10:15:00.000Z"])).toBe("ISO");
	});

	it("recognises a plain ISO day", () => {
		expect(deduceDateFormat(["2026-07-29"])).toBe("yyyy-MM-dd");
	});

	it("prefers day-first when a first component exceeds twelve", () => {
		expect(deduceDateFormat(["01/02/2026", "29/07/2026"])).toBe("dd/MM/yyyy");
	});

	it("prefers month-first when a second component exceeds twelve", () => {
		expect(deduceDateFormat(["01/02/2026", "07/29/2026"])).toBe("MM/dd/yyyy");
	});

	it("answers null when nothing parses", () => {
		expect(deduceDateFormat(["last tuesday"])).toBe(null);
	});

	it("ignores blank values when deducing", () => {
		expect(deduceDateFormat(["", "2026-07-29"])).toBe("yyyy-MM-dd");
	});

	it("survives a malformed value instead of failing the whole column", () => {
		expect(deduceDateFormat(["29/07/2026", "99/99/2026", "01/02/2026"])).toBe("dd/MM/yyyy");
	});

	it("still answers null when malformed values are the majority story", () => {
		expect(deduceDateFormat(["99/99/2026", "not a date"])).toBe(null);
	});

	it("settles ambiguity from the parseable values only", () => {
		expect(deduceDateFormat(["07/29/2026", "99/99/2026", "01/02/2026"])).toBe("MM/dd/yyyy");
	});
});

describe("parseCsvDate", () => {
	it("parses an ISO instant to the exact moment", () => {
		const parsed = parseCsvDate("2026-07-29T10:15:00.000Z", "ISO");
		expect(parsed?.getTime()).toBe(Date.UTC(2026, 6, 29, 10, 15));
	});

	it("parses a bare day to local midnight", () => {
		const parsed = parseCsvDate("2026-07-29", "yyyy-MM-dd");
		expect(parsed).toStrictEqual(new Date(2026, 6, 29, 0, 0, 0, 0));
	});

	it("parses a day and time in the local zone", () => {
		const parsed = parseCsvDate("29/07/2026 14:05:09", "dd/MM/yyyy HH:mm:ss");
		expect(parsed).toStrictEqual(new Date(2026, 6, 29, 14, 5, 9, 0));
	});

	it("parses a separator-free format by fixed width", () => {
		const parsed = parseCsvDate("20260729", "yyyyMMdd");
		expect(parsed).toStrictEqual(new Date(2026, 6, 29, 0, 0, 0, 0));
	});

	it("rejects a value the format does not match", () => {
		expect(parseCsvDate("29/07/2026", "yyyy-MM-dd")).toBe(null);
	});

	it("rejects an impossible day rather than rolling it over", () => {
		expect(parseCsvDate("2026-02-31", "yyyy-MM-dd")).toBe(null);
	});

	it("rejects a blank value", () => {
		expect(parseCsvDate("", "yyyy-MM-dd")).toBe(null);
	});
});

describe("parseCsvType", () => {
	it("reads the exported words", () => {
		expect(parseCsvType("Income")).toBe(true);
		expect(parseCsvType("Expense")).toBe(false);
	});

	it("ignores case and padding", () => {
		expect(parseCsvType("  income ")).toBe(true);
	});

	it("accepts the common synonyms", () => {
		expect(parseCsvType("credit")).toBe(true);
		expect(parseCsvType("debit")).toBe(false);
	});

	it("answers null for anything else", () => {
		expect(parseCsvType("transfer")).toBe(null);
	});
});

describe("transactionsToCsv", () => {
	const rows = [
		{
			amount: 12.5,
			categoryName: "Groceries",
			currency: "EUR",
			date: new Date(Date.UTC(2026, 6, 29, 10, 15)),
			income: false,
			note: "Bakery, twice",
		},
		{
			amount: 2400,
			categoryName: null,
			currency: null,
			date: new Date(Date.UTC(2026, 6, 28, 9, 0)),
			income: true,
			note: "Paycheck",
		},
	];

	it("leads with the header", () => {
		expect(transactionsToCsv(rows, "USD").split("\n")[0]).toBe(CSV_HEADER.join(","));
	});

	it("writes the ledger currency for a row that stated none", () => {
		const parsed = parseCsv(transactionsToCsv(rows, "USD"));
		expect(parsed[2]?.[3]).toBe("USD");
	});

	it("keeps a comma in the note instead of deleting it", () => {
		const parsed = parseCsv(transactionsToCsv(rows, "USD"));
		expect(parsed[1]?.[1]).toBe("Bakery, twice");
	});

	it("ends with a newline", () => {
		expect(transactionsToCsv(rows, "USD").endsWith("\n")).toBeTruthy();
	});

	it("round-trips date, amount, currency and type exactly", () => {
		const parsed = parseCsv(transactionsToCsv(rows, "USD"));
		for (const [index, row] of rows.entries()) {
			const cells = parsed[index + 1];
			expect(cells).toBeTruthy();
			expect(parseCsvDate(cells[0] ?? "", "ISO")?.getTime()).toBe(row.date.getTime());
			expect(parseCsvAmount(cells[2] ?? "")).toBe(row.amount);
			expect(cells[3]).toBe(row.currency ?? "USD");
			expect(parseCsvType(cells[5] ?? "")).toBe(row.income);
		}
	});

	it("emits only the header when there is nothing to export", () => {
		expect(transactionsToCsv([], "USD")).toBe(`${CSV_HEADER.join(",")}\n`);
	});
});

describe("formatCsvDate", () => {
	it("writes an ISO instant that parses back to the same moment", () => {
		const date = new Date(Date.UTC(2026, 6, 29, 10, 15, 30, 250));
		expect(parseCsvDate(formatCsvDate(date), "ISO")?.getTime()).toBe(date.getTime());
	});
});
