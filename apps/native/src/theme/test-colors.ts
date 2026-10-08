import type { ThemeColors } from "@/theme/use-colors";

/**
 * The light-theme palette as `useColors` resolves it at runtime, transcribed
 * from the `:root` block of `global.css`.
 *
 * Test-only. `useColors` reads CSS variables through uniwind, which resolves to
 * nothing under jest, so every suite that renders a colour-reading component
 * mocks the hook. Mocking it with a hand-picked subset makes the mock's return
 * type incomplete and lets each suite drift from the shipped tokens
 * independently — this is the one transcription, and {@link testColors} is how
 * a suite overrides the handful of entries it actually asserts on.
 */
const LIGHT_THEME_COLORS: ThemeColors = {
    accent: "#17150f",
    accentForeground: "#f2f0ea",
    background: "#f2f0ea",
    border: "#dcd8cc",
    danger: "#c01005",
    dangerOnWash: "#aa1106",
    expense: "#17150f",
    foreground: "#17150f",
    future: "#6b6557",
    groupedBackground: "#f2f0ea",
    income: "#00714a",
    incomeOnWash: "#036643",
    muted: "#6b6557",
    overBudget: "#bd1c1e",
    primaryForeground: "#f2f0ea",
    railTrack: "rgba(23, 21, 15, 0.13)",
    separator: "#dcd8cc",
    subtle: "#6d6657",
    surface: "#f8f6f1",
    surfaceSecondary: "#efece4",
    tint: "#c2371b",
    transfer: "#4187ba",
    warning: "#fdcc41",
};

/**
 * A complete {@link ThemeColors} for a `useColors` mock, with `overrides`
 * applied over the light theme. Pass only the tokens the test asserts on.
 */
export const testColors = (overrides: Partial<ThemeColors> = {}): ThemeColors => ({
    ...LIGHT_THEME_COLORS,
    ...overrides,
});
