import { BlurMask, Canvas, Group, LinearGradient, Rect, vec } from "@shopify/react-native-skia";
import { useEffect } from "react";
import {
    cancelAnimation,
    Easing,
    useDerivedValue,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

import { withAlpha } from "@/theme/shade";

/** One pass down the receipt and back: the tempo of a flatbed, not a strobe. */
const SWEEP_MS = 1500;
/** The lit band's share of the photo's height. */
const BAND_RATIO = 0.26;
const LINE_HEIGHT = 1.5;
/** How far the band sits in the tint; the photo underneath stays legible. */
const BAND_ALPHA = 0.42;
const LINE_ALPHA = 0.95;
const GLOW_RADIUS = 6;

interface ScanSweepProps {
    /** The tint the band and the line are drawn in. */
    color: string;
    height: number;
    width: number;
}

/**
 * The reading pass drawn over the photo while the receipt is with the model:
 * a soft tinted band with a crisp lit line at its centre, sweeping top to
 * bottom and back on the UI thread. Sits absolutely over the photo it sizes
 * to; the parent clips it to the photo's corners.
 *
 * Reduced motion holds the band still at a third of the way down — lit, so
 * the screen still says "reading", without the travel.
 */
export function ScanSweep({ color, height, width }: ScanSweepProps) {
    const reducedMotion = useReducedMotion();
    const progress = useSharedValue(reducedMotion ? 0.33 : 0);
    const bandHeight = Math.max(24, height * BAND_RATIO);
    const travel = Math.max(0, height - bandHeight);

    useEffect(() => {
        if (reducedMotion) {
            progress.set(0.33);
            return;
        }
        progress.set(withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.sin) }), -1, true));
        return () => {
            cancelAnimation(progress);
        };
    }, [progress, reducedMotion]);

    const transform = useDerivedValue(() => [{ translateY: progress.get() * travel }]);
    const lineY = (bandHeight - LINE_HEIGHT) / 2;

    return (
        <Canvas pointerEvents="none" style={{ height, position: "absolute", width }}>
            <Group transform={transform}>
                <Rect height={bandHeight} width={width} x={0} y={0}>
                    <LinearGradient
                        colors={[withAlpha(color, 0), withAlpha(color, BAND_ALPHA), withAlpha(color, 0)]}
                        end={vec(0, bandHeight)}
                        positions={[0, 0.5, 1]}
                        start={vec(0, 0)}
                    />
                </Rect>
                <Rect color={withAlpha(color, LINE_ALPHA)} height={LINE_HEIGHT} width={width} x={0} y={lineY}>
                    <BlurMask blur={GLOW_RADIUS} style="solid" />
                </Rect>
                <Rect color={withAlpha(color, LINE_ALPHA)} height={LINE_HEIGHT} width={width} x={0} y={lineY} />
            </Group>
        </Canvas>
    );
}
