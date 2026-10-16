import { SymbolView } from "expo-symbols";
import type { SymbolViewProps } from "expo-symbols";

export type IdentityHeroSymbolProps = Omit<SymbolViewProps, "name" | "tintColor"> & {
    name: "photo" | "sparkle";
    /** A plain colour string, which a Hugeicon can take too. */
    tintColor?: string;
};

/**
 * The SF Symbols the empty identity tile draws. Android has no SF Symbols, so
 * `identity-hero-symbol.android.tsx` draws the matching Hugeicon instead.
 */
export function IdentityHeroSymbol(props: IdentityHeroSymbolProps) {
    return <SymbolView {...props} />;
}
