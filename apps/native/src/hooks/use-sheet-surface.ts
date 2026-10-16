import { useColors } from "@/theme/use-colors";

/**
 * The fill behind a community bottom sheet: its `backgroundStyle`, and anything
 * drawn flush with it. iOS keeps the colour the sheet chose, or the screen's
 * background when it names none; `use-sheet-surface.android.ts` puts every
 * sheet on the Material 3 sheet surface instead.
 */
export function useSheetSurface(ios?: string): string {
    const { background } = useColors();
    return ios ?? background;
}
