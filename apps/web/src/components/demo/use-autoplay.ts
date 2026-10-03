import { useEffect, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

import { useReducedMotion } from "@/lib/reduced-motion";

const IN_VIEW_THRESHOLD = 0.3;

function subscribeVisibility(onChange: () => void) {
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
}

export function useAutoplay(ref: RefObject<HTMLElement | null>) {
    const reduced = useReducedMotion();
    const pageVisible = useSyncExternalStore(
        subscribeVisibility,
        () => document.visibilityState === "visible",
        () => false
    );
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (node === null) {
            return;
        }
        const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
            threshold: IN_VIEW_THRESHOLD,
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [ref]);

    return { reduced, running: inView && pageVisible && !reduced };
}
