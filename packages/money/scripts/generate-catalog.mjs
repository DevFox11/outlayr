import { writeFileSync } from "node:fs";
import { buildCatalog } from "./lib/build-catalog.mjs";

const OUTPUT = new URL("../src/catalog.generated.ts", import.meta.url);

const HEADER = `// GENERATED FILE — DO NOT EDIT BY HAND.
// Run \`pnpm --filter @outlayr/money generate:catalog\` to regenerate.
// Source: scripts/provider-codes.json (Frankfurter USD-base blend + cotizave
// VES) overlaid with CLDR (cldr-numbers-modern names/symbols, cldr-core
// fraction digits) and scripts/overrides.json. A drift test in
// src/catalog.generated.test.ts fails if this file diverges from the generator.
`;

function serializeCodes(codes) {
	const lines = codes.map((code) => `  ${JSON.stringify(code)},`).join("\n");
	return `export const PICKABLE_CURRENCY_CODES = [\n${lines}\n] as const;`;
}

function serializeDecimals(codes, decimals) {
	const lines = codes.map((code) => `  ${code}: ${decimals[code]},`).join("\n");
	return `export const CURRENCY_DECIMALS: Record<PickableCode, 0 | 2 | 3> = {\n${lines}\n};`;
}

function serializeMeta(codes, meta) {
	const lines = codes
		.map((code) => {
			const { name, symbol } = meta[code];
			return `  ${code}: { name: ${JSON.stringify(name)}, symbol: ${JSON.stringify(symbol)} },`;
		})
		.join("\n");
	return `export const CURRENCY_META: Record<\n  PickableCode,\n  { name: string; symbol: string }\n> = {\n${lines}\n};`;
}

const { codes, decimals, meta } = buildCatalog();

const body = [
	HEADER,
	serializeCodes(codes),
	"/** A currency a user may pick as their display/default currency. */",
	"export type PickableCode = (typeof PICKABLE_CURRENCY_CODES)[number];",
	serializeDecimals(codes, decimals),
	serializeMeta(codes, meta),
].join("\n\n");

writeFileSync(OUTPUT, `${body}\n`);
process.stdout.write(
	`Wrote ${codes.length} currencies to src/catalog.generated.ts\n`,
);
