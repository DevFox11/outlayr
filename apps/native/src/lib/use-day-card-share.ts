import { useCallback } from "react";

import { dayCardContent, dayCardFileName } from "@/domain/day-card-content";
import type { CardableSection, DayCardOptions } from "@/domain/day-card-content";
import { translateNow } from "@/i18n/runtime";
import { notifyFailure } from "@/lib/notify";

import { TransferError } from "./data-transfer";
import { shareDayCard } from "./day-card-image";

/**
 * Swift offered this from a long press on the day group
 * (`Features/Transactions/Views/ListView.swift:52-63`) and wrote straight to the
 * photo album. The share sheet is used instead — see `shareDayCard` — so the
 * feature needs no photo-library permission.
 *
 * The choice itself is the day header's context menu; this only performs it, so
 * nothing stands between the menu item and the share sheet it opens.
 */
export function useDayCardShare(options: DayCardOptions): (section: CardableSection) => void {
    return useCallback(
        (section: CardableSection) => {
            shareDayCard(dayCardContent(section, options), dayCardFileName(section.day)).catch((cause: unknown) => {
                notifyFailure({
                    body:
                        cause instanceof TransferError
                            ? translateNow(cause.key)
                            : translateNow("alerts.dayCard.failedBody"),
                    title: translateNow("alerts.dayCard.failedTitle"),
                });
            });
        },
        [options]
    );
}
