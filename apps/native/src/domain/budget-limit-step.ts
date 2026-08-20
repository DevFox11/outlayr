/**
 * The step a limit moves in, dragged or suggested.
 *
 * Twenty-five keeps a full-height drag inside a hundred or so stops, which is
 * what makes the line feel like it snaps rather than slides, and it is the
 * granularity people already state budgets in.
 */
export const LIMIT_STEP = 25;

/** Rounds to {@link LIMIT_STEP}, never below one step and never above `max`. */
export function snapToStep(value: number, max: number): number {
    const stepped = Math.round(value / LIMIT_STEP) * LIMIT_STEP;
    return Math.min(max, Math.max(LIMIT_STEP, stepped));
}

/**
 * A limit to open on when nothing else says so: four fifths of what this window
 * has already taken, so the line starts somewhere the curve already crosses
 * rather than flat on the axis.
 *
 * Nothing spent leaves nothing to derive it from, and the figure stays zero — the
 * sheet then opens the keypad rather than proposing a number out of the air.
 */
export function suggestedLimit(spent: number): number {
    return spent <= 0 ? 0 : Math.max(LIMIT_STEP, Math.round((spent * 0.8) / LIMIT_STEP) * LIMIT_STEP);
}
