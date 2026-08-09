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

	it("lists csv first, then clipboard, then screenshot", () => {
		expect(IMPORT_SOURCES.map((source) => source.id)).toStrictEqual(["csv", "clipboard", "screenshot"]);
	});

	it("has exactly one available entry, and it is CSV", () => {
		const available = IMPORT_SOURCES.filter((source) => source.available);
		expect(available).toHaveLength(1);
		expect(available[0]?.id).toBe("csv");
	});

	it("gives every source its own icon and title", () => {
		for (const source of IMPORT_SOURCES) {
			expect(source.icon).toBeDefined();
		}
		expect(new Set(IMPORT_SOURCES.map((source) => source.titleKey)).size).toBe(IMPORT_SOURCES.length);
	});
});
