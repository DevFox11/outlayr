/**
 * Collapses a burst of writes into one publish. A recurrence back-fill inserts a
 * row at a time and each one fires a change event, which without this would
 * spend the whole day's WidgetKit reload allowance on a single sweep.
 */
export const PUBLISH_DEBOUNCE_MS = 750;

/**
 * Spotlight is paced for a session, not for a write: every pass clears and
 * rewrites a whole domain, so it is deliberately two orders of magnitude behind
 * the tiles. It is an accelerator on top of the passes at open and at background
 * — never the guarantee, because a change event is not owed for every write (see
 * the truncate-optimization note in `use-system-sync.ts`).
 */
export const SPOTLIGHT_DEBOUNCE_MS = 20_000;

/** Only these tables change what a widget renders. */
const WIDGET_TABLES = new Set(["transactions", "budgets", "mainBudget", "categories", "appMeta"]);

/**
 * What `indexSpotlight` reads. `mainBudget` is absent on purpose: the index
 * lists budget rows and never the overall-budget singleton, so a change to it
 * would cost a full domain rewrite that produces identical items.
 */
const SPOTLIGHT_TABLES = new Set(["transactions", "budgets", "categories", "appMeta"]);

export function affectsWidgets(tableName: string): boolean {
    return WIDGET_TABLES.has(tableName);
}

export function affectsSpotlight(tableName: string): boolean {
    return SPOTLIGHT_TABLES.has(tableName);
}

export interface Debounced {
    cancel: () => void;
    schedule: () => void;
}

/** Trailing-edge only: the burst has to settle before the work runs. */
export function debounce(delayMs: number, run: () => void): Debounced {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };
    return {
        cancel,
        schedule: () => {
            cancel();
            timer = setTimeout(() => {
                timer = null;
                run();
            }, delayMs);
        },
    };
}
