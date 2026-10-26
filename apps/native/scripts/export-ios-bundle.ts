import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const nativeRoot = resolve(import.meta.dirname, "..");

/**
 * Windows resolves `npx` through a `.cmd` shim, which execFile cannot spawn without a shell,
 * so the whole line goes through one with quoted arguments.
 */
function run(command: string, args: string[]): void {
    const line = [command, ...args.map((arg) => `"${arg}"`)].join(" ");
    execFileSync(line, { cwd: nativeRoot, shell: true, stdio: ["ignore", "ignore", "inherit"] });
}

// Builds the intlayer dictionaries first: `.intlayer/` is gitignored, so a fresh checkout's export fails without it.
export function readIosBundle<T>(read: (bundle: string, map: string) => T): T {
    const outDir = mkdtempSync(join(tmpdir(), "outlayr-bundle-"));
    try {
        run("npx", ["intlayer", "build"]);
        run("npx", ["expo", "export", "--platform", "ios", "--output-dir", outDir, "--source-maps", "--no-bytecode"]);
        const jsDir = join(outDir, "_expo", "static", "js", "ios");
        const bundleName = readdirSync(jsDir).find((name) => name.endsWith(".js"));
        if (!bundleName) {
            throw new Error(`expo export wrote no .js bundle under ${jsDir}`);
        }
        return read(
            readFileSync(join(jsDir, bundleName), "utf-8"),
            readFileSync(join(jsDir, `${bundleName}.map`), "utf-8")
        );
    } finally {
        rmSync(outDir, { force: true, recursive: true });
    }
}
