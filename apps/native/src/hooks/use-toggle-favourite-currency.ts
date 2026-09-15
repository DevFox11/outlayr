import { toggleFavouriteCurrency } from "@/data/favourite-currencies-core";
import type { Database } from "@/db/client";
import { isFavourite } from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n/context";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";

/**
 * Reads the cap off the list the write produced, not off the array at press
 * time: toggles are serialised, so a row rendered a tick before another landed
 * would otherwise mis-read it.
 */
export function useToggleFavouriteCurrency(db: Database | null) {
    const haptics = useHaptics();
    const t = useTranslation();
    return (code: string, favourite: boolean) => {
        if (db === null) {
            return;
        }
        toggleFavouriteCurrency(db, code)
            .then((next) => {
                // oxlint-disable-next-line promise/no-callback-in-promise -- a press handler is not a promise chain, so the haptic has nowhere else to be sequenced from
                haptics(favourite || isFavourite(next, code) ? "light" : "warning");
            })
            // The `catch` inside `toggleFavouriteCurrency` guards its queue, not
            // this caller — the promise it returns still rejects. Without this the
            // star simply does not move, and nothing says why.
            .catch((error) => {
                console.error("Failed to change the favourite currencies", error);
                notifyFailure({
                    body: t("settings.currency.favouriteFailedBody"),
                    title: t("settings.currency.favouriteFailedTitle"),
                });
            });
    };
}
