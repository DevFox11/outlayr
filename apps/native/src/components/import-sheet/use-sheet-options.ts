import { useMemo } from "react";
import type { ImportStep } from "@/domain/import-flow";
import { importStepDetents } from "@/lib/sheet-detents";

/**
 * `<Stack.Screen options>` diffs `options` by identity in a layout effect
 * (expo-router@57.0.9 Screen.js:28) — an inline literal here loops.
 */
export function useImportSheetOptions(step: ImportStep, height: number) {
	return useMemo(
		() => ({ sheetAllowedDetents: importStepDetents(step, height) }),
		[step, height],
	);
}
