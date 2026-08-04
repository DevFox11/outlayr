import { IMPORT_SOURCES } from "./import-sources";

describe("IMPORT_SOURCES", () => {
	it("has unique ids", () => {
		const ids = IMPORT_SOURCES.map((source) => source.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("carries no route field — selection moves the wizard cursor, not the router", () => {
		for (const source of IMPORT_SOURCES) {
			expect(source).not.toHaveProperty("entryRoute");
		}
	});

	it("has exactly one available entry, and it is CSV", () => {
		const available = IMPORT_SOURCES.filter((source) => source.available);
		expect(available).toHaveLength(1);
		expect(available[0]?.id).toBe("csv");
	});
});
