import { isPlausibleAppMatch } from "./app-icon-match";

describe("isPlausibleAppMatch", () => {
	it("accepts a title that opens with the typed name", () => {
		expect(isPlausibleAppMatch("netflix", "Netflix", "Netflix, Inc.")).toBe(
			true,
		);
		expect(
			isPlausibleAppMatch(
				"duolingo",
				"Duolingo: Language Lessons",
				"Duolingo, Inc",
			),
		).toBe(true);
		expect(
			isPlausibleAppMatch("spotify", "Spotify: Music and Podcasts", "Spotify"),
		).toBe(true);
		expect(
			isPlausibleAppMatch("uber", "Uber - Request a ride", "Uber Technologies"),
		).toBe(true);
	});

	it("accepts a publisher that opens with the typed name", () => {
		expect(isPlausibleAppMatch("con edison", "Con Edison", "Con Edison")).toBe(
			true,
		);
	});

	it("ignores case, spacing and punctuation", () => {
		expect(
			isPlausibleAppMatch("apple music", "Apple Music", "Apple Inc."),
		).toBe(true);
		expect(
			isPlausibleAppMatch("YouTube  Music", "YouTube Music", "Google LLC"),
		).toBe(true);
	});

	// Both of these are real top hits the App Store search returned.
	it("rejects a third-party app that merely serves the brand", () => {
		expect(
			isPlausibleAppMatch(
				"trader joes",
				"TJ Near & Hot: Grocery Finder",
				"DNNR Tech",
			),
		).toBe(false);
	});

	it("rejects the unrelated app a nonsense query still returns", () => {
		expect(isPlausibleAppMatch("zzqq nonsense brand", "ZOX.", "ZOX, LLC")).toBe(
			false,
		);
	});

	it("accepts a typed name carrying a word the store title drops", () => {
		expect(isPlausibleAppMatch("Disney Plus", "Disney+", "Disney")).toBe(true);
		expect(
			isPlausibleAppMatch("netflix party", "Netflix", "Netflix, Inc."),
		).toBe(true);
	});

	it("does not read a publisher backwards", () => {
		// "Apple" as a seller would otherwise claim every query starting with it.
		expect(isPlausibleAppMatch("apple music", "Apple Store", "Apple")).toBe(
			false,
		);
		expect(isPlausibleAppMatch("zzqq nonsense", "ZOX.", "ZOX, LLC")).toBe(
			false,
		);
	});

	it("rejects a brand that only appears mid-title", () => {
		expect(
			isPlausibleAppMatch("uber", "Rides for Uber Drivers", "Someone Else"),
		).toBe(false);
	});

	it("rejects anything shorter than three characters", () => {
		expect(isPlausibleAppMatch("hi", "Hi", "Hi Inc")).toBe(false);
		expect(isPlausibleAppMatch("", "Anything", "Anyone")).toBe(false);
	});
});
