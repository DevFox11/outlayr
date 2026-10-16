import { Stack } from "expo-router";

export interface ScreenHeaderProps {
    /** The bar's title. Omit it to keep whatever the layout set. */
    title?: string;
    /** iOS only: the large title that collapses into the bar on scroll. */
    large?: boolean;
}

/**
 * The page-level header for a pushed or presented screen, in place of a bare
 * `<Stack.Header transparent />` plus `<Stack.Screen.Title>`.
 *
 * iOS: a transparent bar that content scrolls under, relying on the
 * scroller's `contentInsetAdjustmentBehavior`, with an optional large title.
 * `screen-header.android.tsx` draws the opaque Material 3 small app bar
 * instead, which Android needs for content to start below the bar.
 *
 * Works from inside a screen, not as a `Stack.Screen` child in a layout:
 * page-level header pieces apply through composition options, while a
 * layout matches its children by element type.
 */
export function ScreenHeader({ title, large }: ScreenHeaderProps) {
    return (
        <>
            <Stack.Header transparent />
            {title === undefined ? null : <Stack.Screen.Title large={large}>{title}</Stack.Screen.Title>}
        </>
    );
}
