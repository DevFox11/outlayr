import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const SCALES = [1, 2, 3];

// A templated bitmap ships only its alpha. A consumer that draws the pixels as they are (SwiftUI's
// `Image.uiImage`) needs the colour baked in through `ink`.
const INK = "#000000";

// Lucide draws on a 24 grid at stroke 2 and carries both on the root element.
const LUCIDE_STROKE = 2;

const ICON_DIR = join(dirname(require.resolve("lucide-static/package.json")), "icons");

/**
 * Reads one Lucide glyph as plain SVG. `lucide-static` ships the artwork without React, so this
 * runs in plain node; the react-native package cannot, it pulls the RN runtime in on import.
 */
export function loadIcon(name: string, strokeWidth?: number, ink: string = INK): string {
    const source = readFileSync(join(ICON_DIR, `${name}.svg`), "utf-8");
    const width = strokeWidth ?? LUCIDE_STROKE;
    return (
        source
            .replaceAll(/\sclass="[^"]*"/g, "")
            .replaceAll(/\s(?:width|height)="24"/g, "")
            .replaceAll('stroke="currentColor"', `stroke="${ink}"`)
            .replaceAll('fill="currentColor"', `fill="${ink}"`)
            .replace('stroke-width="2"', `stroke-width="${width}"`)
            // Dropping attributes leaves the multi-line root tag with blank gaps; one line reads better.
            .replace(/<svg[\s\S]*?>/, (tag) => tag.replaceAll(/\s+/g, " "))
            .trim()
    );
}

export function rasterize(svg: string, basePath: string, points: number) {
    for (const scale of SCALES) {
        const pixels = String(points * scale);
        const suffix = scale === 1 ? "" : `@${scale}x`;
        execFileSync("rsvg-convert", ["-w", pixels, "-h", pixels, "-o", `${basePath}${suffix}.png`], { input: svg });
    }
}

export function requireRsvgConvert() {
    try {
        execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
    } catch (error) {
        throw new Error("rsvg-convert not found on PATH — install it with `brew install librsvg`", { cause: error });
    }
}

export function resetDirectory(directory: string) {
    rmSync(directory, { force: true, recursive: true });
    mkdirSync(directory, { recursive: true });
}
