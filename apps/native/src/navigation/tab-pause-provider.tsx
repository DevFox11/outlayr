import { useRoute } from "expo-router";
import { useNavigationState } from "expo-router/react-navigation";
import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";

import { createTabPause, TabPauseContext } from "@/data/tab-pause";

/**
 * Wraps one tab's stack. Every tab stays mounted, and nothing in NativeTabs
 * freezes the ones in the background, so without this each live read in a tab
 * nobody is looking at re-renders on every write.
 *
 * Selection is read from the tab navigator rather than `useIsFocused`, which
 * also turns false under a modal: the Log behind the entry form keeps updating.
 */
export function TabPauseProvider({ children }: { children: ReactNode }) {
    const routeKey = useRoute().key;
    const selected = useNavigationState((state) => state.routes[state.index]?.key === routeKey);
    const [pause] = useState(createTabPause);

    // Layout rather than passive: the replay then renders in the same task as the
    // commit that selected the tab, not a frame after it.
    useLayoutEffect(() => {
        pause.setSelected(selected);
    }, [pause, selected]);

    return <TabPauseContext.Provider value={pause}>{children}</TabPauseContext.Provider>;
}
