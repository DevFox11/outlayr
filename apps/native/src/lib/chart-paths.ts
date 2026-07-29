/**
 * SVG path strings shared by the budget charts. Skia parses these with
 * `Skia.Path.MakeFromSVGString`.
 */

/**
 * Diagonal rules covering the whole canvas, drawn once and then clipped by the
 * caller to whichever region is in deficit.
 */
export function hatchPathD(width: number, height: number, step = 7): string {
	const parts: string[] = [];
	for (let offset = -height; offset < width + height; offset += step) {
		parts.push(`M ${offset} ${height} L ${offset + height} 0`);
	}
	return parts.join(" ");
}

/**
 * Vertical hairlines every seven days. `bottom` is the plot's baseline, so the
 * rules stop at the axis.
 */
export function weekRulesD(
	totalDays: number,
	x: (day: number) => number,
	top: number,
	bottom: number,
): string {
	const parts: string[] = [];
	for (let day = 8; day < totalDays; day += 7) {
		parts.push(`M ${x(day)} ${top} L ${x(day)} ${bottom}`);
	}
	return parts.join(" ");
}
