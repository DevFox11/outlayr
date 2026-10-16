import { useMemo } from "react";

import closeLightIcon from "@/assets/toolbar-icons/close-light.png";
import closeIcon from "@/assets/toolbar-icons/close.png";
import type { MaterialRoleColors } from "@/theme/material-roles";
import { contrastRatio } from "@/theme/material-scheme";
import { useMaterialColors } from "@/theme/use-material-colors";

import { appBarOptions, SHEET_CORNER_RADIUS } from "./material-chrome";
import type { StackChrome } from "./stack-chrome";

/**
 * Material 3 chrome for the root stack (Direction B):
 * - Titled screens get the opaque small top app bar, so content starts below it.
 * - Modals are full-screen dialogs: they rise from the bottom and close with an
 *   X in the navigation icon's place, which is why `CloseToolbar` draws nothing
 *   on Android.
 * - Form sheets stay modal bottom sheets with 28dp corners on
 *   `surfaceContainerLow`. Android never gives a sheet an app bar, so the
 *   header is off here and `SheetHeader` draws one inside the sheet.
 */

const BLACK = "#000000";
const WHITE = "#ffffff";

/**
 * The dialog's X, baked dark or light for the bar it sits on.
 * react-native-screens tints the navigation icon before it swaps a custom back
 * image in, so the image is drawn untinted and has to carry its own colour.
 */
function closeIconOn(surface: string) {
    return contrastRatio(WHITE, surface) > contrastRatio(BLACK, surface) ? closeLightIcon : closeIcon;
}

export function stackChrome(m3: MaterialRoleColors): StackChrome {
    const appBar = appBarOptions(m3);
    const sheet = {
        contentStyle: { backgroundColor: m3.surfaceContainerLow },
        headerShown: false,
        presentation: "formSheet",
        sheetCornerRadius: SHEET_CORNER_RADIUS,
    } as const;
    const pickerSheet = (detent: number) => ({ ...sheet, sheetAllowedDetents: [detent, 1] });
    const dialog = {
        ...appBar,
        animation: "slide_from_bottom",
        headerBackImageSource: closeIconOn(m3.surface),
        presentation: "modal",
    } as const;

    return {
        bareModal: { animation: "slide_from_bottom", headerShown: false, presentation: "modal" },
        // Sized by its content, not by detents (`use-resting-sheet.android.ts`).
        entrySheet: { ...sheet, sheetAllowedDetents: "fitToContents", sheetResizeAnimationEnabled: false, title: "" },
        // The flow paints its own ground under the bar, as on iOS.
        firstRunStep: { animation: "fade", headerShadowVisible: false, headerTransparent: true, title: "" },
        // Dimmed, unlike iOS: at an undimmed detent the editor under the picker takes taps.
        identityPicker: pickerSheet,
        modal: (title) => ({ ...dialog, title }),
        paywall: { ...dialog, title: "" },
        pickerSheet,
        pushed: appBar,
        // Search keeps the back arrow: it reads as a place you go back from, not a dialog you dismiss.
        search: (title) => ({ ...appBar, animation: "slide_from_bottom", presentation: "modal", title }),
        sheet: ({ title, detent }) => ({ ...sheet, sheetAllowedDetents: [detent, 1], title }),
        titled: (title) => ({ ...appBar, title }),
    };
}

/** The root stack's chrome, rebuilt when the Material scheme changes. */
export function useStackChrome(): StackChrome {
    const m3 = useMaterialColors();
    return useMemo(() => stackChrome(m3), [m3]);
}
