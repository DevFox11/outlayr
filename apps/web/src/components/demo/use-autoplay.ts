import { useEffect, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const IN_VIEW_THRESHOLD = 0.3;

function subscribeMotion(onChange: () => void) {
    const query = window.matchMedia(REDUCED_MOTION);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

function subscribeVisibility(onChange: () => void) {
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
}

export function useAutoplay(ref: RefObject<HTMLElement | null>) {
    const reduced = useSyncExternalStore(
        subscribeMotion,
        () => window.matchMedia(REDUCED_MOTION).matches,
        () => false
    );
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
