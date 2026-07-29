import {
	FontWeight,
	ImageFormat,
	type SkCanvas,
	Skia,
	type SkTypeface,
} from "@shopify/react-native-skia";
import {
	type CardTone,
	type CardWeight,
	type DayCardInput,
	layoutDayCard,
} from "@/domain/day-card";
import { shareBytes, TransferError } from "./data-transfer";

/** Retina-density raster of a layout measured in points. */
const SCALE = 3;

/**
 * Fixed light ink on paper rather than the active theme: the card is looked at
 * in Photos and Messages, where a dark-mode export reads as a rendering fault.
 */
const PAPER = "#FFFFFF";
const INK = "#17150F";
const MUTED = "#767676";

const WEIGHTS: Record<CardWeight, FontWeight> = {
	mono: FontWeight.Medium,
	regular: FontWeight.Normal,
	medium: FontWeight.Medium,
	semibold: FontWeight.SemiBold,
};

/**
 * The empty name asks for the platform default; the rest are the concrete
 * families to fall back through. `matchFamilyStyle` is typed non-null but does
 * return null for a family the device lacks, and `Skia.Font(undefined)` still
 * draws in the default face, so an unmatched weight loses its weight rather
 * than the card.
 */
const FAMILIES = ["", "System", "Helvetica Neue", "Roboto", "sans-serif"];

const TYPEFACES = new Map<CardWeight, SkTypeface | undefined>();

function typefaceFor(weight: CardWeight): SkTypeface | undefined {
	if (TYPEFACES.has(weight)) {
		return TYPEFACES.get(weight);
	}
	const manager = Skia.FontMgr.System();
	let found: SkTypeface | undefined;
	for (const family of FAMILIES) {
		const candidate = manager.matchFamilyStyle(family, {
			weight: WEIGHTS[weight],
		}) as SkTypeface | null;
		if (candidate != null) {
			found = candidate;
			break;
		}
	}
	TYPEFACES.set(weight, found);
	return found;
}

function paintFor(tone: CardTone) {
	const paint = Skia.Paint();
	paint.setColor(Skia.Color(tone === "ink" ? INK : MUTED));
	paint.setAntiAlias(true);
	return paint;
}

function draw(canvas: SkCanvas, input: DayCardInput): void {
	const layout = layoutDayCard(input);

	const background = Skia.Paint();
	background.setColor(Skia.Color(PAPER));
	canvas.drawRect(Skia.XYWHRect(0, 0, layout.width, layout.height), background);

	const rulePaint = paintFor("muted");
	rulePaint.setAlphaf(0.35);
	for (const rule of layout.rules) {
		canvas.drawRect(
			Skia.XYWHRect(rule.x, rule.y, rule.width, rule.height),
			rulePaint,
		);
	}

	for (const text of layout.texts) {
		const font = Skia.Font(typefaceFor(text.weight), text.size);
		const paint = paintFor(text.tone);
		const width = font.measureText(text.text).width;
		const x = text.align === "right" ? text.x - width : text.x;
		canvas.drawText(text.text, x, text.y, paint, font);
	}
}

export function renderDayCard(input: DayCardInput): Uint8Array | null {
	const layout = layoutDayCard(input);
	const surface = Skia.Surface.MakeOffscreen(
		Math.ceil(layout.width * SCALE),
		Math.ceil(layout.height * SCALE),
	);
	if (surface == null) {
		return null;
	}

	const canvas = surface.getCanvas();
	canvas.scale(SCALE, SCALE);
	draw(canvas, input);
	surface.flush();

	const encoded = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG);
	return encoded.length > 0 ? encoded : null;
}

/**
 * Routed through the share sheet rather than written straight to the album,
 * which would need `expo-media-library` and a photo-write permission prompt for
 * a feature the user may only want once. "Save Image" is one tap inside the
 * sheet, and the same sheet also covers Messages, Mail and Files.
 */
export async function shareDayCard(
	input: DayCardInput,
	fileName: string,
): Promise<void> {
	const bytes = renderDayCard(input);
	if (bytes == null) {
		throw new TransferError("The image couldn't be drawn on this device.");
	}
	await shareBytes(bytes, fileName, "image/png", "Share day");
}
