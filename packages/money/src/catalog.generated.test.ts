import { describe, expect, it } from "vitest";
import { buildCatalog } from "../scripts/lib/build-catalog.mts";
import { CURRENCY_DECIMALS, CURRENCY_META, PICKABLE_CURRENCY_CODES } from "./catalog.generated";

/**
 * Drift guard: the committed `catalog.generated.ts` MUST equal the deterministic
 * output of `buildCatalog()` over the vendored provider list + pinned CLDR data
 * + overrides overlay. Regenerate with
 * `pnpm --filter @outlayr/money generate:catalog`.
 */
describe("catalog.generated drift", () => {
	const built = buildCatalog();

	it("commits exactly the generator's code list, in order", () => {
		expect([...PICKABLE_CURRENCY_CODES]).toEqual(built.codes);
	});

	it("commits the generator's decimals record verbatim", () => {
		expect(CURRENCY_DECIMALS).toEqual(built.decimals);
	});

	it("commits the generator's metadata record verbatim", () => {
		expect(CURRENCY_META).toEqual(built.meta);
	});

	it("only ever assigns 0, 2, or 3 fraction digits", () => {
		for (const value of Object.values(built.decimals)) {
			expect([0, 2, 3]).toContain(value);
		}
	});
});
