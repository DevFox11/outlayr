import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { EN } from "@/i18n/catalog";
import {
	ALTERNATE_ICON_NAMES,
	APP_ICONS,
	appIconChoice,
	appIconLabel,
} from "./app-icons";

const nativeRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function declaredInAppConfig(): string[] {
	const source = readFileSync(join(nativeRoot, "app.config.ts"), "utf8");
	const block = /const ALTERNATE_ICONS = \[([\s\S]*?)\];/.exec(source);
	assert.ok(block, "app.config.ts no longer declares ALTERNATE_ICONS");
	return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/**
 * The primaries are a build-conditional pair, not a list, so there is no block
 * to anchor on the way the alternates give one. Matching the quoted path form
 * is what separates them: the alternates reach the plugin as a template
 * literal built from bare names.
 */
function primaryIconsInAppConfig(): string[] {
	const source = readFileSync(join(nativeRoot, "app.config.ts"), "utf8");
	const names = [...source.matchAll(/"\.\/assets\/(\w+)\.icon"/g)].map(
		(match) => match[1],
	);
	assert.ok(names.length > 0, "app.config.ts no longer names a primary icon");
	return names;
}

function iconBundlesOnDisk(): string[] {
	return readdirSync(join(nativeRoot, "assets"))
		.filter((entry) => entry.endsWith(".icon"))
		.map((entry) => entry.slice(0, -".icon".length));
}

describe("app icon catalogue", () => {
	it("offers the same alternates the build registers", () => {
		assert.deepEqual(declaredInAppConfig(), [...ALTERNATE_ICON_NAMES]);
	});

	it("ships a bundle for every alternate it offers", () => {
		for (const name of ALTERNATE_ICON_NAMES) {
			assert.ok(
				existsSync(join(nativeRoot, "assets", `${name}.icon`, "icon.json")),
				`assets/${name}.icon is missing — setAlternateIconName("${name}") would reject`,
			);
		}
	});

	it("ships a bundle for every primary a build can launch with", () => {
		for (const name of primaryIconsInAppConfig()) {
			assert.ok(
				existsSync(join(nativeRoot, "assets", `${name}.icon`, "icon.json")),
				`assets/${name}.icon is missing — the build has no primary icon to stamp`,
			);
		}
	});

	it("never offers a primary as an alternate as well", () => {
		const alternates = declaredInAppConfig();
		for (const name of primaryIconsInAppConfig()) {
			assert.ok(
				!alternates.includes(name),
				`${name} is both a primary and an alternate — actool sees a duplicate`,
			);
		}
	});

	it("carries no icon bundle no build declares", () => {
		const declared = new Set([
			...declaredInAppConfig(),
			...primaryIconsInAppConfig(),
		]);
		for (const name of iconBundlesOnDisk()) {
			assert.ok(
				declared.has(name),
				`assets/${name}.icon is dead weight — neither a primary nor an alternate`,
			);
		}
	});

	it("ships a preview for every choice, the primary included", () => {
		// Metro falls back to the nearest density it can find, so a missing @3x
		// is a soft failure: an upscaled, blurry tile on every current iPhone.
		for (const icon of APP_ICONS) {
			for (const scale of ["", "@2x", "@3x"]) {
				assert.ok(
					existsSync(
						join(
							nativeRoot,
							"assets/images/app-icon-previews",
							`${icon.slug}${scale}.png`,
						),
					),
					`no ${scale || "1x"} preview for ${icon.label}`,
				);
			}
		}
	});

	it("draws a preview source for every choice and nothing else", () => {
		const drawn = readdirSync(join(nativeRoot, "assets/app-icon-previews"))
			.filter((entry) => entry.endsWith(".svg"))
			.map((entry) => entry.slice(0, -".svg".length));
		assert.deepEqual(drawn.sort(), APP_ICONS.map((icon) => icon.slug).sort());
	});

	it("names the primary exactly once, and first", () => {
		assert.equal(APP_ICONS[0].name, null);
		assert.equal(APP_ICONS.filter((icon) => icon.name === null).length, 1);
	});
});

describe("resolving what iOS reports", () => {
	it("reads null back as the default, whichever primary the build ships", () => {
		assert.equal(EN[appIconLabel(null)], "Default");
		assert.equal(appIconChoice(null), APP_ICONS[0]);
	});

	it("resolves each alternate by its catalogue name", () => {
		for (const icon of APP_ICONS) {
			assert.equal(appIconChoice(icon.name), icon);
		}
	});

	it("falls back to the default for a name this build no longer offers", () => {
		assert.equal(EN[appIconLabel("OutlayrRetired")], "Default");
	});
});
