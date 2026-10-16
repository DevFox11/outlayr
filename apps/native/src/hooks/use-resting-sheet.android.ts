import { useEffect, useState } from "react";
import { AccessibilityInfo, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LARGE_SHEET_TOP_INSET } from "@/lib/sheet-detents";
import { SHEET_HEADER_HEIGHT } from "@/navigation/material-chrome";

import type { SheetRest } from "./use-resting-sheet";

export type { SheetRest } from "./use-resting-sheet";

const REST_BODY_ESTIMATE = 170;
const REST_BOTTOM_ROOM = 8;

/**
 * Declared by the root stack too (`stackChrome().entrySheet`), so the sheet is
 * created with it. One object for the sheet's whole life: see below.
 */
const SHEET = { sheetAllowedDetents: "fitToContents", sheetResizeAnimationEnabled: false } as const;

/**
 * The entry sheet's resting state on Android, same contract as iOS, but the
 * sheet is sized by its content instead of by detents.
 *
 * react-native-screens on Android reads `sheetAllowedDetents` when it creates
 * the sheet and again only on a keyboard or inset change, so the iOS way of
 * waking (re-declaring the detents as `LARGE_ONLY`) never moves the sheet. It
 * also leaves a two-detent sheet holding one detent, and a swipe down from full
 * height then crashes ("Invalid state 4 for detentCount 1"). The one mode it
 * resizes at runtime is `fitToContents`: the sheet follows its content's
 * height. So the declared detents never change, and `height` (applied by
 * `RestingSheetFrame`) does the moving: the header and the measured body at
 * rest, the tallest sheet once awake.
 *
 * A fit-to-contents sheet has one height, so dragging a resting sheet up does
 * not wake it. A tap on the body or the keyboard does (`rest.onWake`), as the
 * rest is meant to be woken on iOS too; a swipe down closes it.
 */
export function useRestingSheet(wakeAnnouncement: string) {
    const { height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [awake, setAwake] = useState(false);
    const [bodyHeight, setBodyHeight] = useState(REST_BODY_ESTIMATE);

    useEffect(() => {
        if (awake) {
            AccessibilityInfo.announceForAccessibility(wakeAnnouncement);
        }
    }, [awake, wakeAnnouncement]);

    const height = awake
        ? windowHeight - LARGE_SHEET_TOP_INSET
        : SHEET_HEADER_HEIGHT + bodyHeight + REST_BOTTOM_ROOM + insets.bottom;
    const rest: SheetRest | undefined = awake ? undefined : { onHeight: setBodyHeight, onWake: () => setAwake(true) };

    return { awake, height, rest, sheet: SHEET };
}
