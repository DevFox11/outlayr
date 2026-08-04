import { readFileSync } from "node:fs";
import { join } from "node:path";

// screens/settings/index.tsx pulls 8+ contexts, so a real render for a single
// row's navigation target is the wrong layer (Mock Hygiene Rule). This reads
// the source text instead, matching domain/import-route-registration.test.ts's
// precedent for app/-adjacent structural checks.
const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");

function linkRowBlock(icon: string): string {
	const marker = `icon="${icon}"`;
	const markerIndex = SOURCE.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(`no icon="${icon}" found in screens/settings/index.tsx`);
	}
	const start = SOURCE.lastIndexOf("<LinkRow", markerIndex);
	const end = SOURCE.indexOf("/>", start);
	return SOURCE.slice(start, end);
}

describe("settings screen: data section rows", () => {
	it("points the restore row at the new backup-restore screen", () => {
		expect(linkRowBlock("ArchiveRestore")).toMatch(
			/onPress=\{\(\) => router\.push\("\/settings\/restore"\)\}/,
		);
		expect(linkRowBlock("ArchiveRestore")).toMatch(
			/title=\{t\("settings\.row\.restore"\)\}/,
		);
	});

	it("points the CSV import row at the import sheet, not the deleted legacy screen", () => {
		expect(linkRowBlock("FileImport")).toMatch(
			/onPress=\{\(\) => router\.push\("\/import"\)\}/,
		);
	});
});
