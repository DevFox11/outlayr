import { IMPORT_SOURCES } from "./import-sources";

const KNOWN_IMPORT_ROUTES: readonly string[] = [
	"/import/file",
	"/import/resolve",
	"/import/review",
];

describe("IMPORT_SOURCES", () => {
	it("has unique ids", () => {
		const ids = IMPORT_SOURCES.map((source) => source.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("points every entryRoute at a route the wizard will serve", () => {
		expect(IMPORT_SOURCES.length).toBeGreaterThan(0);
		for (const source of IMPORT_SOURCES) {
			expect(KNOWN_IMPORT_ROUTES).toContain(source.entryRoute);
		}
	});

	it("has exactly one available entry, and it is CSV", () => {
		const available = IMPORT_SOURCES.filter((source) => source.available);
		expect(available).toHaveLength(1);
		expect(available[0]?.id).toBe("csv");
	});
});
