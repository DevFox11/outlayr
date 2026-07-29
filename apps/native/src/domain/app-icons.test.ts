import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
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

	it("ships a preview for every choice, the primary included", () => {
		for (const icon of APP_ICONS) {
			assert.ok(
				existsSync(
					join(
						nativeRoot,
						"assets/images/app-icon-previews",
						`${icon.slug}.png`,
					),
				),
				`no preview for ${icon.label}`,
			);
		}
	});

	it("names the primary exactly once, and first", () => {
		assert.equal(APP_ICONS[0].name, null);
		assert.equal(APP_ICONS.filter((icon) => icon.name === null).length, 1);
	});
});

describe("resolving what iOS reports", () => {
	it("reads null back as the default, whichever primary the build ships", () => {
		assert.equal(appIconLabel(null), "Default");
		assert.equal(appIconChoice(null), APP_ICONS[0]);
	});

	it("resolves each alternate by its catalogue name", () => {
		for (const icon of APP_ICONS) {
			assert.equal(appIconChoice(icon.name), icon);
		}
	});

	it("falls back to the default for a name this build no longer offers", () => {
		assert.equal(appIconLabel("OutlayrRetired"), "Default");
	});
});
