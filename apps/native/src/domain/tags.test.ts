import {
	findTagByName,
	isUsableTagName,
	normalizeTagName,
	sortTags,
	TAG_NAME_LIMIT,
	tagKey,
	tagLinkDiff,
} from "./tags";

describe("normalizing a tag name", () => {
	it("trims the edges", () => {
		expect(normalizeTagName("  work  ")).toBe("work");
	});

	it("collapses inner whitespace so one tag cannot become two", () => {
		// "work  trip" and "work trip" look identical in a list.
		expect(normalizeTagName("work   trip")).toBe("work trip");
	});

	it("cuts a name that has stopped being a label", () => {
		const long = "a".repeat(TAG_NAME_LIMIT + 10);
		expect(normalizeTagName(long).length).toBe(TAG_NAME_LIMIT);
	});

	it("reads whitespace alone as unusable", () => {
		expect(isUsableTagName("   ")).toBe(false);
		expect(isUsableTagName("work")).toBe(true);
	});
});

describe("comparing two names", () => {
	it("matches regardless of case", () => {
		expect(tagKey("Work")).toBe(tagKey("work"));
	});

	it("finds an existing tag rather than making a near-duplicate", () => {
		const tags = [{ id: "1", name: "Work" }];
		expect(findTagByName(tags, " work ")?.id).toBe("1");
	});

	it("answers null when nothing matches", () => {
		expect(findTagByName([{ id: "1", name: "Work" }], "travel")).toBe(null);
	});

	it("keeps the casing the owner typed", () => {
		// Matching case-insensitively must not rewrite what they wrote.
		const tags = [{ id: "1", name: "WFH" }];
		expect(findTagByName(tags, "wfh")?.name).toBe("WFH");
	});
});

describe("ordering a tag list", () => {
	it("sorts by name, ignoring case", () => {
		const sorted = sortTags([
			{ id: "1", name: "travel" },
			{ id: "2", name: "Admin" },
			{ id: "3", name: "work" },
		]);
		expect(sorted.map((tag) => tag.name)).toStrictEqual(["Admin", "travel", "work"]);
	});

	it("does not mutate the list it was given", () => {
		const tags = [
			{ id: "1", name: "b" },
			{ id: "2", name: "a" },
		];
		sortTags(tags);
		expect(tags.map((tag) => tag.id)).toStrictEqual(["1", "2"]);
	});
});

describe("diffing a row's tags", () => {
	it("attaches only what is new", () => {
		expect(tagLinkDiff(["a"], ["a", "b"])).toStrictEqual({
			attach: ["b"],
			detach: [],
		});
	});

	it("detaches only what is gone", () => {
		expect(tagLinkDiff(["a", "b"], ["a"])).toStrictEqual({
			attach: [],
			detach: ["b"],
		});
	});

	it("writes nothing when nothing moved", () => {
		// Every write replicates. Rewriting an unchanged link would push a row to
		// every other device for no reason, and a tombstone-then-recreate would
		// briefly show the entry untagged over there.
		expect(tagLinkDiff(["a", "b"], ["b", "a"])).toStrictEqual({
			attach: [],
			detach: [],
		});
	});

	it("handles a row going from none to some and back", () => {
		expect(tagLinkDiff([], ["a"])).toStrictEqual({ attach: ["a"], detach: [] });
		expect(tagLinkDiff(["a"], [])).toStrictEqual({ attach: [], detach: ["a"] });
	});
});
