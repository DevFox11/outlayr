const { execFileSync } = require("node:child_process");
const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

/**
 * Pins the zone every test runs in. `globalSetup` runs before the workers are
 * forked, so they inherit it. Without this, the suites that reason about local
 * days (savings-goal pace, budget windows) pass in a UTC-negative zone and fail
 * anywhere east of Greenwich, where "22:00Z" is already tomorrow and local
 * midnight of the 1st is still the 30th in UTC. Caracas is where those cases
 * were written and where most of the ledger's data comes from.
 *
 * Also builds the intlayer dictionaries when `.intlayer/` is absent or older
 * than `src/content/`. The `test` script chains `intlayer build`, but a raw
 * `jest` in a fresh worktree skips it and every suite that touches
 * `src/i18n/catalog.ts` dies at import with "Cannot read properties of
 * undefined (reading 'key')", which reads as a mass regression rather than a
 * missing artifact. A rebase that brings in a new `*.content.ts` leaves the
 * same failure behind a stale build, so freshness is checked by mtime rather
 * than existence. Not on every run: the build takes a lock in
 * `.intlayer/cache`, and re-running it on every jest start is what the old
 * pre-push race was made of.
 */
module.exports = function globalSetup() {
    process.env.TZ = "America/Caracas";

    const root = join(__dirname, "..");
    if (newestMtime(join(root, ".intlayer", "dictionary")) < newestMtime(join(root, "src", "content"))) {
        execFileSync(join(root, "node_modules", ".bin", "intlayer"), ["build"], { cwd: root, stdio: "inherit" });
    }
};

/** The newest mtime among a directory's files, or -Infinity when it is missing or empty. */
function newestMtime(dir) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return Number.NEGATIVE_INFINITY;
    }
    return entries.reduce(
        (newest, name) => Math.max(newest, statSync(join(dir, name)).mtimeMs),
        Number.NEGATIVE_INFINITY
    );
}
