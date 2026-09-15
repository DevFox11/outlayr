import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { panGesture } from "@/lib/gestures";

/**
 * The scrub both insights charts use: report a bucket while the finger moves,
 * clear on lift, and commit whatever it landed on. `report` is the worklet that
 * turns an x into a bucket index, which is all the two charts differ by.
 */
export function scrubGesture({
    commit,
    onScrub,
    report,
    reported,
    setScrubIndex,
}: {
    commit: (index: number) => void;
    onScrub: (index: number | null) => void;
    report: (x: number) => void;
    reported: SharedValue<number>;
    setScrubIndex: (index: number | null) => void;
}) {
    return panGesture()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
            "worklet";
            report(event.x);
        })
        .onChange((event) => {
            "worklet";
            report(event.x);
        })
        .onFinalize(() => {
            "worklet";
            const landed = reported.get();
            reported.set(-1);
            scheduleOnRN(setScrubIndex, null);
            scheduleOnRN(onScrub, null);
            if (landed >= 0) {
                scheduleOnRN(commit, landed);
            }
        });
}
