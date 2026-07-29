/** A piece's flight, in fractions of the burst box — the view supplies points. */
export interface ConfettiPiece {
	/** Stable within a burst; a burst is never reordered or appended to. */
	id: number;
	/** Launch point across the burst width: 0 is the left edge, 1 the right. */
	x: number;
	/** Sideways travel over the whole flight, in burst widths, signed. */
	drift: number;
	/** Peak height above the launch point, in burst heights. */
	rise: number;
	/** Depth below the launch point at landing, in burst heights. */
	fall: number;
	delayMs: number;
	durationMs: number;
	/** Total turn over the flight, in degrees, signed. */
	spin: number;
	/** Longest side, in points. */
	size: number;
	colorIndex: number;
}

/** Budget every piece lands inside, so one timer can retire the whole burst. */
export const CONFETTI_FLIGHT_MS = 1600;

const MAX_DELAY_MS = 240;
const MIN_DURATION_MS = 900;

/** mulberry32 — a burst has to survive a re-render without reshuffling. */
function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function confettiBurst(
	count: number,
	colorCount: number,
	seed: number,
): ConfettiPiece[] {
	if (count <= 0) {
		return [];
	}
	const palette = Math.max(1, Math.trunc(colorCount));
	const next = random(seed);
	const pieces: ConfettiPiece[] = [];

	for (let index = 0; index < count; index += 1) {
		const delayMs = Math.round(next() * MAX_DELAY_MS);
		const spread = CONFETTI_FLIGHT_MS - MIN_DURATION_MS - delayMs;
		pieces.push({
			id: index,
			x: next(),
			drift: (next() - 0.5) * 0.9,
			rise: 0.35 + next() * 0.4,
			fall: 1.1 + next() * 0.35,
			delayMs,
			durationMs: MIN_DURATION_MS + Math.round(next() * spread),
			spin: (next() - 0.5) * 1440,
			size: 6 + Math.round(next() * 6),
			// Dealt round-robin rather than drawn: a short burst over a small
			// palette otherwise leaves whole colours unused often enough to read
			// as a bug.
			colorIndex: index % palette,
		});
	}

	return pieces;
}
