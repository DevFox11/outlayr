import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { EN } from "@/i18n/catalog";

import {
    ALTERNATE_ICON_NAMES,
    APP_ICONS,
    appIconChoice,
    appIconLabel,
    appIconTransition,
    defaultRowDetail,
    RELEASE_PRIMARY_ICON,
} from "./app-icons";
import type { AppIconState } from "./app-icons";

const nativeRoot = join(import.meta.dirname, "../..");

function declaredInAppConfig(): string[] {
    const source = readFileSync(join(nativeRoot, "app.config.ts"), "utf-8");
    const block = /const ALTERNATE_ICONS = \[([\s\S]*?)\];/.exec(source);
    if (!block) {
        throw new Error("app.config.ts no longer declares ALTERNATE_ICONS");
    }
    return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/**
 * The primaries are a build-conditional pair, not a list, so there is no block
 * to anchor on the way the alternates give one. Matching the quoted path form
 * is what separates them: the alternates reach the plugin as a template
 * literal built from bare names.
 */
function primaryIconsInAppConfig(): string[] {
    const source = readFileSync(join(nativeRoot, "app.config.ts"), "utf-8");
    const names = [...source.matchAll(/"\.\/assets\/(\w+)\.icon"/g)].map((match) => match[1]);
    if (names.length === 0) {
        throw new Error("app.config.ts no longer names a primary icon bundle");
    }
    return names;
}

/**
 * The two build-conditional declarations of the primary, each as the ordered
 * pair its ternary writes — production branch first: the bundle actool stamps,
 * and the name `extra` carries to the JS runtime for the Default row's copy.
 */
function primaryIconBranches(): { icon: string[]; extra: string[] } {
    const source = readFileSync(join(nativeRoot, "app.config.ts"), "utf-8");
    const icon = /icon:\s*isProduction\s*\?\s*"\.\/assets\/(\w+)\.icon"\s*:\s*"\.\/assets\/(\w+)\.icon"/.exec(source);
    const extra = /primaryAppIcon:\s*isProduction\s*\?\s*"(\w+)"\s*:\s*"(\w+)"/.exec(source);
    if (!icon) {
        throw new Error("app.config.ts no longer picks ios.icon on isProduction");
    }
    if (!extra) {
        throw new Error("app.config.ts no longer carries extra.primaryAppIcon on isProduction");
    }
    return { extra: [extra[1], extra[2]], icon: [icon[1], icon[2]] };
}

function iconBundlesOnDisk(): string[] {
    return readdirSync(join(nativeRoot, "assets"))
        .filter((entry) => entry.endsWith(".icon"))
        .map((entry) => entry.slice(0, -".icon".length));
}

describe("app icon catalogue", () => {
    it("offers the same alternates the build registers", () => {
        expect(declaredInAppConfig()).toStrictEqual([...ALTERNATE_ICON_NAMES]);
    });

    it("ships a bundle for every alternate it offers", () => {
        for (const name of ALTERNATE_ICON_NAMES) {
            expect(existsSync(join(nativeRoot, "assets", `${name}.icon`, "icon.json"))).toBeTruthy();
        }
    });

    it("ships a bundle for every primary a build can launch with", () => {
        for (const name of primaryIconsInAppConfig()) {
            expect(existsSync(join(nativeRoot, "assets", `${name}.icon`, "icon.json"))).toBeTruthy();
        }
    });

    it("never offers a primary as an alternate as well", () => {
        const alternates = declaredInAppConfig();
        for (const name of primaryIconsInAppConfig()) {
            expect(!alternates.includes(name)).toBeTruthy();
        }
    });

    it("carries no icon bundle no build declares", () => {
        const declared = new Set([...declaredInAppConfig(), ...primaryIconsInAppConfig()]);
        for (const name of iconBundlesOnDisk()) {
            expect(declared.has(name)).toBeTruthy();
        }
    });

    it("ships a preview for every choice, the primary included", () => {
        // Metro falls back to the nearest density it can find, so a missing @3x
        // is a soft failure: an upscaled, blurry tile on every current iPhone.
        for (const icon of APP_ICONS) {
            for (const scale of ["", "@2x", "@3x"]) {
                expect(
                    existsSync(join(nativeRoot, "assets/images/app-icon-previews", `${icon.slug}${scale}.png`))
                ).toBeTruthy();
            }
        }
    });

    it("draws a preview source for every choice and nothing else", () => {
        const drawn = readdirSync(join(nativeRoot, "assets/app-icon-previews"))
            .filter((entry) => entry.endsWith(".svg"))
            .map((entry) => entry.slice(0, -".svg".length));
        expect(drawn.sort()).toStrictEqual(APP_ICONS.map((icon) => icon.slug).sort());
    });

    it("names the primary exactly once, and first", () => {
        expect(APP_ICONS[0].name).toBeNull();
        expect(APP_ICONS.filter((icon) => icon.name === null)).toHaveLength(1);
    });

    it("tells the JS runtime the same primary each build stamps", () => {
        const { icon, extra } = primaryIconBranches();
        expect(extra).toStrictEqual(icon);
    });

    it("agrees with the build about which primary is the Release one", () => {
        expect(primaryIconBranches().extra[0]).toBe(RELEASE_PRIMARY_ICON);
    });
});

describe("resolving what iOS reports", () => {
    it("reads null back as the default, whichever primary the build ships", () => {
        expect(EN[appIconLabel(null)]).toBe("Default");
        expect(appIconChoice(null)).toBe(APP_ICONS[0]);
    });

    it("resolves each alternate by its catalogue name", () => {
        for (const icon of APP_ICONS) {
            expect(appIconChoice(icon.name)).toBe(icon);
        }
    });

    it("falls back to the default for a name this build no longer offers", () => {
        expect(EN[appIconLabel("OutlayrRetired")]).toBe("Default");
    });
});

describe("describing the Default row", () => {
    it("claims the paper mark in a build that stamps it", () => {
        expect(defaultRowDetail("Outlayr")).toBe("appIcon.default.detail");
    });

    it("does not claim it in a build that stamps the blueprint icon", () => {
        expect(defaultRowDetail("OutlayrTesting")).toBe("appIcon.default.detailDev");
    });

    it("does not claim it where the build named no primary at all", () => {
        expect(defaultRowDetail(null)).toBe("appIcon.default.detailDev");
    });

    it("resolves both details, and they describe different artwork", () => {
        const release = EN[defaultRowDetail(RELEASE_PRIMARY_ICON)];
        const development = EN[defaultRowDetail(null)];
        expect(release).toMatch(/Outlayr mark/);
        expect(development).toMatch(/blueprint/);
    });
});

describe("choosing an icon", () => {
    const ON_MONO: AppIconState = { active: "OutlayrMono", pending: null };

    function tap(state: AppIconState, name: string | null): AppIconState {
        return appIconTransition(state, { kind: "tap", name });
    }

    it("moves the checkmark on tap, before the native call lands", () => {
        const next = tap(ON_MONO, "OutlayrInk");
        expect(next.active).toBe("OutlayrInk");
        expect(next.pending).toStrictEqual({ name: "OutlayrInk" });
    });

    it("drops a tap while a change is in flight", () => {
        const flying = tap(ON_MONO, "OutlayrInk");
        // Identity, not shape: it is how the caller knows not to call into iOS.
        expect(tap(flying, "OutlayrEmboss")).toBe(flying);
    });

    it("treats a request for the primary as in flight too", () => {
        const flying = tap(ON_MONO, null);
        expect(flying).toStrictEqual({ active: null, pending: { name: null } });
        expect(tap(flying, "OutlayrInk")).toBe(flying);
    });

    it("keeps the requested name once the change lands", () => {
        const landed = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
            kind: "resolved",
            name: "OutlayrInk",
        });
        expect(landed).toStrictEqual({ active: "OutlayrInk", pending: null });
    });

    it("accepts the next tap once the change has landed", () => {
        const landed = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
            kind: "resolved",
            name: "OutlayrInk",
        });
        expect(tap(landed, "OutlayrEmboss")).toStrictEqual({
            active: "OutlayrEmboss",
            pending: { name: "OutlayrEmboss" },
        });
    });

    it("restores the icon iOS reports when the change is refused", () => {
        const refused = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
            kind: "rejected",
            reported: "OutlayrMono",
        });
        expect(refused).toStrictEqual({ active: "OutlayrMono", pending: null });
    });

    it("falls back to the default when iOS reports no alternate", () => {
        const refused = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
            kind: "rejected",
            reported: null,
        });
        expect(refused).toStrictEqual({ active: null, pending: null });
        expect(EN[appIconLabel(refused.active)]).toBe("Default");
    });

    it("ignores a landing for a name that is no longer pending", () => {
        const refused = appIconTransition(tap(ON_MONO, "OutlayrInk"), {
            kind: "rejected",
            reported: "OutlayrMono",
        });
        expect(appIconTransition(refused, { kind: "resolved", name: "OutlayrInk" })).toBe(refused);
    });
});
