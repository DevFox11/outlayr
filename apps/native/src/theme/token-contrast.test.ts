import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "@jest/globals";

import { ACCENTS, DEFAULT_ACCENT } from "@/domain/accent";

const nativeRoot = join(import.meta.dirname, "../..");

/** WCAG 2.2 AA, normal text. */
const AA_TEXT_CONTRAST = 4.5;
/** WCAG 2.2 AA, large text and non-text; `font-sans-semibold` is 600 and does not reach it. */
const AA_LARGE_CONTRAST = 3;
const CHANNEL_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const SIX_HEX_DIGITS = /^[0-9a-f]{6}$/i;

/** Hand-derived here rather than imported from `shade.ts`, so a broken helper cannot certify a broken stylesheet. */
function relativeLuminance(hex: string): number {
    const value = hex.trim().replace(/^#/, "");
    if (!SIX_HEX_DIGITS.test(value)) {
        throw new Error(`not a #RRGGBB hex: ${hex}`);
    }
    const int = Number.parseInt(value, 16);
    const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    return channels.reduce((sum, channel, index) => {
        const v = channel / 255;
        const linear = v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        return sum + CHANNEL_WEIGHTS[index] * linear;
    }, 0);
}

function contrastRatio(a: string, b: string): number {
    const first = relativeLuminance(a);
    const second = relativeLuminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
const stylesheet = readFileSync(join(nativeRoot, "global.css"), "utf-8");

type Theme = "light" | "dark";
const THEMES: readonly Theme[] = ["light", "dark"];

/**
 * Every ground either theme paints behind text. Which token lands on which
 * ground is not statically knowable — a screen paints `bg-surface` and a child
 * three levels down writes `text-muted` — so the floor is held against all of
 * them rather than guessed per pair.
 */
const GROUNDS = ["background", "surface", "surface-secondary", "grouped-background"] as const;

/** Colour tokens that render as text over one of {@link GROUNDS}. */
const TEXT_TOKENS = [
    "foreground",
    "muted",
    "subtle",
    "grammar",
    "accent",
    "expense",
    "income",
    "future",
    "tint",
    "danger",
    "over-budget",
] as const;

/**
 * Tokens that only ever carry text over the one fill they are named for, never
 * over a page ground: `text-background` and `text-accent-foreground` both appear
 * on `bg-accent`, so measuring either against `--background` would be measuring
 * a pairing the app never draws.
 */
const INVERSE_TOKENS: Record<string, string> = {
    "accent-foreground": "accent",
    background: "accent",
    "surface-foreground": "surface",
    "surface-secondary-foreground": "surface-secondary",
};

/**
 * Fills, hairlines and chart colours. `--warning` is the one that looks like a
 * miss and is not — 1.51:1 on paper — because no `text-warning` exists; the
 * no-text-utility assertion below is what keeps that true.
 */
const NON_TEXT_TOKENS = [
    "surface",
    "surface-secondary",
    "grouped-background",
    "border",
    "separator",
    "blank-rule",
    "warning",
    "chip",
    "danger-fill",
    "gold-fill",
    "rail-over",
    "rail-track",
    "fr-rule",
] as const;

/**
 * The first-run flow paints its own ground and writes only its own tokens over
 * it — no app token ever lands on `--fr-ground`, and no `fr-` token ever lands
 * on a page ground. Measuring them against {@link GROUNDS} would measure pairs
 * the app never draws, so the set is closed and measured against itself.
 */
const FIRST_RUN_GROUNDS = ["fr-ground", "fr-card"] as const;

/**
 * Each first-run text token against the grounds it is actually written over.
 * `--fr-vermilion` is the eyebrow and only the eyebrow — one call site, in the
 * stage layout of `components/first-run.tsx`, over `--fr-ground`. It never
 * enters a `bg-fr-card` box, which holds `--fr-ink` and `--fr-muted` alone, and
 * on dark it would not clear the floor there (4.42:1) if it did.
 */
const FIRST_RUN_TEXT: Record<string, readonly string[]> = {
    "fr-ink": ["fr-ground", "fr-card"],
    "fr-muted": ["fr-ground", "fr-card"],
    "fr-vermilion": ["fr-ground"],
};

const WHITE = "#ffffff";

/**
 * Fills that carry a literal `text-white` rather than a token. Neither
 * {@link GROUNDS} nor {@link INVERSE_TOKENS} can reach the pairing — white is
 * not a token and the fill is not a ground — so it is named here or it is
 * measured nowhere.
 */
const WHITE_TEXT_FILLS = ["danger-fill", "gold-fill"] as const;

/**
 * Every file writing literal `text-white`, relative to `src`. The list is the
 * guard: a new call site fails the assertion below until the fill beneath it
 * joins {@link WHITE_TEXT_FILLS}, because nothing in this file can infer which
 * fill a literal colour was written over.
 */
const WHITE_TEXT_SITES = [
    "components/currency-picker-row.tsx",
    "screens/budgets/components/budget-row.tsx",
    "screens/log/components/swipeable-transaction-row.tsx",
] as const;

/**
 * Measured AA failures held open deliberately. Empty, and the machinery is kept
 * for the next time it is not.
 *
 * It held four pairs until the paper theme landed: dark `--surface` was #3a3a3c,
 * an iOS elevated grey 3.6x the luminance of every other dark plane, and
 * `--subtle`, `--tint`, `--danger` and `--over-budget` were iOS system colours
 * that could not clear 4.5:1 against it without being replaced by pastels. The
 * warm dark face re-derived that ground to #2a251b, which is the design change
 * this guard said it did not own, and all four now pass on their own.
 */
const EXEMPT_PAIRS: readonly { theme: Theme; token: string; ground: string }[] = [];

const EXEMPT = new Set(EXEMPT_PAIRS.map((pair) => pairKey(pair.theme, pair.token, pair.ground)));

function pairKey(theme: Theme, token: string, ground: string): string {
    return `${theme}: --${token} on --${ground}`;
}

/** The `--token: value;` declarations inside `@variant <theme> { … }`. */
function themeTokens(theme: Theme): Map<string, string> {
    const open = stylesheet.indexOf(`@variant ${theme} {`);
    if (open === -1) {
        throw new Error(`global.css no longer declares @variant ${theme}`);
    }
    return new Map([...braced(open).matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

/** The `@theme inline` bridge, as utility suffix -> the token it reads. */
function exposedTokens(): Map<string, string> {
    const open = stylesheet.indexOf("@theme inline");
    if (open === -1) {
        throw new Error("global.css no longer declares @theme inline");
    }
    return new Map(
        [...braced(open).matchAll(/--color-([\w-]+):\s*var\(--([\w-]+)\);/g)].map((match) => [match[1], match[2]])
    );
}

function braced(from: number): string {
    const open = stylesheet.indexOf("{", from);
    let depth = 0;
    for (let index = open; index < stylesheet.length; index += 1) {
        if (stylesheet[index] === "{") {
            depth += 1;
        } else if (stylesheet[index] === "}") {
            depth -= 1;
            if (depth === 0) {
                return stylesheet.slice(open + 1, index);
            }
        }
    }
    throw new Error(`unbalanced braces at offset ${from} of global.css`);
}

function tokenValue(theme: Theme, token: string): string {
    const value = themeTokens(theme).get(token);
    if (!value) {
        throw new Error(`@variant ${theme} no longer declares --${token}`);
    }
    return value;
}

/** Every `text-…` utility the app writes, whatever it resolves to. */
function textUtilities(): Set<string> {
    const names = new Set<string>();
    for (const file of sourceFiles(join(nativeRoot, "src"))) {
        const source = readFileSync(file, "utf-8");
        for (const match of source.matchAll(/\btext-([a-z][a-z-]*[a-z])\b/g)) {
            names.add(match[1]);
        }
    }
    return names;
}

function byCodeUnit(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

/** Files writing a literal `text-white`, as paths relative to `src`. */
function whiteTextSites(): string[] {
    const src = join(nativeRoot, "src");
    return sourceFiles(src)
        .filter((file) => /\btext-white\b/.test(readFileSync(file, "utf-8")))
        .map((file) => relative(src, file))
        .sort(byCodeUnit);
}

function sourceFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...sourceFiles(path));
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
            found.push(path);
        }
    }
    return found;
}

describe("contrast maths", () => {
    // Hand-derived, so a broken helper cannot certify a broken stylesheet.
    it("gives the defining 21:1 for pure black on pure white", () => {
        expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    });

    it("weights the green channel at 0.7152", () => {
        // A fully lit channel is linear 1, so luminance is that channel's weight.
        expect(relativeLuminance("#00ff00")).toBe(0.7152);
        expect(Math.abs(contrastRatio("#00ff00", "#000000") - 15.304) < 1e-9).toBeTruthy();
    });

    it("weights the blue channel at 0.0722", () => {
        expect(relativeLuminance("#0000ff")).toBe(0.0722);
        expect(contrastRatio("#0000ff", "#ffffff")).toBe(1.05 / 0.1222);
    });

    it("takes the linear branch below the 0.03928 knee", () => {
        // 5/255 = 0.019608, under the knee, so luminance is that over 12.92.
        expect(Math.abs(relativeLuminance("#050505") - 0.001517635) < 1e-8).toBeTruthy();
        expect(Math.abs(contrastRatio("#050505", "#000000") - 1.0303527) < 1e-6).toBeTruthy();
    });

    it("takes the 2.4 gamma above the knee", () => {
        // ((128/255 + 0.055) / 1.055) ** 2.4 = 0.2158605, all three channels.
        expect(Math.abs(relativeLuminance("#808080") - 0.2158605) < 1e-6).toBeTruthy();
        expect(Math.abs(contrastRatio("#808080", "#ffffff") - 3.9494397) < 1e-6).toBeTruthy();
    });

    it("is symmetric in its arguments", () => {
        expect(contrastRatio("#6d6d6d", "#f0f0f0")).toBe(contrastRatio("#f0f0f0", "#6d6d6d"));
    });

    it("refuses a value it cannot measure rather than passing it", () => {
        expect(() => relativeLuminance("rgba(241, 120, 121, 0.22)")).toThrow();
        expect(() => relativeLuminance("#fff")).toThrow();
        expect(() => relativeLuminance("#gggggg")).toThrow();
    });
});

describe("the token layer", () => {
    it("classifies every token it exposes to the utilities", () => {
        const classified = new Set<string>([
            ...TEXT_TOKENS,
            ...Object.keys(INVERSE_TOKENS),
            ...NON_TEXT_TOKENS,
            ...FIRST_RUN_GROUNDS,
            ...Object.keys(FIRST_RUN_TEXT),
        ]);
        for (const token of exposedTokens().values()) {
            expect(classified.has(token)).toBeTruthy();
        }
    });

    it("classifies nothing it no longer exposes", () => {
        const exposed = new Set(exposedTokens().values());
        for (const token of [
            ...TEXT_TOKENS,
            ...Object.keys(INVERSE_TOKENS),
            ...NON_TEXT_TOKENS,
            ...FIRST_RUN_GROUNDS,
            ...Object.keys(FIRST_RUN_TEXT),
        ]) {
            expect(exposed.has(token)).toBeTruthy();
        }
    });

    it("exposes each token under its own name", () => {
        for (const [utility, token] of exposedTokens()) {
            expect(utility).toBe(token);
        }
    });

    it("declares every exposed token in both themes", () => {
        for (const theme of THEMES) {
            const declared = themeTokens(theme);
            for (const token of exposedTokens().values()) {
                expect(declared.has(token)).toBeTruthy();
            }
        }
    });
});

describe("wCAG AA for text on every ground its theme paints", () => {
    for (const theme of THEMES) {
        it(`holds ${AA_TEXT_CONTRAST}:1 in ${theme}`, () => {
            const failures: string[] = [];
            for (const token of TEXT_TOKENS) {
                for (const ground of GROUNDS) {
                    const key = pairKey(theme, token, ground);
                    if (EXEMPT.has(key)) {
                        continue;
                    }
                    const ratio = contrastRatio(tokenValue(theme, token), tokenValue(theme, ground));
                    if (ratio < AA_TEXT_CONTRAST) {
                        failures.push(`${key} = ${ratio.toFixed(2)}:1`);
                    }
                }
            }
            expect(failures).toStrictEqual([]);
        });
    }

    it("holds the floor for the first-run palette on the grounds it is written over", () => {
        const failures: string[] = [];
        for (const theme of THEMES) {
            for (const [token, grounds] of Object.entries(FIRST_RUN_TEXT)) {
                for (const ground of grounds) {
                    const ratio = contrastRatio(tokenValue(theme, token), tokenValue(theme, ground));
                    if (ratio < AA_TEXT_CONTRAST) {
                        failures.push(`${pairKey(theme, token, ground)} = ${ratio.toFixed(2)}:1`);
                    }
                }
            }
        }
        expect(failures).toStrictEqual([]);
    });

    it("holds the floor for each inverse token on the fill it is named for", () => {
        const failures: string[] = [];
        for (const theme of THEMES) {
            for (const [token, fill] of Object.entries(INVERSE_TOKENS)) {
                const ratio = contrastRatio(tokenValue(theme, token), tokenValue(theme, fill));
                if (ratio < AA_TEXT_CONTRAST) {
                    failures.push(`${pairKey(theme, token, fill)} = ${ratio.toFixed(2)}:1`);
                }
            }
        }
        expect(failures).toStrictEqual([]);
    });
});

describe("the exemptions", () => {
    function measure(pair: (typeof EXEMPT_PAIRS)[number]): number {
        return contrastRatio(tokenValue(pair.theme, pair.token), tokenValue(pair.theme, pair.ground));
    }

    it("keeps every exempt pair above the non-text floor", () => {
        const failures: string[] = [];
        for (const pair of EXEMPT_PAIRS) {
            const ratio = measure(pair);
            if (ratio < AA_LARGE_CONTRAST) {
                failures.push(`${pairKey(pair.theme, pair.token, pair.ground)} = ${ratio.toFixed(2)}:1`);
            }
        }
        expect(failures).toStrictEqual([]);
    });

    it("carries no exemption whose pair now passes", () => {
        const stale: string[] = [];
        for (const pair of EXEMPT_PAIRS) {
            const ratio = measure(pair);
            if (ratio >= AA_TEXT_CONTRAST) {
                stale.push(`${pairKey(pair.theme, pair.token, pair.ground)} = ${ratio.toFixed(2)}:1`);
            }
        }
        expect(stale).toStrictEqual([]);
    });

    it("exempts nothing that is not a text token on a ground", () => {
        for (const pair of EXEMPT_PAIRS) {
            expect(TEXT_TOKENS.some((token) => token === pair.token)).toBeTruthy();
            expect(GROUNDS.some((ground) => ground === pair.ground)).toBeTruthy();
        }
    });
});

describe("fills that carry literal white text", () => {
    it(`holds ${AA_TEXT_CONTRAST}:1 for white over each of them, in both themes`, () => {
        const failures: string[] = [];
        for (const theme of THEMES) {
            for (const fill of WHITE_TEXT_FILLS) {
                const ratio = contrastRatio(WHITE, tokenValue(theme, fill));
                if (ratio < AA_TEXT_CONTRAST) {
                    failures.push(`${theme}: white on --${fill} = ${ratio.toFixed(2)}:1`);
                }
            }
        }
        expect(failures).toStrictEqual([]);
    });

    it("names every file that writes text-white", () => {
        expect(whiteTextSites()).toStrictEqual([...WHITE_TEXT_SITES]);
    });

    it("draws a declared fill at each of those sites", () => {
        for (const site of WHITE_TEXT_SITES) {
            const source = readFileSync(join(nativeRoot, "src", site), "utf-8");
            expect(WHITE_TEXT_FILLS.some((fill) => new RegExp(`\\bbg-${fill}\\b`).test(source))).toBeTruthy();
        }
    });
});

describe("tokens classified as fills", () => {
    it("never appears as a text utility", () => {
        const written = textUtilities();
        for (const token of NON_TEXT_TOKENS) {
            expect(!written.has(token)).toBeTruthy();
        }
    });
});

/**
 * `--tint` is the one token a user can change, so the stylesheet's own value is
 * only the default. Every accent has to clear the same floor the declared one
 * does, against every ground its theme paints — otherwise the picker is a list
 * of options, one of which is unreadable.
 */
describe("every accent a user can pick", () => {
    for (const theme of THEMES) {
        it(`holds ${AA_TEXT_CONTRAST}:1 on every ${theme} ground`, () => {
            const failures: string[] = [];
            for (const accent of ACCENTS) {
                for (const ground of GROUNDS) {
                    const ratio = contrastRatio(accent[theme], tokenValue(theme, ground));
                    if (ratio < AA_TEXT_CONTRAST) {
                        failures.push(`${theme}: ${accent.key} on --${ground} = ${ratio.toFixed(2)}:1`);
                    }
                }
            }
            expect(failures).toStrictEqual([]);
        });
    }

    // The declared `--tint` is what an untouched install paints, so the two must
    // not drift: a default changed in one place and not the other would ship an
    // app whose first screen disagrees with its own settings row.
    it("leads with the value the stylesheet declares", () => {
        for (const theme of THEMES) {
            expect(DEFAULT_ACCENT[theme]).toBe(tokenValue(theme, "tint"));
        }
    });

    it("carries a stable stored value for each accent", () => {
        expect(ACCENTS.map((accent) => accent.value)).toStrictEqual([...ACCENTS.keys()]);
    });
});
