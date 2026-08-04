import { isInteractive, itemFrame, slotWidth } from "./geometry";

describe("slotWidth", () => {
	it("divides the container evenly across items minus the gaps between them", () => {
		expect(slotWidth({ containerWidth: 326, count: 2, gap: 8 })).toBe(159);
		expect(slotWidth({ containerWidth: 316, count: 3, gap: 8 })).toBe(100);
	});

	it("collapses to the full width for a single item with no gap to subtract", () => {
		expect(slotWidth({ containerWidth: 200, count: 1, gap: 8 })).toBe(200);
	});

	it("scales down as the gap grows for a fixed container and count", () => {
		expect(slotWidth({ containerWidth: 320, count: 2, gap: 0 })).toBe(160);
		expect(slotWidth({ containerWidth: 320, count: 2, gap: 16 })).toBe(152);
	});
});

describe("itemFrame", () => {
	const geometry = { containerWidth: 316, count: 3, gap: 8 };

	it("collapsed (expandedIndex=0): every item sits in its own equal slot, fully opaque", () => {
		for (const index1 of [1, 2, 3]) {
			expect(itemFrame(geometry, index1, 0)).toStrictEqual({
				translateX: 0,
				width: 100,
				opacity: 1,
			});
		}
	});

	it("expanded at the first item: the strip does not shift, the active item fills the container", () => {
		expect(itemFrame(geometry, 1, 1)).toStrictEqual({
			translateX: 0,
			width: 316,
			opacity: 1,
		});
	});

	it("expanded at the first item: inactive siblings keep their slot width and fade out", () => {
		expect(itemFrame(geometry, 2, 1)).toStrictEqual({
			translateX: 0,
			width: 100,
			opacity: 0,
		});
		expect(itemFrame(geometry, 3, 1)).toStrictEqual({
			translateX: 0,
			width: 100,
			opacity: 0,
		});
	});

	it("expanded at the last item: the strip shifts by every prior slot plus its gap", () => {
		expect(itemFrame(geometry, 3, 3)).toStrictEqual({
			translateX: -216,
			width: 316,
			opacity: 1,
		});
	});

	it("translateX depends only on which item is expanded, not on the item queried", () => {
		expect(itemFrame(geometry, 1, 3).translateX).toBe(
			itemFrame(geometry, 2, 3).translateX,
		);
	});

	it("invariant: every slot plus every gap between them accounts for the whole width", () => {
		for (const g of [
			{ containerWidth: 326, count: 2, gap: 8 },
			{ containerWidth: 316, count: 3, gap: 8 },
			{ containerWidth: 200, count: 1, gap: 8 },
		]) {
			expect(slotWidth(g) * g.count + g.gap * (g.count - 1)).toBe(
				g.containerWidth,
			);
		}
	});
});

describe("isInteractive", () => {
	it("every item is interactive while the strip is collapsed", () => {
		expect(isInteractive(1, 0)).toBe(true);
		expect(isInteractive(2, 0)).toBe(true);
		expect(isInteractive(3, 0)).toBe(true);
	});

	it("only the expanded item is interactive; every sibling is not", () => {
		expect(isInteractive(2, 2)).toBe(true);
		expect(isInteractive(1, 2)).toBe(false);
		expect(isInteractive(3, 2)).toBe(false);
	});
});
