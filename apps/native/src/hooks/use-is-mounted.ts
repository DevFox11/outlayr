import { useCallback, useEffect, useRef } from "react";

/**
 * A stable getter that reports whether the calling screen is still mounted.
 * For work that outlives a screen a modal gesture can dismiss (a save that
 * ends in `router.back()`): navigating from an unmounted screen pops the one
 * underneath instead.
 */
export function useIsMounted(): () => boolean {
    const mounted = useRef(true);
    useEffect(
        () => () => {
            mounted.current = false;
        },
        []
    );
    return useCallback(() => mounted.current, []);
}
