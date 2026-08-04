import { parseImportFile } from "@/data/transfer-core";
import { classifyParseFailure } from "./import-diagnosis";

describe("classifyParseFailure", () => {
	it("classifies an empty file", () => {
		expect(parseImportFile("")).toBe(null);
		expect(classifyParseFailure("")).toBe("empty");
	});

	it("classifies a file that is nothing but a header", () => {
		expect(parseImportFile("Date,Note,Amount\n")).toBe(null);
		expect(classifyParseFailure("Date,Note,Amount\n")).toBe("noDataRows");
	});

	it("classifies a file with too few columns to build a row", () => {
		expect(parseImportFile("2026-07-28,12.50")).toBe(null);
		expect(classifyParseFailure("2026-07-28,12.50")).toBe("tooFewColumns");
	});
});
