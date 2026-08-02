import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	EMPTY_STATE_TIERS,
	type EmptyStateTier,
	ghostInk,
	MARK_CEILING,
} from "./empty-state-ink";

const INK = "#010101";

function alphaOf(rgba: string): number {
	const match = rgba.match(/rgba\([^)]*,\s*([\d.]+)\)$/);
	assert.ok(match, `not an rgba string: ${rgba}`);
	return Number(match[1]);
}

const LADDER: readonly EmptyStateTier[] = [...EMPTY_STATE_TIERS];

describe("the mark size ladder", () => {
	it("covers every tier", () => {
		assert.deepEqual(LADDER, ["takeover", "inFlow", "insetRow"]);
	});

	it("descends strictly — each tier is smaller than the one above", () => {
		for (let index = 1; index < LADDER.length; index++) {
			const above = MARK_CEILING[LADDER[index - 1]];
			const here = MARK_CEILING[LADDER[index]];
			assert.ok(
				here < above,
				`${LADDER[index]} (${here}pt) must be smaller than ${LADDER[index - 1]} (${above}pt)`,
			);
		}
	});
});

describe("ghost ink rises as the mark shrinks", () => {
	for (const channel of ["wash", "fill", "rule", "edge"] as const) {
		it(`raises ${channel} at every step down the ladder`, () => {
			for (let index = 1; index < LADDER.length; index++) {
				const above = alphaOf(ghostInk(INK, LADDER[index - 1])[channel]);
				const here = alphaOf(ghostInk(INK, LADDER[index])[channel]);
				assert.ok(
					here > above,
					`${channel} must rise from ${LADDER[index - 1]} (${above}) to ${LADDER[index]} (${here})`,
				);
			}
		});
	}

	it("keeps the channels ordered wash < fill < rule < edge within a tier", () => {
		for (const tier of LADDER) {
			const ink = ghostInk(INK, tier);
			const [wash, fill, rule, edge] = [
				alphaOf(ink.wash),
				alphaOf(ink.fill),
				alphaOf(ink.rule),
				alphaOf(ink.edge),
			];
			assert.ok(wash < fill, `${tier}: wash must sit under fill`);
			assert.ok(fill < rule, `${tier}: fill must sit under rule`);
			assert.ok(rule < edge, `${tier}: rule must sit under edge`);
		}
	});

	it("never reaches full ink — a mark is always a ghost", () => {
		for (const tier of LADDER) {
			const ink = ghostInk(INK, tier);
			for (const channel of ["wash", "fill", "rule", "edge"] as const) {
				const alpha = alphaOf(ink[channel]);
				assert.ok(
					alpha > 0 && alpha < 0.5,
					`${tier}.${channel} (${alpha}) must stay a ghost`,
				);
			}
		}
	});
});

describe("ghostInk tracks the theme's foreground", () => {
	it("derives every channel from the colour it is given", () => {
		const dark = ghostInk("#ffffff", "takeover");
		for (const channel of ["wash", "fill", "rule", "edge"] as const) {
			assert.ok(
				dark[channel].startsWith("rgba(255, 255, 255,"),
				`${channel} should be built from the passed foreground`,
			);
		}
	});

	it("survives a malformed colour without throwing", () => {
		const ink = ghostInk("not-a-colour", "inFlow");
		assert.equal(typeof ink.fill, "string");
	});
});
