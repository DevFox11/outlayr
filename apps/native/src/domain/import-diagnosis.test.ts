import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

import { parseImportFile } from "@/data/transfer-core";

import { classifyParseFailure } from "./import-diagnosis";

const SOURCE = readFileSync(join(import.meta.dirname, "import-diagnosis.ts"), "utf-8");

describe("import-diagnosis.ts: shares the header heuristic with transfer-core.ts", () => {
    it("consumes splitHeaderAndRows instead of re-implementing the heuristic", () => {
        expect(SOURCE).toContain("splitHeaderAndRows");
        expect(SOURCE).not.toContain("must stay in sync");
    });
});

describe("classifyParseFailure", () => {
    it("classifies an empty file", () => {
        expect(parseImportFile("")).toBeNull();
        expect(classifyParseFailure("")).toBe("empty");
    });

    it("classifies a file that is nothing but a header", () => {
        expect(parseImportFile("Date,Note,Amount\n")).toBeNull();
        expect(classifyParseFailure("Date,Note,Amount\n")).toBe("noDataRows");
    });

    it("classifies a file with too few columns to build a row", () => {
        expect(parseImportFile("2026-07-28,12.50")).toBeNull();
        expect(classifyParseFailure("2026-07-28,12.50")).toBe("tooFewColumns");
    });
});
