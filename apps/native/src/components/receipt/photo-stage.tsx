import { Image } from "expo-image";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { ScanSweep } from "@/components/receipt/scan-sweep";

/** The same give as the orb: the photo settles into place, it does not bounce. */
const STAGE_SPRING = { damping: 20, mass: 0.9, stiffness: 180 };
const STAGE_RADIUS = 20;
const THUMB_RADIUS = 12;
/** A failed read keeps the photo but steps it back, so the message is what reads. */
const DIMMED_OPACITY = 0.55;

export interface StageBox {
    height: number;
    width: number;
}

interface PhotoStageProps {
    /** The frame the photo fills, letterboxed to its own aspect by the caller. */
    box: StageBox;
    /** Steps the photo back behind a failure message. */
    dimmed?: boolean;
    /** Draws the reading pass over the photo. */
    scanning: boolean;
    /** The tint the sweep is drawn in. */
    tint: string;
    uri: string;
}

/**
 * The photo, at whatever size the phase wants it — the subject of the screen
 * while it is read, a thumbnail beside the draft once it has been. The change
 * of size is one spring on width, height and corner radius, so the draft rises
 * into the room the photo gives up rather than snapping under it. Reduced
 * motion crossfades the sizes instead.
 */
export function PhotoStage({ box, dimmed = false, scanning, tint, uri }: PhotoStageProps) {
    const reducedMotion = useReducedMotion();
    const compact = !scanning && box.height < 160;
    const width = useSharedValue(box.width);
    const height = useSharedValue(box.height);
    const radius = useSharedValue(compact ? THUMB_RADIUS : STAGE_RADIUS);
    const opacity = useSharedValue(1);

    useEffect(() => {
        const animate = (target: number) =>
            reducedMotion ? withTiming(target, { duration: 180 }) : withSpring(target, STAGE_SPRING);
        width.set(animate(box.width));
        height.set(animate(box.height));
        radius.set(animate(compact ? THUMB_RADIUS : STAGE_RADIUS));
    }, [box.height, box.width, compact, height, radius, reducedMotion, width]);

    useEffect(() => {
        opacity.set(withTiming(dimmed ? DIMMED_OPACITY : 1, { duration: 220 }));
    }, [dimmed, opacity]);

    const frame = useAnimatedStyle(() => ({
        borderRadius: radius.get(),
        height: height.get(),
        opacity: opacity.get(),
        width: width.get(),
    }));

    return (
        <Animated.View
            className="bg-surface overflow-hidden"
            entering={FadeIn.duration(260)}
            style={[frame, { borderCurve: "continuous" }]}
        >
            <Image
                contentFit="cover"
                source={{ uri }}
                style={{ height: "100%", width: "100%" }}
                transition={reducedMotion ? 0 : 200}
            />
            {scanning ? (
                <View pointerEvents="none" style={{ height: box.height, position: "absolute", width: box.width }}>
                    <ScanSweep color={tint} height={box.height} width={box.width} />
                </View>
            ) : null}
        </Animated.View>
    );
}
