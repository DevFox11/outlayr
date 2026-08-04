export interface StripGeometry {
	containerWidth: number;
	count: number;
	gap: number;
}

export interface ItemFrame {
	translateX: number;
	width: number;
	opacity: number;
}

export function slotWidth(g: StripGeometry): number {
	"worklet";
	return (g.containerWidth - g.gap * (g.count - 1)) / g.count;
}

/** `expandedIndex` is 1-based; 0 means the strip is collapsed. */
export function itemFrame(
	g: StripGeometry,
	index1: number,
	expandedIndex: number,
): ItemFrame {
	"worklet";
	const slot = slotWidth(g);
	const expanded = expandedIndex > 0;
	const isActive = expandedIndex === index1;
	// `-(expandedIndex - 1) * ...` yields `-0` when expandedIndex is 1; `|| 0`
	// normalizes it so callers never have to special-case signed zero.
	return {
		translateX: (expanded ? -(expandedIndex - 1) * (slot + g.gap) : 0) || 0,
		width: isActive ? g.containerWidth : slot,
		opacity: isActive || !expanded ? 1 : 0,
	};
}

export function isInteractive(index1: number, expandedIndex: number): boolean {
	return expandedIndex === 0 || expandedIndex === index1;
}
