import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A test file living under app/ becomes a real, undeclared route
// (root-stack.test.ts's total-partition invariant) — these structural checks
// read app/ from the outside instead.
const APP_DIR = join(__dirname, "..", "app");
const LAYOUT_SOURCE = readFileSync(join(APP_DIR, "_layout.tsx"), "utf8");
const TRANSPARENT_CONTENT_STYLE =
	/contentStyle:\s*{\s*backgroundColor:\s*"transparent"\s*}/;

function screenBlock(name: string): string {
	const marker = `name="${name}"`;
	const start = LAYOUT_SOURCE.indexOf(marker);
	if (start === -1) {
		throw new Error(`no Stack.Screen named "${name}" found in _layout.tsx`);
	}
	const closeTag = LAYOUT_SOURCE.indexOf("/>", start);
	const openingChild = LAYOUT_SOURCE.indexOf(">", start);
	const end = closeTag === -1 ? openingChild : Math.min(closeTag, openingChild);
	return LAYOUT_SOURCE.slice(start, end === -1 ? undefined : end);
}

describe("_layout.tsx: import sheet registration", () => {
	it("declares a transparent content style on iOS", () => {
		expect(screenBlock("import")).toMatch(TRANSPARENT_CONTENT_STYLE);
	});

	it("matches the transparent contentStyle its sibling formSheets already declare", () => {
		expect(screenBlock("transaction/identity")).toMatch(
			TRANSPARENT_CONTENT_STYLE,
		);
		expect(screenBlock("settings/category-symbol")).toMatch(
			TRANSPARENT_CONTENT_STYLE,
		);
	});
});

describe("import route: single leaf file", () => {
	it("no per-step import route exists under app/import/", () => {
		for (const file of [
			"_layout.tsx",
			"index.tsx",
			"file.tsx",
			"resolve.tsx",
			"review.tsx",
		]) {
			expect(existsSync(join(APP_DIR, "import", file))).toBe(false);
		}
	});

	it("the import sheet is a single leaf route file", () => {
		expect(existsSync(join(APP_DIR, "import.tsx"))).toBe(true);
	});
});
