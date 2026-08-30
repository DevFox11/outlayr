import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

/**
 * Both grounds these guard are painted by iOS, below the level any token reaches:
 * a SwiftUI `List` fills itself with `systemGroupedBackground` and a sheet with
 * the system material. Neither shows up in a rendered tree, so nothing else in
 * the suite can catch a screen that forgets them.
 */
const SRC = join(import.meta.dirname, "..", "..");

/**
 * `Form` as well as `List`: a SwiftUI `Form` IS a `List` underneath and paints
 * the same two grounds. Matching only `<List` is what let the account and
 * category editors ship on iOS's own grey for months.
 */
const RENDERS_SWIFTUI_LIST = /<(?:List|Form)[\s>]/;
const GROUND = /\bgroupedList\(/;
const ROW_GROUND = /\bgroupedRows\(/;
/** A value import, so the `useRef<BottomSheetModal>` type-only files are skipped. */
const RENDERS_SHEET = /import\s+\{[^}]*\bBottomSheetModal\b[^}]*\}\s+from\s+"@expo\/ui\/community\/bottom-sheet"/;
const SHEET_GROUND = /backgroundStyle=\{/;

function sourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...sourceFiles(full));
            continue;
        }
        if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
            files.push(full);
        }
    }
    return files;
}

function offenders(renders: RegExp, ground: RegExp[]): string[] {
    return sourceFiles(SRC)
        .filter((file) => {
            const source = readFileSync(file, "utf-8");
            return renders.test(source) && ground.some((pattern) => !pattern.test(source));
        })
        .map((file) => file.slice(SRC.length + 1));
}

describe("no screen keeps an iOS ground", () => {
    it("every SwiftUI List or Form names both the ground it stands on and the one its rows float on", () => {
        expect(offenders(RENDERS_SWIFTUI_LIST, [GROUND, ROW_GROUND])).toStrictEqual([]);
    });

    it("every bottom sheet paints its own background", () => {
        expect(offenders(RENDERS_SHEET, [SHEET_GROUND])).toStrictEqual([]);
    });
});
