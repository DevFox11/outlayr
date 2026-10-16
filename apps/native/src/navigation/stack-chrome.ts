import type { NativeStackNavigationOptions } from "expo-router";

import type { MaterialRoleColors } from "@/theme/material-roles";

type Options = NativeStackNavigationOptions;

/**
 * The chrome each group of root-stack screens wears, as `options` objects.
 *
 * `options` rather than `<Stack.Header>` / `<Stack.Screen.Title>` children,
 * because a layout matches `Stack.Screen` children by element type and so can't
 * pick them per platform. This file is iOS's answer and must stay exactly what
 * those children produced (`stack-chrome.test.tsx` holds it to that);
 * `stack-chrome.android.ts` is the Material 3 one.
 */
export interface StackChrome {
    /** Pushed screens with a title: `TITLED_SCREENS`. */
    titled: (title: string) => Options;
    /** Pushed screens that title themselves: reorder, account detail, a license. */
    pushed: Options;
    /** Form sheets at their own resting detent: `SHEET_SCREENS`. */
    sheet: (sheet: { title: string; detent: number }) => Options;
    /**
     * The entry edit sheets. iOS lets `useRestingSheet` set the detents from
     * inside the sheet; Android declares the same constant detents here, since
     * it reads them only when it creates the sheet.
     */
    entrySheet: Options;
    /** A picker sized to its content that draws its own header: the category symbol picker. */
    pickerSheet: (detent: number) => Options;
    /**
     * `transactions/identity`, the picker sheet over the account editor or entry
     * form that opened it. iOS rests it undimmed so the editor's identity can fly
     * up into it. Android has no fly-up and dims it, so the editor underneath
     * can't take taps.
     */
    identityPicker: (detent: number) => Options;
    /** Modals with a title: `MODAL_SCREENS`. */
    modal: (title: string) => Options;
    /** Modals that draw everything themselves: voice and scan. */
    bareModal: Options;
    search: (title: string) => Options;
    paywall: Options;
    /**
     * A bare chevron over the step's own background: `minimal` drops the back
     * title, which would otherwise read the cover's title from behind it. `fade`
     * swaps the default horizontal push for a crossfade, so advancing reads as
     * the stage trading objects rather than a new page sliding in.
     */
    firstRunStep: Options;
}

/** Content scrolls under the bar, inset by each scroller's `contentInsetAdjustmentBehavior`. */
const TRANSPARENT_HEADER = { headerTransparent: true } as const;
const MINIMAL_BACK = { headerBackButtonDisplayMode: "minimal" } as const;

const pickerSheet = (detent: number): Options => ({
    headerShown: false,
    presentation: "formSheet",
    sheetAllowedDetents: [detent, 1],
    sheetCornerRadius: 40,
    sheetGrabberVisible: true,
});

const CHROME: StackChrome = {
    bareModal: { headerShown: false, presentation: "modal" },
    entrySheet: { ...TRANSPARENT_HEADER, presentation: "formSheet", title: "" },
    firstRunStep: {
        animation: "fade",
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerTransparent: true,
        title: "",
    },
    identityPicker: (detent) => ({ ...pickerSheet(detent), sheetLargestUndimmedDetentIndex: 0 }),
    modal: (title) => ({ ...TRANSPARENT_HEADER, ...MINIMAL_BACK, presentation: "modal", title }),
    paywall: { ...TRANSPARENT_HEADER, presentation: "modal", sheetGrabberVisible: true, title: "" },
    pickerSheet,
    pushed: {},
    search: (title) => ({ ...TRANSPARENT_HEADER, presentation: "modal", sheetGrabberVisible: true, title }),
    sheet: ({ title, detent }) => ({
        ...TRANSPARENT_HEADER,
        ...MINIMAL_BACK,
        presentation: "formSheet",
        sheetAllowedDetents: [detent, 1],
        sheetGrabberVisible: true,
        title,
    }),
    titled: (title) => ({ ...TRANSPARENT_HEADER, ...MINIMAL_BACK, title }),
};

/** The root stack's chrome. iOS draws it from the system, so the colours go unread. */
export function stackChrome(_m3: MaterialRoleColors): StackChrome {
    return CHROME;
}

/** The root stack's chrome for the current scheme. On iOS it never changes, so nothing is subscribed. */
export function useStackChrome(): StackChrome {
    return CHROME;
}
