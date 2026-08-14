import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Freeze } from "react-freeze";

/**
 * Holds a tab's screen still while the tab is not the one on screen.
 *
 * `NativeTabs` keeps all four tab screens mounted, and unlike the older
 * `react-native-screens` `Screen` there is no `freezeOnBlur` on the `Tabs`
 * component it renders — a blurred screen re-renders on every global tick it
 * subscribes to, at the full cost of whatever it draws.
 *
 * `Freeze` suspends the subtree rather than unmounting it: state, effects and
 * store subscriptions all survive, updates arriving during the freeze are held,
 * and the screen renders once on return with the current values.
 */
export function FreezeOnBlur({ children }: { children: ReactNode }) {
    const isFocused = useIsFocused();
    const [frozen, setFrozen] = useState(false);

    // Deferred a macrotask, the way `react-native-screens` defers its own
    // `freezeOnBlur` (components/helpers/DelayedFreeze.tsx): focus flips when the
    // navigation state changes, which is before the transition has run, and
    // suspending mid-push swaps the outgoing screen for the empty fallback in
    // front of the user.
    useEffect(() => {
        const handle = setTimeout(() => {
            setFrozen(!isFocused);
        }, 0);
        return () => {
            clearTimeout(handle);
        };
    }, [isFocused]);

    return <Freeze freeze={frozen}>{children}</Freeze>;
}
