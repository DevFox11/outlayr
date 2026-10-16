import { useMaterialColors } from "@/theme/use-material-colors";

/**
 * Material 3 modal bottom sheets sit on `surfaceContainerLow`, whatever the
 * sheet uses on iOS. The community sheet is a Compose `ModalBottomSheet` here,
 * which already draws the drag handle and the 28dp top corners; the fill is
 * the one thing it takes from the caller.
 */
export function useSheetSurface(_ios?: string): string {
    return useMaterialColors().surfaceContainerLow;
}
