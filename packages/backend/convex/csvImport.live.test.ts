/// <reference types="vite/client" />

/**
 * The model tier against the real xAI endpoint.
 *
 * Opt-in: these spend tokens and depend on a third party being up, so a bad day
 * at xAI must never turn the ordinary suite red. Run them deliberately:
 *
 *   RUN_LIVE_MODEL_TESTS=1 \
 *   XAI_API_KEY="$(npx convex env get XAI_API_KEY)" \
 *   pnpm exec vitest run convex/csvImport.live.test.ts
 *
 * The assertions are the contract, not the answer: a generative model may
 * reasonably file a bakery under Food or under Groceries, so asserting a
 * specific mapping would encode one sampling of a non-deterministic system.
 * What must hold every time is that the response parses, that every suggestion
 * names a category the caller actually offered, and that no label is invented.
 */

import { createXai } from "@ai-sdk/xai";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { classify } from "./csvImport";
import { GROK_MODEL_ID } from "./lib/models";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

const apiKey = process.env.XAI_API_KEY ?? "";
const enabled = process.env.RUN_LIVE_MODEL_TESTS === "1" && apiKey !== "";

const MODEL_ID = process.env.XAI_MODEL_ID ?? GROK_MODEL_ID;

/** Merchants absent from the on-device map, so the model is the only tier left. */
const LABELS = ["Panaderia La Espiga SC", "Ferreteria Don Pepe", "Cafe Tostado Rincon"];

const CATEGORY_TREE = [
    { children: ["Groceries", "Restaurants"], name: "Food" },
    { children: ["Maintenance"], name: "Home" },
];

const OFFERED = new Set(CATEGORY_TREE.flatMap((branch) => [branch.name, ...branch.children]));

describe.skipIf(!enabled)("csvImport against the live model", () => {
    test("classify maps unfamiliar merchants into categories the caller offered", async () => {
        const xai = createXai({ apiKey });

        const result = await classify(xai(MODEL_ID), {
            categoryTree: CATEGORY_TREE,
            labels: LABELS,
        });

        expect(result.status).toBe("ok");
        expect(result.suggestions?.length).toBeGreaterThan(0);

        for (const suggestion of result.suggestions ?? []) {
            expect(LABELS).toContain(suggestion.label);
            expect(OFFERED.has(suggestion.categoryName)).toBeTruthy();
            // The model tier never sources a domain; only merchantKnowledge does.
            expect(suggestion.domain).toBeNull();
        }
    }, 30_000);

    test("the action returns ok end to end for an authenticated caller", async () => {
        vi.stubEnv("XAI_API_KEY", apiKey);
        const t = convexTest(schema, modules);
        rateLimiterTest.register(t);
        const identity = await seedAuthUser(t);

        const result = await authenticatedAs(t, identity).action(api.csvImport.csvImport, {
            categoryTree: CATEGORY_TREE,
            groundedLookup: false,
            labels: LABELS,
        });

        expect(result.status).toBe("ok");
        expect(result.suggestions?.length).toBeGreaterThan(0);
        for (const suggestion of result.suggestions ?? []) {
            expect(OFFERED.has(suggestion.categoryName)).toBeTruthy();
        }
    }, 30_000);
});
