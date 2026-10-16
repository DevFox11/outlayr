import { MonoLabel } from "@/components/mono-label";
import type { ThemeColors } from "@/theme/use-colors";

/**
 * The treatment the Android category tree, its reorder list and the accounts
 * list have in common, drawn in RN: the same category has to read as the same
 * row on all of them. The rows style their names with `Text` classes.
 */

export const PARENT_TILE = 34;
export const CHILD_TILE = 28;

/**
 * The mono eyebrow over a section, on the M3 variant tone. `colors` stays in
 * the signature so a call site type-checks against either file; the role
 * utility does the colouring here.
 */
export function Eyebrow({ children }: { colors: ThemeColors; children: string }) {
    return (
        <MonoLabel accessibilityRole="header" className="text-m3-on-surface-variant">
            {children}
        </MonoLabel>
    );
}
