import { useEffect, useRef } from "react";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";

import { CHART_DRAW } from "@/theme/chart";

/** 0 → 1 once, on first mount, when charts animate; already 1 otherwise. */
export function useChartDraw(animated: boolean) {
    const draw = useSharedValue(animated ? 0 : 1);
    const drawn = useRef(false);

    useEffect(() => {
        if (!animated) {
            draw.set(1);
            return;
        }
        if (drawn.current) {
            return;
        }
        drawn.current = true;
        draw.set(withTiming(1, { duration: CHART_DRAW.durationMs, easing: Easing.out(Easing.cubic) }));
    }, [animated, draw]);

    return draw;
}
