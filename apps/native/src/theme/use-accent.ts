import { useLayoutEffect } from "react";
import { Uniwind } from "uniwind";

import { useSettingNumber } from "@/contexts/display-settings-context";
import { accentForValue, accentVariables } from "@/domain/accent";
import type { Accent } from "@/domain/accent";

/**
 * Applies the chosen accent to both themes and returns it.
 *
 * `updateCSSVariables` is keyed by theme, so both halves are written once and
 * survive every later `setTheme` — the alternative, a `@variant` block per
 * accent, would mean ten of them each restating all 65 tokens, and only two of
 * those tokens differ. It would also cost the system-appearance following:
 * uniwind compiles `prefers-color-scheme` for `light` and `dark` and for
 * nothing else, so an accent expressed as its own theme family stops tracking
 * the handset on its own.
 *
 * Layout effect rather than a passive one so the write lands in the same commit
 * as the render that read it. On a cold start with a non-default accent stored,
 * an effect would paint one frame of vermilion first.
 */
export function useAccent(): Accent {
    const accent = accentForValue(useSettingNumber("accentColor"));

    useLayoutEffect(() => {
        Uniwind.updateCSSVariables("light", accentVariables(accent, "light"));
        Uniwind.updateCSSVariables("dark", accentVariables(accent, "dark"));
    }, [accent]);

    return accent;
}
