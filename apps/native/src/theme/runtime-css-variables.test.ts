import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "@jest/globals";

const nativeRoot = join(import.meta.dirname, "../..");
const stylesheet = readFileSync(join(nativeRoot, "global.css"), "utf-8");
const panelui = readFileSync(join(nativeRoot, "node_modules/panelui-native/theme.css"), "utf-8");

/**
 * Every `"--token"` string literal in the app. Broader than the `useCSSVariable`
 * call sites on purpose: the biggest reader by far, `useColors`, passes a
 * `COLOR_VARIABLES` map rather than an inline array, and a rule that only saw
 * inline arrays would certify the two smallest surfaces and miss the twenty
 * names behind it.
 */
const NAME = /"(--[a-z][a-z0-9-]*)"/g;

/** Every `--token: value` line, ignoring the `@theme inline` bridge's `var(...)` aliases. */
function declares(css: string, name: string): number {
    const pattern = new RegExp(`^\\s*${name}:\\s*(?!var\\()`, "gm");
    return css.match(pattern)?.length ?? 0;
}

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            return sourceFiles(path);
        }
        return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
    });
}

function runtimeReads(): { file: string; name: string }[] {
    const seen = new Map<string, { file: string; name: string }>();
    for (const file of sourceFiles(join(nativeRoot, "src"))) {
        for (const match of readFileSync(file, "utf-8").matchAll(NAME)) {
            const read = { file: relative(nativeRoot, file), name: match[1] };
            seen.set(`${read.file} ${read.name}`, read);
        }
    }
    return [...seen.values()];
}

/**
 * `useCSSVariable` reads a variable from the live cascade, where panelui's
 * `theme.css` sits in the same `@layer theme` as ours and declares its own
 * `--color-*` names inside `@variant light` / `@variant dark` blocks. The
 * `@theme inline` bridge at the foot of `global.css` only generates utility
 * classes, so it does not answer a runtime read and cannot outrank panelui.
 *
 * A name panelui claims therefore resolves to PANELUI's palette unless we
 * re-declare it literally in our own variant blocks. That is silent: the colour
 * is plausible, nothing throws, and no rendered tree records it. It shipped
 * three times — `--color-accent-foreground` (fixed at `global.css:116` by
 * re-declaring), then the navigator theme and the import sheet's ground (both
 * fixed by reading the bare token instead).
 */
describe("variables read at runtime", () => {
    const reads = runtimeReads();

    it("finds the reads it is meant to guard", () => {
        expect(reads.length).toBeGreaterThan(20);
    });

    for (const { file, name } of reads) {
        it(`${name} in ${file} resolves to this app's palette`, () => {
            if (declares(panelui, name) === 0) {
                return;
            }
            // Both schemes, or the one we do not re-declare falls through.
            expect({ name, ours: declares(stylesheet, name) }).toStrictEqual({ name, ours: 2 });
        });
    }
});
