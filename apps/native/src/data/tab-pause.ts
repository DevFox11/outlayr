import { createContext, use, useCallback } from "react";

/** The `subscribe` half of a `useSyncExternalStore` store. */
export type StoreSubscribe = (onChange: () => void) => () => void;

/**
 * The store notifications of one tab. Passed straight on while the tab is
 * selected; while another tab is, they are held and each listener is replayed
 * once when this tab is selected again, so a background tab catches up in one
 * render instead of rendering on every write.
 */
export function createTabPause() {
    let selected = true;
    const held = new Set<() => void>();

    return {
        setSelected(next: boolean): void {
            selected = next;
            if (!selected) {
                return;
            }
            const replay = [...held];
            held.clear();
            for (const onChange of replay) {
                onChange();
            }
        },
        subscribe(source: StoreSubscribe, onChange: () => void): () => void {
            const off = source(() => {
                if (selected) {
                    onChange();
                } else {
                    held.add(onChange);
                }
            });
            return () => {
                off();
                held.delete(onChange);
            };
        },
    };
}

export type TabPause = ReturnType<typeof createTabPause>;

/** Provided per tab by `TabPauseProvider`; null outside the tabs. */
export const TabPauseContext = createContext<TabPause | null>(null);

/** `subscribe`, held back while the enclosing tab is in the background. Outside a tab it is passed through. */
export function useTabPaused(subscribe: StoreSubscribe): StoreSubscribe {
    const pause = use(TabPauseContext);
    return useCallback(
        (onChange: () => void) => (pause === null ? subscribe(onChange) : pause.subscribe(subscribe, onChange)),
        [pause, subscribe]
    );
}
