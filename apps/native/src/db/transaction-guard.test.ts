import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dirname, "..");

/** Where the ban is explained, so it necessarily names the API it bans. */
const EXEMPT = join(SRC, "db", "transaction.ts");

const DRIZZLE_TRANSACTION = /\.transaction\(/;

function sourceFiles(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			found.push(...sourceFiles(path));
			continue;
		}
		if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
			continue;
		}
		found.push(path);
	}
	return found;
}

/**
 * `drizzle-orm/expo-sqlite/session.js:31-42` builds the transaction in `"sync"`
 * mode and never awaits the callback, so an async one commits an empty
 * `begin; commit;` and every statement inside runs unprotected. The call site
 * reads as protected and is not — strictly worse than writing no transaction.
 *
 * This shipped once: `pullRatesIfDue` wiped `exchangeRates` and re-inserted
 * ~12,588 rows with no rollback, so a failed pull left the rate table empty and
 * every converted total fell back to face value until the next success.
 *
 * `tsc` cannot see it — the signature is honest, only the runtime is not — so a
 * source guard is what makes it unrepresentable.
 */
describe("drizzle transaction ban", () => {
	it("no source file calls drizzle's own transaction()", () => {
		const offenders = sourceFiles(SRC)
			.filter((path) => path !== EXEMPT)
			.filter((path) => DRIZZLE_TRANSACTION.test(readFileSync(path, "utf8")))
			.map((path) => relative(SRC, path));

		expect(offenders).toStrictEqual([]);
	});

	it("the exempt file still carries the helper the ban points at", () => {
		const source = readFileSync(EXEMPT, "utf8");
		expect(source.includes("export async function withTransaction")).toBeTruthy();
	});
});
