import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The import flow is one BottomSheetModal presented over the Log — never an
// expo-router route. These structural checks pin that architecture: a stray
// app/import route would re-grow the nested-navigator sheet this replaced.
const APP_DIR = join(import.meta.dirname, "..", "app");
const LAYOUT_SOURCE = readFileSync(join(APP_DIR, "_layout.tsx"), "utf-8");
const IMPORT_SHEET_DIR = join(import.meta.dirname, "..", "components", "import-sheet");
const IMPORT_SHEET_SOURCE = readFileSync(join(IMPORT_SHEET_DIR, "import-sheet.tsx"), "utf-8");

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

describe("import is a sheet, not a route", () => {
    it("no app/import directory or leaf route exists", () => {
        expect(existsSync(join(APP_DIR, "import"))).toBe(false);
        expect(existsSync(join(APP_DIR, "import.tsx"))).toBe(false);
    });

    it("the root layout registers no import screen and owns no sheet background constant", () => {
        expect(LAYOUT_SOURCE).not.toMatch(/name="import"/);
        expect(LAYOUT_SOURCE).not.toMatch(/SHEET_BACKGROUND_COLOR/);
    });

    it("the route-href indirection is gone", () => {
        expect(existsSync(join(import.meta.dirname, "import-routes.ts"))).toBe(false);
    });

    it("only the sheet root touches expo-router — steps navigate through the draft store", () => {
        const offenders = collectSourceFiles(IMPORT_SHEET_DIR)
            .filter((file) => !file.endsWith("import-sheet.tsx"))
            .filter((file) => /from "expo-router"/.test(readFileSync(file, "utf-8")))
            .map((file) => file.slice(IMPORT_SHEET_DIR.length + 1));
        expect(offenders).toStrictEqual([]);
    });
});

describe("the sheet is one BottomSheetModal in the currency-picker pattern", () => {
    it("uses BottomSheetModal from @expo/ui with dynamic sizing", () => {
        expect(IMPORT_SHEET_SOURCE).toMatch(/from "@expo\/ui\/community\/bottom-sheet"/);
        expect(IMPORT_SHEET_SOURCE).toMatch(/<BottomSheetModal/);
        expect(IMPORT_SHEET_SOURCE).toMatch(/enableDynamicSizing\b(?!=\{false\})/);
        expect(IMPORT_SHEET_SOURCE).toMatch(/enablePanDownToClose/);
        expect(IMPORT_SHEET_SOURCE).not.toMatch(/snapPoints=/);
    });
});

describe("no navigator chrome under the import sheet", () => {
    it("zero headerRight/headerLeft occurrences under components/import-sheet/**", () => {
        const offenders = collectSourceFiles(IMPORT_SHEET_DIR).filter((file) =>
            /headerRight|headerLeft/.test(readFileSync(file, "utf-8"))
        );
        expect(offenders).toStrictEqual([]);
    });

    it("zero common.cancel occurrences under components/import-sheet/**", () => {
        const offenders = collectSourceFiles(IMPORT_SHEET_DIR).filter((file) =>
            /common\.cancel/.test(readFileSync(file, "utf-8"))
        );
        expect(offenders).toStrictEqual([]);
    });

    it("zero ActionStrip / wizard / footer-slot references under components/import-sheet/**", () => {
        const offenders = collectSourceFiles(IMPORT_SHEET_DIR).filter((file) =>
            /ActionStrip|components\/wizard|import-chrome-footer/.test(readFileSync(file, "utf-8"))
        );
        expect(offenders).toStrictEqual([]);
    });

    it("the wizard/ActionStrip component tree no longer exists", () => {
        expect(existsSync(join(import.meta.dirname, "..", "components", "wizard"))).toBe(false);
    });

    it("the navigator-era StepFrame no longer exists", () => {
        expect(existsSync(join(IMPORT_SHEET_DIR, "step-frame.tsx"))).toBe(false);
    });
});
