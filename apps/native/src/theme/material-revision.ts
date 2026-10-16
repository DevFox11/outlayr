import { useSyncExternalStore } from "react";

/*
 * Which Material scheme the Android pipeline last applied, as a counter.
 *
 * Two jobs. It skips a write that would change nothing: uniwind restyles every
 * mounted styled component on every `updateCSSVariables`, identical values or
 * not, and the pipeline re-reads on every return to the foreground. And
 * `MaterialHost` keys its Compose `Host` on the counter: Compose reads the
 * wallpaper palette only while it composes, and none of `Host`'s props change
 * when the wallpaper does, so a Host that stays mounted keeps the old palette
 * until something remounts it.
 */

let revision = 0;
let applied = "";
const listeners = new Set<() => void>();

/**
 * Runs `write` for a scheme the app hasn't applied yet, then bumps the
 * revision. A resume that hands back the same palette costs one string
 * comparison and no restyle. `signature` is any string that changes exactly
 * when the scheme does.
 */
export function applyMaterialScheme(signature: string, write: () => void): void {
    if (signature === applied) {
        return;
    }
    write();
    applied = signature;
    revision += 1;
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const currentRevision = () => revision;

/** The revision of the last scheme applied; changes exactly when the palette does. */
export function useMaterialRevision(): number {
    return useSyncExternalStore(subscribe, currentRevision);
}
