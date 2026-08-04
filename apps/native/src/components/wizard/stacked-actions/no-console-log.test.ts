import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname);

/**
 * Reference defect §10.1: `item.tsx:142` logs inside a worklet. Any
 * `console.log` reachable from a `"worklet"`-tagged function runs on the UI
 * thread every animation frame, so this strip ships zero.
 */
describe("stacked-actions: no console.log", () => {
	it("no source file under stacked-actions/ calls console.log", () => {
		const offenders = readdirSync(DIR, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isFile() &&
					/\.tsx?$/.test(entry.name) &&
					!/\.test\.tsx?$/.test(entry.name),
			)
			.map((entry) => entry.name)
			.filter((name) =>
				/console\.log\s*\(/.test(readFileSync(join(DIR, name), "utf8")),
			);

		expect(offenders).toStrictEqual([]);
	});
});
