import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORY_PALETTE } from "@/data/categories-core";
import { firstAvailableColor } from "./category-color";

describe("firstAvailableColor", () => {
	it("returns the first palette color when none are used", () => {
		assert.equal(firstAvailableColor(new Set()), CATEGORY_PALETTE[0]);
	});

	it("skips colors already used, in palette order", () => {
		const used = new Set([CATEGORY_PALETTE[0], CATEGORY_PALETTE[1]]);
		assert.equal(firstAvailableColor(used), CATEGORY_PALETTE[2]);
	});

	it("ignores colors outside the palette", () => {
		const used = new Set(["#123456"]);
		assert.equal(firstAvailableColor(used), CATEGORY_PALETTE[0]);
	});

	it("falls back to white when every palette color is used", () => {
		const used = new Set<string>(CATEGORY_PALETTE);
		assert.equal(firstAvailableColor(used), "#FFFFFF");
	});
});
