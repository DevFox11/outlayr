import { detectCurrency } from "./detect-currency";

describe("detectCurrency", () => {
	it("reads an unambiguous symbol", () => {
		expect(detectCurrency("€12,40")).toBe("EUR");
		expect(detectCurrency("¥1,240")).toBe("JPY");
		expect(detectCurrency("₹250")).toBe("INR");
	});

	it("prefers an explicit ISO code, which cannot be ambiguous", () => {
		expect(detectCurrency("12.40 EUR")).toBe("EUR");
		expect(detectCurrency("CAD 25.00")).toBe("CAD");
		expect(detectCurrency("USD 8")).toBe("USD");
	});

	it("declines a shared symbol rather than guessing a country", () => {
		// The catalog has "$" on 22 currencies and "£" on 9.
		expect(detectCurrency("$12.40")).toBe(null);
		expect(detectCurrency("£5.00")).toBe(null);
		expect(detectCurrency("kr 99")).toBe(null);
	});

	it("declines when there is nothing to go on", () => {
		expect(detectCurrency("12.40")).toBe(null);
		expect(detectCurrency("")).toBe(null);
		expect(detectCurrency(null)).toBe(null);
		expect(detectCurrency(undefined)).toBe(null);
	});

	it("survives the spacing and signs a formatter emits", () => {
		expect(detectCurrency("  €  1.234,56  ")).toBe("EUR");
		expect(detectCurrency("-€12,40")).toBe("EUR");
		// A non-breaking space is what most locales actually put between the
		// number and its symbol.
		expect(detectCurrency("1 234,56 €")).toBe("EUR");
	});
});
