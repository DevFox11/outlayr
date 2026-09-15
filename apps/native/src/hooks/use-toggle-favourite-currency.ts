import { toggleFavouriteCurrency } from "@/data/favourite-currencies-core";
import type { Database } from "@/db/client";
import { isFavourite } from "@/domain/favourite-currencies";
import { useHaptics } from "@/lib/use-haptics";

/**
 * Reads the cap off the list the write produced, not off the array at press
 * time: toggles are serialised, so a row rendered a tick before another landed
 * would otherwise mis-read it.
 */
export function useToggleFavouriteCurrency(db: Database | null) {
    const haptics = useHaptics();
    return (code: string, favourite: boolean) => {
        if (db === null) {
            return;
        }
        toggleFavouriteCurrency(db, code).then((next) => {
            // oxlint-disable-next-line promise/no-callback-in-promise -- a press handler is not a promise chain, so the haptic has nowhere else to be sequenced from
            haptics(favourite || isFavourite(next, code) ? "light" : "warning");
        });
    };
}
