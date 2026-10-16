import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPendingResultAsync } from "expo-image-picker";

import { duringHandoff } from "@/lib/app-handoff";
import type { launchPick as iosLaunchPick, pendingPick as iosPendingPick } from "@/lib/pending-pick";

/**
 * Who launched the last pick and when, as `<owner>@<epoch ms>`. Kept on disk,
 * since Android can kill the whole process while the camera is up.
 */
const PICK_MARK_KEY = "outlayr.pending-pick";

/**
 * How long after the launch a recovered photo is still adopted. Long enough
 * for the app to restart under the camera; short enough that a pick the user
 * gave up on isn't read, and doesn't spend a scan, on some later visit.
 */
const PENDING_PICK_WINDOW_MS = 10 * 60 * 1000;

export const launchPick: typeof iosLaunchPick = async (owner, launch) => {
    await AsyncStorage.setItem(PICK_MARK_KEY, `${owner}@${Date.now()}`);
    try {
        return await duringHandoff(launch);
    } finally {
        // The launch came back, so nothing is left to recover. A mark that
        // outlives a failed removal still recovers nothing.
        await AsyncStorage.removeItem(PICK_MARK_KEY).catch(() => undefined);
    }
};

/**
 * Android can destroy the activity while the camera or the library is up. The
 * launch then never resolves, and the picker module holds the result until it
 * is asked for, once. Only the screen that launched the pick may take it: for
 * any other the result stays put. A result from an old launch, or an error,
 * is taken and dropped.
 */
export const pendingPick: typeof iosPendingPick = async (owner) => {
    const mark = await AsyncStorage.getItem(PICK_MARK_KEY);
    const [markedOwner, launchedAt] = mark?.split("@") ?? [];
    if (markedOwner !== owner) {
        return null;
    }
    const result = await getPendingResultAsync();
    if (result === null) {
        return null;
    }
    await AsyncStorage.removeItem(PICK_MARK_KEY);
    const recent = Date.now() - Number(launchedAt) <= PENDING_PICK_WINDOW_MS;
    return recent && "canceled" in result ? result : null;
};
