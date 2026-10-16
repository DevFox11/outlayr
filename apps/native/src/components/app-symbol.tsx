import { SymbolView } from "expo-symbols";
import type { SymbolViewProps } from "expo-symbols";

/**
 * The SF Symbols drawn through `AppSymbol`. Each has a Hugeicon in
 * `app-symbol.android.tsx`, and the type keeps the two lists in step.
 */
export type AppSymbolName =
    | "checkmark.circle.fill"
    | "circle"
    | "exclamationmark.circle.fill"
    | "magnifyingglass"
    | "plus.circle.fill"
    | "xmark";

export type AppSymbolProps = Omit<SymbolViewProps, "name"> & { name: AppSymbolName };

/**
 * An SF Symbol on iOS. Android has no SF Symbols, and expo-symbols' Material
 * fallback loads a font on every mount, so a list of them flashes blank; the
 * Android sibling draws the matching Hugeicon instead.
 */
export function AppSymbol(props: AppSymbolProps) {
    return <SymbolView {...props} />;
}
