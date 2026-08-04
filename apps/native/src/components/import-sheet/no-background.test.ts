import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname);
const BACKGROUND_CLASS = /\bbg-(background|surface|card)\b/;

function collectSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectSourceFiles(full));
			continue;
		}
		if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

describe("import-sheet: no view paints its own background", () => {
	it("no source file under components/import-sheet/ uses bg-background, bg-surface, or bg-card", () => {
		const offenders = collectSourceFiles(ROOT)
			.filter((file) => BACKGROUND_CLASS.test(readFileSync(file, "utf8")))
			.map((file) => file.slice(ROOT.length + 1));

		expect(offenders).toStrictEqual([]);
	});
});
