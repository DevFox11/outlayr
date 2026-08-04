/// <reference types="vite/client" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { R2 } from "@convex-dev/r2";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import * as merchantKnowledge from "./merchantKnowledge";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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

async function seedKnowledgeRow(
	t: ReturnType<typeof convexTest>,
	logoKey: string | null,
) {
	await t.run((ctx) =>
		ctx.db.insert("merchantKnowledge", {
			key: "farmatodo",
			domain: "farmatodo.com",
			categoryName: "Healthcare",
			parentCategoryName: null,
			emoji: null,
			tags: [],
			logoKey,
			resolvedAt: Date.now(),
			modelId: "test-model",
		}),
	);
}

describe("lookup mints a signed logoUrl (task 6.7)", () => {
	test("a null logoKey mints no logoUrl and never touches r2.getUrl", async () => {
		const t = convexTest(schema, modules);
		await seedKnowledgeRow(t, null);
		const getUrlSpy = vi.spyOn(R2.prototype, "getUrl");

		const result = await t.query(internal.merchantKnowledge.lookup, {
			key: "farmatodo",
		});

		expect(result?.logoUrl).toBeNull();
		expect(getUrlSpy).not.toHaveBeenCalled();
		getUrlSpy.mockRestore();
	});

	test("a non-null logoKey mints a 600s signed url via r2.getUrl", async () => {
		const t = convexTest(schema, modules);
		await seedKnowledgeRow(t, "merchant/farmatodo");
		const getUrlSpy = vi
			.spyOn(R2.prototype, "getUrl")
			.mockResolvedValue("https://signed.example/merchant/farmatodo");

		const result = await t.query(internal.merchantKnowledge.lookup, {
			key: "farmatodo",
		});

		expect(result?.logoUrl).toBe("https://signed.example/merchant/farmatodo");
		expect(getUrlSpy).toHaveBeenCalledWith("merchant/farmatodo", {
			expiresIn: 600,
		});
		getUrlSpy.mockRestore();
	});

	test("a getUrl failure still returns the metadata with logoUrl null", async () => {
		const t = convexTest(schema, modules);
		await seedKnowledgeRow(t, "merchant/farmatodo");
		const getUrlSpy = vi
			.spyOn(R2.prototype, "getUrl")
			.mockRejectedValue(new Error("R2 configuration is missing"));

		const result = await t.query(internal.merchantKnowledge.lookup, {
			key: "farmatodo",
		});

		expect(result).toMatchObject({
			categoryName: "Healthcare",
			logoUrl: null,
		});
		getUrlSpy.mockRestore();
	});
});
