/**
 * Rasterizes every icon set in `icon-sets.ts`. Run after changing `SETS` and
 * commit the PNGs: `pnpm --filter @outlayr/native gen:icons`. Needs
 * `brew install librsvg`.
 *
 * Pass a directory name to redo one set only:
 *   `pnpm --filter @outlayr/native gen:icons toolbar-icons`
 *
 * Each set empties its own output directory first, so a renamed slug leaves no
 * orphan PNG behind — which is also why a filtered run never touches the sets it
 * was not asked for.
 */

import { dirname, join, resolve } from "node:path";

import { loadIcon, rasterize, requireRsvgConvert, resetDirectory, SCALE_COUNT, toSvg } from "./hugeicon-raster";
import { SETS } from "./icon-sets";
import type { IconSet } from "./icon-sets";

const appDir = resolve(dirname(process.argv[1]), "..");

async function writeSet(set: IconSet): Promise<number> {
    const outDir = join(appDir, "assets", set.dir);
    resetDirectory(outDir);

    let written = 0;
    for (const entry of set.entries) {
        const weight = entry.weight ?? "stroke";
        const size = entry.size ?? set.size;

        // A solid glyph is filled rather than stroked, so a width is meaningless on
        // it. Otherwise the set's stroke is proportional: an entry that renders
        // smaller than the set's size gets a correspondingly lighter line, so every
        // glyph in the set reads at the same weight.
        const strokeWidth = weight === "solid" || set.stroke === undefined ? undefined : (set.stroke * size) / set.size;

        // oxlint-disable-next-line no-await-in-loop -- rasterize shells out through execFileSync, which blocks the loop anyway, and each entry prints its progress line under its own set header
        const elements = await loadIcon(weight, entry.icon);
        rasterize(toSvg(elements, strokeWidth, entry.ink), join(outDir, entry.slug), size);
        written += SCALE_COUNT;

        if (entry.withSelected) {
            const solid = await loadIcon("solid", entry.icon);
            rasterize(toSvg(solid), join(outDir, `${entry.slug}-selected`), size);
            written += SCALE_COUNT;
        }

        console.log(`  ${entry.slug} ← ${entry.icon} (${weight}${entry.withSelected ? " + solid" : ""}, ${size}pt)`);
    }

    return written;
}

async function main() {
    const [only] = process.argv.slice(2);
    const sets = only ? SETS.filter((set) => set.dir === only) : SETS;

    if (sets.length === 0) {
        throw new Error(`no icon set named "${only}" — known sets: ${SETS.map((set) => set.dir).join(", ")}`);
    }

    requireRsvgConvert();

    let total = 0;
    for (const set of sets) {
        console.log(`\n${set.dir}`);
        // oxlint-disable-next-line no-await-in-loop -- writeSet empties its output directory first, so concurrent sets would interleave their progress lines under the wrong header
        total += await writeSet(set);
    }

    console.log(`\nWrote ${total} PNGs across ${sets.length} set${sets.length === 1 ? "" : "s"}`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
