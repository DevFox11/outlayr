import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cn } from "./tw";

const SIZES = [
	"text-micro",
	"text-eyebrow",
	"text-label",
	"text-footnote",
	"text-caption",
	"text-subtitle",
	"text-body",
	"text-callout",
	"text-headline",
	"text-title",
	"text-hero",
] as const;

const TONES = [
	"text-foreground",
	"text-muted",
	"text-danger",
	"text-income",
	"text-future",
	"text-tint",
] as const;

/**
 * The reason this file exists. `tailwind-merge` does not know this app's
 * `--text-*` scale, so out of the box it files every size under *colour* and a
 * size cancels against a tone — `cn("text-body", "text-danger")` returns just
 * the colour, and the typography silently disappears. `tw.ts` declares the
 * sizes to fix that, and these tests keep it fixed.
 */
describe("cn keeps a size and a tone from cancelling", () => {
	it("preserves every size token against every tone", () => {
		for (const size of SIZES) {
			for (const tone of TONES) {
				const out = cn(size, tone) ?? "";
				assert.ok(
					out.includes(size),
					`${size} was dropped when combined with ${tone} -> "${out}"`,
				);
				assert.ok(
					out.includes(tone),
					`${tone} was dropped when combined with ${size} -> "${out}"`,
				);
			}
		}
	});

	it("survives a size and tone already sharing one string", () => {
		const out = cn("text-body text-muted", "text-danger") ?? "";
		assert.ok(out.includes("text-body"));
		assert.ok(out.includes("text-danger"));
		assert.ok(!out.includes("text-muted"), "the later tone should win");
	});

	it("keeps the custom tracking tokens too", () => {
		const out = cn("text-eyebrow tracking-eyebrow", "text-muted") ?? "";
		assert.ok(out.includes("tracking-eyebrow"));
		assert.ok(out.includes("text-eyebrow"));
	});
});

describe("cn still deduplicates what it should", () => {
	it("lets a later tone replace an earlier one", () => {
		assert.equal(cn("text-muted", "text-danger"), "text-danger");
	});

	it("lets a later size replace an earlier one", () => {
		assert.equal(cn("text-body", "text-title"), "text-title");
	});

	it("resolves stock Tailwind conflicts as normal", () => {
		assert.equal(cn("px-2", "px-4"), "px-4");
		assert.equal(cn("bg-background", "bg-surface"), "bg-surface");
	});
});

describe("cn input handling", () => {
	it("ignores falsy so conditional classes read naturally", () => {
		assert.equal(cn("text-body", false, null, undefined), "text-body");
	});

	it("returns undefined rather than an empty string when nothing applies", () => {
		assert.equal(cn(false), undefined);
		assert.equal(cn(), undefined);
	});

	it("joins several truthy values", () => {
		const out = cn("flex-1", "px-4", "text-body") ?? "";
		for (const part of ["flex-1", "px-4", "text-body"]) {
			assert.ok(out.includes(part));
		}
	});
});
