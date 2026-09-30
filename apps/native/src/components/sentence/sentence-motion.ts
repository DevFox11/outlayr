import { Easing, Keyframe, ReduceMotion } from "react-native-reanimated";

/** The app's motion curve, shared so nothing here invents a second one. */
export const EASE = Easing.bezier(0.645, 0.045, 0.355, 1);

const WRITE_MS = 260;

/**
 * One cluster behind the last. `MARK_MOTION.stagger` is 90ms, which is right for
 * four blocks and far too slow for the dozen clusters a sentence splits into —
 * at 90 the full stop lands a second after the first word.
 */
const CLUSTER_STAGGER_MS = 34;

/** Long enough to read as a stroke rather than a state change. */
export const SENTENCE_DRAW = { duration: 300, easing: EASE } as const;

/**
 * The wash arriving behind, or leaving, the slot the bottom stage is editing.
 * Shorter than a draw because it is a move between two words rather than a
 * mark being made, and the pad below it has already changed by then.
 */
export const SENTENCE_WASH = { duration: 180, easing: EASE } as const;

const RISE = 10;

/**
 * The sentence writing itself in, one cluster at a time. Order is the
 * template's, so a language that puts the account before the category writes in
 * that order too, with nothing here needing to know.
 */
export function clusterEntering(index: number) {
    return new Keyframe({
        0: { opacity: 0, transform: [{ translateY: RISE }] },
        100: { opacity: 1, transform: [{ translateY: 0 }] },
    })
        .duration(WRITE_MS)
        .delay(Math.max(0, index) * CLUSTER_STAGGER_MS)
        .reduceMotion(ReduceMotion.System);
}

/**
 * Content a chip opened, arriving under the sentence. The same rise and fade
 * the sentence writes itself in with, so the screen has one idea about how a
 * new fact appears rather than one per surface.
 */
export function revealEntering() {
    return new Keyframe({
        0: { opacity: 0, transform: [{ translateY: RISE }] },
        100: { opacity: 1, transform: [{ translateY: 0 }] },
    })
        .duration(WRITE_MS)
        .reduceMotion(ReduceMotion.System);
}

/**
 * A value arriving where another already was. No `exiting` partner on purpose:
 * Reanimated keeps an exiting view mounted, and two values in a wrapping row
 * would hold the sentence at both widths for the length of the fade and reflow
 * every word after them.
 */
export function valueEntering() {
    return new Keyframe({
        0: { opacity: 0, transform: [{ translateY: RISE * 0.6 }] },
        100: { opacity: 1, transform: [{ translateY: 0 }] },
    })
        .duration(WRITE_MS)
        .reduceMotion(ReduceMotion.System);
}
