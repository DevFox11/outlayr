import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useDatabase } from "@/contexts/local-data-context";
import type { CategoryBreakdownEntry } from "@/data/insights";
import { useBoolSetting } from "@/data/settings";
import { CHART_BAR } from "@/theme/chart";
import { useColors } from "@/theme/use-colors";

const GAP = 3;
const HEIGHT = 16;
/** Segments thinner than this share are dropped. */
const MIN_SHARE = 0.005;

interface CategoryProportionBarProps {
	entries: CategoryBreakdownEntry[];
	selectedId: string | null;
	onSelect: (id: string | null) => void;
}

export function CategoryProportionBar({
	entries,
	selectedId,
	onSelect,
}: CategoryProportionBarProps) {
	const colors = useColors();
	const db = useDatabase();
	// Read here, not threaded from the screen: every chart answers to this setting
	// itself.
	const animated = useBoolSetting(db, "animatedCharts");
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
		<View onLayout={onLayout} style={{ height: HEIGHT }}>
			<Animated.View
				style={[
					{ height: HEIGHT, flexDirection: "row", overflow: "hidden" },
					revealStyle,
				]}
			>
				<View style={{ width, flexDirection: "row", gap: GAP }}>
					{shown.map((entry) => {
						const active = selectedId === entry.id;
						const dimmed = selectedId != null && !active;
						return (
							<Pressable
								key={entry.id}
								onPress={() => onSelect(active ? null : entry.id)}
								accessibilityRole="button"
								accessibilityLabel={`${entry.name} ${Math.round(
									entry.fraction * 100,
								)} percent`}
								style={{
									width: (usable * entry.fraction) / shownTotal,
									height: HEIGHT,
								}}
							>
								<View
									style={{
										flex: 1,
										borderRadius: CHART_BAR.radius,
										backgroundColor: entry.color,
										opacity: dimmed ? 0.4 : 1,
										borderWidth: active ? 1.5 : 0,
										borderColor: colors.foreground,
									}}
								/>
							</Pressable>
						);
					})}
				</View>
			</Animated.View>
		</View>
	);
}
