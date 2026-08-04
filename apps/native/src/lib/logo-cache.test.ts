import { logoCacheKey } from "./logo-cache";

describe("logoCacheKey", () => {
	it("is stable for the same name and domain", () => {
		expect(logoCacheKey("Netflix", "netflix.com")).toBe(
			logoCacheKey("Netflix", "netflix.com"),
		);
	});

	it("folds case, diacritics and punctuation to the same key", () => {
		expect(logoCacheKey("NETFLIX", "netflix.com")).toBe(
			logoCacheKey("netflix", "netflix.com"),
		);
	});

	it("differs for a different domain", () => {
		expect(logoCacheKey("Rio", "riosupermercado.com")).not.toBe(
			logoCacheKey("Rio", "rio.com"),
		);
	});
});
