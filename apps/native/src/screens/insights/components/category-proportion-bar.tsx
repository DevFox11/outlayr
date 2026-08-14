import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useSettingBool } from "@/contexts/display-settings-context";
import type { CategoryBreakdownEntry } from "@/data/insights";
import { useTranslation } from "@/i18n/context";
import { CHART_BAR } from "@/theme/chart";
import { useColors } from "@/theme/use-colors";

const GAP = 3;
/** Track inset, so the rail stays visible behind a bar that is always full. */
const TRACK_PAD = 2;
const HEIGHT = 16;
/** Segments thinner than this share are dropped. */
const MIN_SHARE = 0.005;

interface CategoryProportionBarProps {
    entries: CategoryBreakdownEntry[];
    onSelect: (id: string | null) => void;
    selectedId: string | null;
}

export function CategoryProportionBar({ entries, selectedId, onSelect }: CategoryProportionBarProps) {
    const colors = useColors();
    const t = useTranslation();
    const reduceMotion = useReducedMotion();
    // Read here, not threaded from the screen: every chart answers to this setting
    // itself.
    const animated = useSettingBool("animatedCharts") && !reduceMotion;
    const [width, setWidth] = useState(0);
    const progress = useSharedValue(animated ? 0 : 1);

    const shown = entries.filter((e) => e.fraction >= MIN_SHARE);
    const shownTotal = shown.reduce((sum, e) => sum + e.fraction, 0) || 1;

    useEffect(() => {
        progress.value = animated ? withTiming(1, { duration: 550 }) : 1;
    }, [animated, progress]);

    const revealStyle = useAnimatedStyle(() => ({
        width: width * progress.value,
    }));

    const onLayout = (event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
    };

    if (shown.length === 0) {
        return null;
    }

    const usable = Math.max(0, width - GAP * (shown.length - 1));

    return (
        // Seated in a track rather than floating on the background. The segments
        // always sum to the full width, so a single category is a solid band with
        // no edge to read it against and looks like a status colour; the track
        // inset by `TRACK_PAD` is that edge, and it survives every category count.
        <View
            style={{
                backgroundColor: colors.railTrack,
                borderRadius: CHART_BAR.radius + TRACK_PAD,
                padding: TRACK_PAD,
            }}
        >
            <View onLayout={onLayout} style={{ height: HEIGHT }}>
                <Animated.View style={[{ flexDirection: "row", height: HEIGHT, overflow: "hidden" }, revealStyle]}>
                    <View style={{ flexDirection: "row", gap: GAP, width }}>
                        {shown.map((entry) => {
                            const active = selectedId === entry.id;
                            const dimmed = selectedId != null && !active;
                            return (
                                <Pressable
                                    accessibilityLabel={t("insights.category.share", {
                                        name: entry.name,
                                        percent: Math.round(entry.fraction * 100),
                                    })}
                                    accessibilityRole="button"
                                    key={entry.id}
                                    onPress={() => onSelect(active ? null : entry.id)}
                                    style={{
                                        height: HEIGHT,
                                        width: (usable * entry.fraction) / shownTotal,
                                    }}
                                >
                                    <View
                                        style={{
                                            backgroundColor: entry.color,
                                            borderColor: colors.foreground,
                                            borderRadius: CHART_BAR.radius,
                                            borderWidth: active ? 1.5 : 0,
                                            flex: 1,
                                            opacity: dimmed ? 0.4 : 1,
                                        }}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </View>
    );
}
