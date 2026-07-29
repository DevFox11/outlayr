/**
 * Geometry for the shareable day-group card, kept apart from the Skia painter so
 * the layout can be asserted without a GPU surface.
 *
 * Coordinates are in points at 1x; the painter scales the whole canvas.
 */

export const DAY_CARD_WIDTH = 360;

const PADDING = 24;
const LABEL_SIZE = 11;
const TOTAL_SIZE = 34;
const NOTE_SIZE = 15;
const META_SIZE = 11;
const SIGNATURE_SIZE = 10;
const ROW_HEIGHT = 34;
const RULE_HEIGHT = 1.3;

/**
 * Skia can measure text but the layout runs without a surface, so widths are
 * estimated from the em size. Only truncation depends on it, and erring wide
 * clips a character early rather than overlapping the amount.
 */
const AVERAGE_GLYPH = 0.55;

export type CardWeight = "mono" | "regular" | "medium" | "semibold";
export type CardTone = "ink" | "muted";

export interface CardText {
	text: string;
	x: number;
	/** Baseline, not the top of the box. */
	y: number;
	size: number;
	weight: CardWeight;
	align: "left" | "right";
	tone: CardTone;
}

export interface CardRule {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface DayCardRow {
	note: string;
	/** Time, or the category name when "Swap Time Label" is on. */
	meta: string;
	amount: string;
}

export interface DayCardInput {
	dayLabel: string;
	total: string;
	rows: readonly DayCardRow[];
}

export interface DayCardLayout {
	width: number;
	height: number;
	texts: CardText[];
	rules: CardRule[];
}

export function truncateToWidth(
	text: string,
	size: number,
	maxWidth: number,
): string {
	const budget = Math.floor(maxWidth / (size * AVERAGE_GLYPH));
	if (budget >= text.length) {
		return text;
	}
	if (budget < 1) {
		return "…";
	}
	return `${text.slice(0, budget - 1).trimEnd()}…`;
}

export function layoutDayCard(input: DayCardInput): DayCardLayout {
	const texts: CardText[] = [];
	const rules: CardRule[] = [];
	const left = PADDING;
	const right = DAY_CARD_WIDTH - PADDING;
	const contentWidth = right - left;

	let y = PADDING + LABEL_SIZE;
	texts.push({
		text: input.dayLabel,
		x: left,
		y,
		size: LABEL_SIZE,
		weight: "mono",
		align: "left",
		tone: "muted",
	});

	y += TOTAL_SIZE + 6;
	texts.push({
		text: input.total,
		x: left,
		y,
		size: TOTAL_SIZE,
		weight: "semibold",
		align: "left",
		tone: "ink",
	});

	y += 18;
	rules.push({ x: left, y, width: contentWidth, height: RULE_HEIGHT });

	// The amount takes the trailing third; the note is truncated against what is
	// left so the two never overlap on a long merchant name.
	const amountWidth = contentWidth * 0.36;
	const noteWidth = contentWidth - amountWidth - 12;

	for (const row of input.rows) {
		y += ROW_HEIGHT;
		texts.push({
			text: truncateToWidth(row.note, NOTE_SIZE, noteWidth),
			x: left,
			y,
			size: NOTE_SIZE,
			weight: "medium",
			align: "left",
			tone: "ink",
		});
		texts.push({
			text: row.amount,
			x: right,
			y,
			size: NOTE_SIZE,
			weight: "medium",
			align: "right",
			tone: "ink",
		});
		if (row.meta !== "") {
			y += META_SIZE + 3;
			texts.push({
				text: truncateToWidth(row.meta, META_SIZE, noteWidth),
				x: left,
				y,
				size: META_SIZE,
				weight: "regular",
				align: "left",
				tone: "muted",
			});
		}
	}

	y += 22;
	rules.push({ x: left, y, width: contentWidth, height: RULE_HEIGHT });

	y += SIGNATURE_SIZE + 14;
	texts.push({
		text: "OUTLAYR",
		x: left,
		y,
		size: SIGNATURE_SIZE,
		weight: "mono",
		align: "left",
		tone: "muted",
	});

	return {
		width: DAY_CARD_WIDTH,
		height: y + PADDING,
		texts,
		rules,
	};
}
