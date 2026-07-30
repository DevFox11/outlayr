import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
		assert.equal(normalizeTagName("  work  "), "work");
	});

	it("collapses inner whitespace so one tag cannot become two", () => {
		// "work  trip" and "work trip" look identical in a list.
		assert.equal(normalizeTagName("work   trip"), "work trip");
	});

	it("cuts a name that has stopped being a label", () => {
		const long = "a".repeat(TAG_NAME_LIMIT + 10);
		assert.equal(normalizeTagName(long).length, TAG_NAME_LIMIT);
	});

	it("reads whitespace alone as unusable", () => {
		assert.equal(isUsableTagName("   "), false);
		assert.equal(isUsableTagName("work"), true);
	});
});

describe("comparing two names", () => {
	it("matches regardless of case", () => {
		assert.equal(tagKey("Work"), tagKey("work"));
	});

	it("finds an existing tag rather than making a near-duplicate", () => {
		const tags = [{ id: "1", name: "Work" }];
		assert.equal(findTagByName(tags, " work ")?.id, "1");
	});

	it("answers null when nothing matches", () => {
		assert.equal(findTagByName([{ id: "1", name: "Work" }], "travel"), null);
	});

	it("keeps the casing the owner typed", () => {
		// Matching case-insensitively must not rewrite what they wrote.
		const tags = [{ id: "1", name: "WFH" }];
		assert.equal(findTagByName(tags, "wfh")?.name, "WFH");
	});
});

describe("ordering a tag list", () => {
	it("sorts by name, ignoring case", () => {
		const sorted = sortTags([
			{ id: "1", name: "travel" },
			{ id: "2", name: "Admin" },
			{ id: "3", name: "work" },
		]);
		assert.deepEqual(
			sorted.map((tag) => tag.name),
			["Admin", "travel", "work"],
		);
	});

	it("does not mutate the list it was given", () => {
		const tags = [
			{ id: "1", name: "b" },
			{ id: "2", name: "a" },
		];
		sortTags(tags);
		assert.deepEqual(
			tags.map((tag) => tag.id),
			["1", "2"],
		);
	});
});

describe("diffing a row's tags", () => {
	it("attaches only what is new", () => {
		assert.deepEqual(tagLinkDiff(["a"], ["a", "b"]), {
			attach: ["b"],
			detach: [],
		});
	});

	it("detaches only what is gone", () => {
		assert.deepEqual(tagLinkDiff(["a", "b"], ["a"]), {
			attach: [],
			detach: ["b"],
		});
	});

	it("writes nothing when nothing moved", () => {
		// Every write replicates. Rewriting an unchanged link would push a row to
		// every other device for no reason, and a tombstone-then-recreate would
		// briefly show the entry untagged over there.
		assert.deepEqual(tagLinkDiff(["a", "b"], ["b", "a"]), {
			attach: [],
			detach: [],
		});
	});

	it("handles a row going from none to some and back", () => {
		assert.deepEqual(tagLinkDiff([], ["a"]), { attach: ["a"], detach: [] });
		assert.deepEqual(tagLinkDiff(["a"], []), { attach: [], detach: ["a"] });
	});
});
