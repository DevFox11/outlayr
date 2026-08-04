import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import * as merchantKnowledge from "./merchantKnowledge";

const SOURCE_PATH = fileURLToPath(
	new URL("./merchantKnowledge.ts", import.meta.url),
);

describe("merchantKnowledge visibility (T5)", () => {
	test("exports no public query or mutation", () => {
		const exported = Object.entries(merchantKnowledge);
		expect(exported.length).toBeGreaterThan(0);
		for (const [name, fn] of exported) {
			const flags = fn as { isPublic?: boolean; isInternal?: boolean };
			// `isPublic`/`isInternal` are the real flags Convex's registration
			// stamps on the returned handler (query/mutation vs internalQuery/
			// internalMutation) — asserting against `api.merchantKnowledge` at
			// runtime cannot catch this, because the generated `api` object is
			// an untyped `anyApi` proxy that resolves any property access.
			expect(flags.isPublic, `${name} must not be public`).not.toBe(true);
			expect(flags.isInternal, `${name} must be internal`).toBe(true);
		}
	});

	test("no exported handler calls .collect() on merchantKnowledge", () => {
		const source = readFileSync(SOURCE_PATH, "utf8");
		expect(source).not.toMatch(/\.collect\(/);
	});

	test("only registers query/mutation functions through internalQuery/internalMutation", () => {
		const source = readFileSync(SOURCE_PATH, "utf8");
		expect(source).not.toMatch(
			/\bimport\s*\{[^}]*\bquery\b[^}]*\}\s*from\s*"\.\/_generated\/server"/,
		);
		expect(source).not.toMatch(
			/\bimport\s*\{[^}]*\bmutation\b[^}]*\}\s*from\s*"\.\/_generated\/server"/,
		);
	});
});
