/**
 * Pure fly-up geometry, kept out of `components/identity-fly-up.tsx` so it can be
 * unit tested: the runner is plain `node --test` with tsx, which cannot load a
 * module that reaches React Native (esbuild rejects the Flow syntax in
 * `react-native/index.js`). Keep this file free of every react/react-native import.
 */

/** Minimum gap between the top of the screen and the floated hero's edge. */
const TOP_MARGIN = 16;

/**
 * Screen-space Y the floated hero's centre aims for, clamped so a short screen
 * (or a sheet dragged to its large detent) pins the tile below the top edge
 * instead of clipping it.
 */
export function floatTargetY({
	containerHeight,
	sheetHeight,
	heroHalf,
}: {
	containerHeight: number;
	sheetHeight: number;
	heroHalf: number;
}): number {
	"worklet";

	return Math.max((containerHeight - sheetHeight) / 2, TOP_MARGIN + heroHalf);
}
