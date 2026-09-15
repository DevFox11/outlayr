import { useCallback } from "react";
import type { Ref, RefObject } from "react";

/** One callback ref that fills a local ref and whatever ref the parent forwarded. */
export function useMergedRef<T>(localRef: RefObject<T | null>, forwardedRef: Ref<T> | undefined) {
    return useCallback(
        (node: T | null) => {
            localRef.current = node;
            if (!forwardedRef) {
                return;
            }
            // React's `Ref` is a callback or an object with `current`; only the
            // second has the property, which is what tells the two apart.
            if ("current" in forwardedRef) {
                forwardedRef.current = node;
            } else {
                forwardedRef(node);
            }
        },
        [localRef, forwardedRef]
    );
}
