import { openBrowserAsync } from "expo-web-browser";
import type { WebBrowserResult } from "expo-web-browser";

/**
 * How long after `expectHandoff` the app has to actually leave, for a launch
 * that doesn't report back: a browser tab, another app, a settings page.
 * Awaited flows use `duringHandoff` instead, which closes the window as soon
 * as the call returns.
 */
const HANDOFF_WINDOW_MS = 5000;

/**
 * The longest an announced trip can last before the return counts as an app
 * switch after all. Leaving a Custom Tab, the camera or a share sheet for Home
 * sends Outlayr no event of its own, so without a cap a detour from the trip
 * would leave the ledger open indefinitely. A long read in a browser tab costs
 * one unlock on the way back.
 */
export const HANDOFF_TRIP_CAP_MS = 2 * 60 * 1000;

let expectedAt: number | null = null;
let leftAt: number | null = null;
let runningSince: number | null = null;

/**
 * Call right before Outlayr itself sends the user out of the app without
 * waiting on the result (a browser tab, the mail app, system settings). On
 * Android each of those backgrounds the app just like the Home button, and this
 * mark is how the app lock tells them apart (`use-relock.android.ts`). iOS
 * presents those flows over the app, so its relock never reads it.
 */
export function expectHandoff(now: number = Date.now()): void {
    expectedAt = now;
}

/**
 * Announces a trip for exactly as long as `run` takes: a picker, a permission
 * prompt, a share or purchase sheet. Every leave while `run` is pending counts,
 * up to the trip cap, since a library pick leaves again for its crop screen.
 * When `run` comes back without the app having left (permission already
 * granted, a sheet cancelled before it showed), the mark is cleared at once
 * instead of excusing the next Home press.
 */
export async function duringHandoff<T>(run: () => Promise<T>): Promise<T> {
    expectHandoff();
    runningSince = Date.now();
    try {
        return await run();
    } finally {
        expectedAt = null;
        runningSince = null;
    }
}

/**
 * On `background`: whether the app is leaving on the trip it just announced.
 * Spends the mark, so the next time out is judged on its own, and starts the
 * clock `handoffOverran` reads on the way back.
 */
export function takeHandoff(now: number = Date.now()): boolean {
    const announced = expectedAt !== null && now - expectedAt <= HANDOFF_WINDOW_MS;
    const awaited = runningSince !== null && now - runningSince <= HANDOFF_TRIP_CAP_MS;
    const expected = announced || awaited;
    expectedAt = null;
    leftAt = expected ? now : null;
    return expected;
}

/** On `active`: whether the announced trip ran past the cap, so the return relocks like any app switch. */
export function handoffOverran(now: number = Date.now()): boolean {
    const overran = leftAt !== null && now - leftAt > HANDOFF_TRIP_CAP_MS;
    leftAt = null;
    return overran;
}

/** The in-app browser, announced first: on Android a Custom Tab is an activity of its own, and the call returns as soon as it opens. */
export function openInAppBrowser(url: string): Promise<WebBrowserResult> {
    expectHandoff();
    return openBrowserAsync(url);
}
