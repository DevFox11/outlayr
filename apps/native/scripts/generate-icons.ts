// Each set empties its output directory first, so a renamed slug leaves no orphan SVG.
// `gen:icons <dir>` redoes one set and leaves the rest alone.

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { SETS } from "./icon-sets";
import type { IconSet } from "./icon-sets";
import { loadIcon, resetDirectory } from "./lucide-raster";

const appDir = resolve(dirname(process.argv[1]), "..");

// Lucide draws one glyph per icon; the selected tab reads as the same line drawn heavier.
const SELECTED_STROKE = 2.5;

function writeSet(set: IconSet): number {
    const outDir = join(appDir, "assets", set.dir);
    resetDirectory(outDir);

    let written = 0;
    for (const entry of set.entries) {
        const strokeWidth = entry.stroke ?? set.stroke;

        const base = join(outDir, entry.slug);
        writeFileSync(`${base}.svg`, loadIcon(entry.icon, strokeWidth, entry.ink));
        written += 1;

        if (entry.withSelected) {
            writeFileSync(`${base}-selected.svg`, loadIcon(entry.icon, SELECTED_STROKE, entry.ink));
            written += 1;
        }

        console.log(`  ${entry.slug} ← ${entry.icon}${entry.withSelected ? " + selected" : ""}`);
    }

    return written;
}

function main() {
    const [only] = process.argv.slice(2);
    const sets = only ? SETS.filter((set) => set.dir === only) : SETS;

    if (sets.length === 0) {
        throw new Error(`no icon set named "${only}" — known sets: ${SETS.map((set) => set.dir).join(", ")}`);
    }

    let total = 0;
    for (const set of sets) {
        console.log(`\n${set.dir}`);
        total += writeSet(set);
    }

    console.log(`\nWrote ${total} SVGs across ${sets.length} set${sets.length === 1 ? "" : "s"}`);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
