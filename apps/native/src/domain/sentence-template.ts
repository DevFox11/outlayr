const PLACEHOLDER = /\{(\w+)\}/g;
const WHITESPACE = /(\s+)/;

interface SentenceAtom {
    readonly kind: "slot" | "text";
    /** The slot's name for `slot`, the literal word for `text`. */
    readonly value: string;
}

/**
 * Atoms the template wrote with no whitespace between them. They render on one
 * line together, so a closing full stop never wraps away from the value it
 * closes and Spanish's opening `¿`/`¡` never wraps away from what it opens.
 */
export interface SentenceCluster {
    readonly atoms: readonly SentenceAtom[];
}

/**
 * Splits a translated template into the units a wrapping row can lay out.
 *
 * The placeholder syntax is `@/i18n/translate`'s own, so a sentence is an
 * ordinary catalog string: `t(key)` with no params returns it uninterpolated,
 * and `catalog.test.ts` already fails a locale whose placeholder set drifts.
 * Word order is therefore the translator's to change, which is the whole point
 * — nothing here assumes a slot appears in any particular position.
 */
export function parseSentence(template: string): readonly SentenceCluster[] {
    const clusters: SentenceAtom[][] = [];
    let current: SentenceAtom[] = [];

    const breakCluster = () => {
        if (current.length > 0) {
            clusters.push(current);
            current = [];
        }
    };

    const pushText = (text: string) => {
        for (const piece of text.split(WHITESPACE)) {
            if (piece === "") {
                continue;
            }
            if (piece.trim() === "") {
                breakCluster();
                continue;
            }
            current.push({ kind: "text", value: piece });
        }
    };

    let cursor = 0;
    for (const match of template.matchAll(PLACEHOLDER)) {
        pushText(template.slice(cursor, match.index));
        current.push({ kind: "slot", value: match[1] });
        cursor = match.index + match[0].length;
    }
    pushText(template.slice(cursor));
    breakCluster();

    return clusters.map((atoms) => ({ atoms }));
}

export function sentenceSlotNames(template: string): readonly string[] {
    return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]);
}
