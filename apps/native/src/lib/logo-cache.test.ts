import { logoCacheKey } from "./logo-cache";

describe("logoCacheKey", () => {
	it("is stable for the same name, domain and logoKey", () => {
		expect(logoCacheKey("Netflix", "netflix.com", "merchant/netflix")).toBe(
			logoCacheKey("Netflix", "netflix.com", "merchant/netflix"),
		);
	});

	it("differs when the shared logoKey differs, even for the same name and domain", () => {
		expect(
			logoCacheKey("Netflix", "netflix.com", "merchant/netflix-v1"),
		).not.toBe(logoCacheKey("Netflix", "netflix.com", "merchant/netflix-v2"));
	});

	it("stays backward compatible when no logoKey is given", () => {
		expect(logoCacheKey("Netflix", "netflix.com")).toBe(
			logoCacheKey("Netflix", "netflix.com", null),
		);
	});
});
