import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every file holding a `'widget'`-directive component. Adding one here is part
 * of adding a widget — the guard below is worthless if a new layout skips it.
 */
const WIDGET_FILES = ["budget.tsx", "ledger.tsx", "insights.tsx", "log.tsx"];

/**
 * A top-level value declaration: `const X =`, `let x`, `function f()`, `class C`.
 * Anchored to column 0, so anything indented (i.e. inside the component) passes.
 */
const TOP_LEVEL_DECLARATION = /^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;

/**
 * A widget body is stringified by babel and evaluated inside the widget
 * extension's own bare `JSContext`, where nothing from this module's scope
 * exists. A module-level constant referenced from the body therefore resolves to
 * nothing — and it fails as a `ReferenceError` painted on the tile at render
 * time, which neither `tsc` nor the linter nor the iOS build can see. This shipped
 * once already (`MEDIUM_ROWS` in the ledger, caught only by looking at the
 * widget gallery on a simulator).
 *
 * The rule enforced here makes the mistake unrepresentable: a widget file
 * declares nothing at module scope except the component itself. Constants live
 * inside the function body, where they are captured into the string; shared
 * values arrive as props.
 */
describe("widget module scope", () => {
    for (const file of WIDGET_FILES) {
        it(`${file} declares nothing at module scope but its component`, () => {
            const source = readFileSync(join(import.meta.dirname, file), "utf-8");
            const component = file.replace(".tsx", "");
            const offenders: string[] = [];

            for (const line of source.split("\n")) {
                const match = line.match(TOP_LEVEL_DECLARATION);
                if (!match) {
                    continue;
                }
                // The component itself is the one permitted declaration; it is what
                // gets stringified, so its own name is never resolved at runtime.
                if (match[1].toLowerCase() === `${component}widget`) {
                    continue;
                }
                offenders.push(match[1]);
            }

            expect(offenders).toStrictEqual([]);
        });
    }

    it("covers every widget file that exists", () => {
        const index = readFileSync(join(import.meta.dirname, "publish.ts"), "utf-8");
        for (const file of WIDGET_FILES) {
            expect(index.includes(`./${file.replace(".tsx", "")}`)).toBeTruthy();
        }
    });
});
