export const HAPTICS_OFF = 0;
export const HAPTICS_SUBTLE = 1;
export const HAPTICS_EXCESSIVE = 2;

/**
 * What just happened, from the call site's point of view.
 *
 * The split that matters is between a **tick** — `selection` and `keyTap`, which
 * stream while a finger is still moving — and a **landing**, which fires once
 * something is settled. That is the line the Haptics setting draws: "Subtle" is
 * described to the user as a tap when something lands, "Excessive" as a tap for
 * every action. Swift gates its keypad the same way, at `excessive` only
 * (`NumberPad.swift:28`).
 */
export type HapticEvent = "selection" | "keyTap" | "light" | "medium" | "heavy" | "success" | "warning" | "error";

export const HAPTIC_EVENTS: readonly HapticEvent[] = [
	"selection",
	"keyTap",
	"light",
	"medium",
	"heavy",
	"success",
	"warning",
	"error",
];

export type HapticPlay =
	| { kind: "selection" }
	| { kind: "impact"; style: "light" | "medium" | "heavy" }
	| { kind: "notification"; type: "success" | "warning" | "error" };

/** What the device should actually do, or `null` for silence. */
export function hapticPlay(level: number, event: HapticEvent): HapticPlay | null {
	if (level < HAPTICS_SUBTLE) {
		return null;
	}
	switch (event) {
		case "selection":
		case "keyTap":
			return level >= HAPTICS_EXCESSIVE ? { kind: "selection" } : null;
		case "light":
		case "medium":
		case "heavy":
			return { kind: "impact", style: event };
		case "success":
		case "warning":
		case "error":
			return { kind: "notification", type: event };
		default: {
			const unhandled: never = event;
			throw new Error(`Unhandled haptic event: ${String(unhandled)}`);
		}
	}
}
