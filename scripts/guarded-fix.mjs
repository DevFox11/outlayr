#!/usr/bin/env node
// Biome's `useSortedAttributes` assist silently deletes JSX props on some large
// files (reproduced on 2.5.6 and 2.5.7; a fragment extracted from a failing file
// sorts cleanly, so it is file-context dependent). A formatter must preserve a
// file's identifier multiset, so this wrapper checks that invariant around
// `ultracite fix` and re-fixes any casualty with the assist disabled for it.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const FALLBACK_CONFIG = ".biome-attr-safe.json";

const REWRITTEN_BY_LINT_RULES = new Set([
	"__dirname",
	"__filename",
	"dirname",
	"filename",
	"globalThis",
	"import",
	"meta",
	"Number",
	"return",
	"undefined",
]);

function tokenize(source) {
	const counts = new Map();
	for (const token of source.match(IDENTIFIER) ?? []) {
		counts.set(token, (counts.get(token) ?? 0) + 1);
	}
	return counts;
}

function isNumericLiteralToken(token) {
	const bare = token.replaceAll("_", "");
	return /^\d+$/.test(bare) || /^x[0-9a-fA-F]+$/.test(bare);
}

function unexplainedDelta(before, after) {
	const notable = (token) => !(REWRITTEN_BY_LINT_RULES.has(token) || isNumericLiteralToken(token));
	const lost = [];
	const gained = [];

	for (const [token, count] of before) {
		const missing = count - (after.get(token) ?? 0);
		if (missing > 0 && notable(token)) {
			lost.push(`${token}×${missing}`);
		}
	}
	for (const [token, count] of after) {
		const extra = count - (before.get(token) ?? 0);
		if (extra > 0 && notable(token)) {
			gained.push(`${token}×${extra}`);
		}
	}
	return { gained, lost };
}

function run(command, args) {
	return spawnSync(command, args, { shell: false, stdio: "inherit" });
}

function sourceFiles() {
	const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
	return (listed.stdout ?? "").split("\n").filter((path) => SOURCE_FILE.test(path) && existsSync(path));
}

function writeFallbackConfig() {
	const config = JSON.parse(readFileSync("biome.json", "utf8"));
	const includes = config.files?.includes ?? [];
	config.files = {
		...config.files,
		includes: includes.includes("**") ? includes : ["**", ...includes],
	};
	config.assist = {
		...config.assist,
		actions: {
			...config.assist?.actions,
			source: {
				...config.assist?.actions?.source,
				useSortedAttributes: "off",
			},
		},
	};
	writeFileSync(FALLBACK_CONFIG, JSON.stringify(config, null, 2));
}

const files = sourceFiles();
const before = new Map(files.map((path) => [path, readFileSync(path, "utf8")]));

const fix = run("pnpm", ["exec", "ultracite", "fix", ...process.argv.slice(2)]);

const casualties = [];
for (const [path, original] of before) {
	if (!existsSync(path)) {
		continue;
	}
	const delta = unexplainedDelta(tokenize(original), tokenize(readFileSync(path, "utf8")));
	if (delta.lost.length > 0 || delta.gained.length > 0) {
		casualties.push({ delta, original, path });
	}
}

if (casualties.length === 0) {
	process.exit(fix.status ?? 0);
}

console.error(
	`\nguarded-fix: ultracite fix altered code in ${casualties.length} file(s); re-fixing without useSortedAttributes.`
);

for (const { path, original } of casualties) {
	writeFileSync(path, original);
}

writeFallbackConfig();
const healed = run("pnpm", [
	"exec",
	"biome",
	"check",
	"--write",
	`--config-path=./${FALLBACK_CONFIG}`,
	...casualties.map(({ path }) => path),
]);
rmSync(FALLBACK_CONFIG, { force: true });

let unhealed = 0;
for (const { delta, original, path } of casualties) {
	const still = unexplainedDelta(tokenize(original), tokenize(readFileSync(path, "utf8")));
	if (still.lost.length > 0 || still.gained.length > 0) {
		unhealed += 1;
		writeFileSync(path, original);
		console.error(`  UNHEALED ${path} — restored, left unformatted`);
		console.error(`    lost: ${still.lost.join(", ") || "none"}`);
	} else {
		console.error(`  healed   ${path} (lost: ${delta.lost.join(", ") || "none"})`);
	}
}

if (unhealed > 0) {
	process.exit(1);
}
process.exit(fix.status ?? healed.status ?? 0);
