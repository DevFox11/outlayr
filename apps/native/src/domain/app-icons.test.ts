import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { EN } from "@/i18n/catalog";
import {
	ALTERNATE_ICON_NAMES,
	APP_ICONS,
	type AppIconState,
	appIconChoice,
	appIconLabel,
	appIconTransition,
	defaultRowDetail,
	RELEASE_PRIMARY_ICON,
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

/**
 * The two build-conditional declarations of the primary, each as the ordered
 * pair its ternary writes — production branch first: the bundle actool stamps,
 * and the name `extra` carries to the JS runtime for the Default row's copy.
 */
function primaryIconBranches(): { icon: string[]; extra: string[] } {
	const source = readFileSync(join(nativeRoot, "app.config.ts"), "utf8");
	const icon =
		/icon:\s*isProduction\s*\?\s*"\.\/assets\/(\w+)\.icon"\s*:\s*"\.\/assets\/(\w+)\.icon"/.exec(
			source,
		);
	const extra =
		/primaryAppIcon:\s*isProduction\s*\?\s*"(\w+)"\s*:\s*"(\w+)"/.exec(source);
	assert.ok(icon, "app.config.ts no longer picks ios.icon on isProduction");
	assert.ok(
		extra,
		"app.config.ts no longer carries extra.primaryAppIcon on isProduction",
	);
	return { icon: [icon[1], icon[2]], extra: [extra[1], extra[2]] };
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

	it("tells the JS runtime the same primary each build stamps", () => {
		const { icon, extra } = primaryIconBranches();
		assert.deepEqual(extra, icon);
	});

	it("agrees with the build about which primary is the Release one", () => {
		assert.equal(primaryIconBranches().extra[0], RELEASE_PRIMARY_ICON);
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

describe("describing the Default row", () => {
	it("claims the paper mark in a build that stamps it", () => {
		assert.equal(defaultRowDetail("Outlayr"), "appIcon.default.detail");
	});

	it("does not claim it in a build that stamps the blueprint icon", () => {
		assert.equal(
			defaultRowDetail("OutlayrTesting"),
			"appIcon.default.detailDev",
		);
	});

	it("does not claim it where the build named no primary at all", () => {
		assert.equal(defaultRowDetail(null), "appIcon.default.detailDev");
	});

	it("resolves both details, and they describe different artwork", () => {
		const release = EN[defaultRowDetail(RELEASE_PRIMARY_ICON)];
		const development = EN[defaultRowDetail(null)];
		assert.match(release, /Outlayr mark/);
		assert.match(development, /blueprint/);
	});
});

describe("choosing an icon", () => {
	const ON_MONO: AppIconState = { active: "OutlayrMono", pending: null };

	function tap(state: AppIconState, name: string | null): AppIconState {
		return appIconTransition(state, { kind: "tap", name });
	}

	it("moves the checkmark on tap, before the native call lands", () => {
		const next = tap(ON_MONO, "OutlayrInk");
		assert.equal(next.active, "OutlayrInk");
		assert.deepEqual(next.pending, { name: "OutlayrInk" });
	});

	it("drops a tap while a change is in flight", () => {
		const flying = tap(ON_MONO, "OutlayrInk");
		// Identity, not shape: it is how the caller knows not to call into iOS.
		assert.equal(tap(flying, "OutlayrEmboss"), flying);
	});

	it("treats a request for the primary as in flight too", () => {
		const flying = tap(ON_MONO, null);
		assert.deepEqual(flying, { active: null, pending: { name: null } });
		assert.equal(tap(flying, "OutlayrInk"), flying);
	});

	it("keeps the requested name once the change lands", () => {
		const landed = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
			kind: "resolved",
			name: "OutlayrInk",
		});
		assert.deepEqual(landed, { active: "OutlayrInk", pending: null });
	});

	it("accepts the next tap once the change has landed", () => {
		const landed = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
			kind: "resolved",
			name: "OutlayrInk",
		});
		assert.deepEqual(tap(landed, "OutlayrEmboss"), {
			active: "OutlayrEmboss",
			pending: { name: "OutlayrEmboss" },
		});
	});

	it("restores the icon iOS reports when the change is refused", () => {
		const refused = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
			kind: "rejected",
			reported: "OutlayrMono",
		});
		assert.deepEqual(refused, { active: "OutlayrMono", pending: null });
	});

	it("falls back to the default when iOS reports no alternate", () => {
		const refused = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
			kind: "rejected",
			reported: null,
		});
		assert.deepEqual(refused, { active: null, pending: null });
		assert.equal(EN[appIconLabel(refused.active)], "Default");
	});

	it("ignores a landing for a name that is no longer pending", () => {
		const refused = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
			kind: "rejected",
			reported: "OutlayrMono",
		});
		assert.equal(
			appIconTransition(refused, { kind: "resolved", name: "OutlayrInk" }),
			refused,
		);
	});
});
