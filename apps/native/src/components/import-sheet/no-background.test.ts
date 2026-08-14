import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

const ROOT = join(import.meta.dirname);
const SHEET_ROOT_FILE = "import-sheet.tsx";
/** Washes and cards: the Grid grammar rules ink onto the sheet's own paper. */
const WASH_CLASS = /\bbg-(surface|card|foreground\/\d+)\b/;
const SOLID_BACKGROUND_CLASS = /\bbg-background\b/;

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

describe("import-sheet backgrounds: one solid sheet, ruled step content", () => {
    it("the sheet root paints its own background through the modal's backgroundStyle", () => {
        const source = readFileSync(join(ROOT, SHEET_ROOT_FILE), "utf-8");
        expect(source).toMatch(/backgroundStyle=\{\{/);
    });

    it("no sheet content re-paints the sheet background", () => {
        const offenders = collectSourceFiles(ROOT)
            .filter((file) => SOLID_BACKGROUND_CLASS.test(readFileSync(file, "utf-8")))
            .map((file) => file.slice(ROOT.length + 1));
        expect(offenders).toStrictEqual([]);
    });

    it("no file under components/import-sheet/ draws a card wash", () => {
        const offenders = collectSourceFiles(ROOT)
            .filter((file) => WASH_CLASS.test(readFileSync(file, "utf-8")))
            .map((file) => file.slice(ROOT.length + 1));
        expect(offenders).toStrictEqual([]);
    });
});
