import { useIsFocused, useSegments } from "expo-router";
import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Freeze } from "react-freeze";
import { useUniwind } from "uniwind";

import { useSettingNumber } from "@/contexts/display-settings-context";

/**
 * Holds a tab's screen still while it is not the one on screen; a screen over the tabs leaves it be.
 *
 * `NativeTabs` keeps all four tab screens mounted, and unlike the older
 * `react-native-screens` `Screen` there is no `freezeOnBlur` on the `Tabs`
 * component it renders — a blurred screen re-renders on every global tick it
 * subscribes to, at the full cost of whatever it draws.
 *
 * `Freeze` suspends the subtree rather than unmounting it: state and passive
 * effects survive and held updates land in one render on return. Layout effects
 * do not, and uniwind subscribes in them, so a look changed while frozen remounts.
 */
export function FreezeOnBlur({ children }: { children: ReactNode }) {
    const isFocused = useIsFocused();
    const covered = useSegments()[0] !== "(tabs)";
    const [frozen, setFrozen] = useState(false);
    const look = `${useUniwind().theme}:${useSettingNumber("accentColor")}`;
    const [seenLook, setSeenLook] = useState(look);
    const [generation, setGeneration] = useState(0);
    if (look !== seenLook) {
        setSeenLook(look);
        if (frozen) {
            setGeneration(generation + 1);
        }
    }

    // Deferred a macrotask, the way `react-native-screens` defers its own
    // `freezeOnBlur` (components/helpers/DelayedFreeze.tsx): focus flips when the
    // navigation state changes, which is before the transition has run, and
    // suspending mid-push swaps the outgoing screen for the empty fallback in
    // front of the user.
    useEffect(() => {
        if (covered) {
            return;
        }
        const handle = setTimeout(() => {
            setFrozen(!isFocused);
        }, 0);
        return () => {
            clearTimeout(handle);
        };
    }, [covered, isFocused]);

    return (
        <Freeze freeze={frozen}>
            <Fragment key={generation}>{children}</Fragment>
        </Freeze>
    );
}
