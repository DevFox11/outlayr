import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IdentitySelection } from "@/components/identity-picker-content";
import { computeCurtainHues } from "./curtain-hues";

const EMPTY_IDENTITY: IdentitySelection = {
	emoji: null,
	icon: null,
	photoUri: null,
	photoColor: null,
	color: null,
};

const BASE = {
	categoryColor: "#112233" as string | null,
	incomeColor: "#00FF00",
	foregroundColor: "#000000",
};

const NEVER_CALLED = (): string[] => {
	throw new Error("glowHues should not be called for a non-emoji identity");
};

describe("computeCurtainHues", () => {
	it("returns null when no identity is chosen", () => {
		const hues = computeCurtainHues(
			{ ...BASE, identity: EMPTY_IDENTITY, income: false },
			NEVER_CALLED,
		);
		assert.equal(hues, null);
	});

	it("falls back to the foreground color for an icon identity with no explicit color", () => {
		const hues = computeCurtainHues(
			{
				...BASE,
				categoryColor: null,
				identity: { ...EMPTY_IDENTITY, icon: "wallet" },
				income: false,
			},
			NEVER_CALLED,
		);
		assert.deepEqual(hues, ["#000000"]);
	});

	it("uses the emoji glow plus the tint for an emoji identity, capped at two glow hues", () => {
		const hues = computeCurtainHues(
			{
				...BASE,
				identity: { ...EMPTY_IDENTITY, emoji: "🎉" },
				income: false,
			},
			() => ["#AAAAAA", "#BBBBBB", "#CCCCCC"],
		);
		assert.deepEqual(hues, ["#AAAAAA", "#BBBBBB", "#112233"]);
	});

	it("uses the photo color over the computed tint for a photo identity", () => {
		const hues = computeCurtainHues(
			{
				...BASE,
				identity: {
					...EMPTY_IDENTITY,
					photoColor: "#654321",
					photoUri: "file:///a.jpg",
				},
				income: false,
			},
			NEVER_CALLED,
		);
		assert.deepEqual(hues, ["#654321"]);
	});

	it("falls back to the computed tint when a photo has no extracted color", () => {
		const hues = computeCurtainHues(
			{
				...BASE,
				identity: { ...EMPTY_IDENTITY, photoUri: "file:///a.jpg" },
				income: true,
			},
			NEVER_CALLED,
		);
		assert.deepEqual(hues, ["#00FF00"]);
	});

	it("prefers an explicit identity color over income/category tinting", () => {
		const hues = computeCurtainHues(
			{
				...BASE,
				identity: { ...EMPTY_IDENTITY, color: "#123456", icon: "wallet" },
				income: true,
			},
			NEVER_CALLED,
		);
		assert.deepEqual(hues, ["#123456"]);
	});

	it("uses the income color when income is true and no category color", () => {
		const hues = computeCurtainHues(
			{
				...BASE,
				categoryColor: null,
				identity: { ...EMPTY_IDENTITY, icon: "wallet" },
				income: true,
			},
			NEVER_CALLED,
		);
		assert.deepEqual(hues, ["#00FF00"]);
	});
});
