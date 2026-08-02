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
				expect(out.includes(size)).toBeTruthy();
				expect(out.includes(tone)).toBeTruthy();
			}
		}
	});

	it("survives a size and tone already sharing one string", () => {
		const out = cn("text-body text-muted", "text-danger") ?? "";
		expect(out.includes("text-body")).toBeTruthy();
		expect(out.includes("text-danger")).toBeTruthy();
		expect(!out.includes("text-muted")).toBeTruthy();
	});

	it("keeps the custom tracking tokens too", () => {
		const out = cn("text-eyebrow tracking-eyebrow", "text-muted") ?? "";
		expect(out.includes("tracking-eyebrow")).toBeTruthy();
		expect(out.includes("text-eyebrow")).toBeTruthy();
	});
});

describe("cn still deduplicates what it should", () => {
	it("lets a later tone replace an earlier one", () => {
		expect(cn("text-muted", "text-danger")).toBe("text-danger");
	});

	it("lets a later size replace an earlier one", () => {
		expect(cn("text-body", "text-title")).toBe("text-title");
	});

	it("resolves stock Tailwind conflicts as normal", () => {
		expect(cn("px-2", "px-4")).toBe("px-4");
		expect(cn("bg-background", "bg-surface")).toBe("bg-surface");
	});
});

describe("cn input handling", () => {
	it("ignores falsy so conditional classes read naturally", () => {
		expect(cn("text-body", false, null, undefined)).toBe("text-body");
	});

	it("returns undefined rather than an empty string when nothing applies", () => {
		expect(cn(false)).toBe(undefined);
		expect(cn()).toBe(undefined);
	});

	it("joins several truthy values", () => {
		const out = cn("flex-1", "px-4", "text-body") ?? "";
		for (const part of ["flex-1", "px-4", "text-body"]) {
			expect(out.includes(part)).toBeTruthy();
		}
	});
});
