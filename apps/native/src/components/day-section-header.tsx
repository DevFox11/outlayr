import { Pressable, View } from "react-native";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { formatDayHeader } from "@/domain/dates";
import type { DaySection } from "@/domain/day-sections";
import { useLanguage } from "@/i18n/context";
import { DayTotal } from "./amount-text";
import { MonoLabel } from "./mono-label";

interface DaySectionHeaderProps {
	/**
	 * The top inset is the gap between one day group and the next — the previous
	 * group's 18pt trailing padding plus this header's own 10pt. The first group
	 * has no predecessor, so it gets only the 10.
	 */
	first?: boolean;
	/** Opens the day group's actions. Omit on a surface that offers none. */
	onLongPress?: () => void;
	section: DaySection<unknown>;
}

export function DaySectionHeader({ section, first = false, onLongPress }: DaySectionHeaderProps) {
	const { showCents } = useDisplaySettings().state;
	// Consuming the language here is what re-renders this header when it changes;
	// `formatDayHeader`'s `runtimeLanguage()` default is invisible to React.
	const { language } = useLanguage();
	const body = (
		<>
			<View className="flex-row items-baseline justify-between gap-2">
				<MonoLabel>{formatDayHeader(section.day, undefined, language)}</MonoLabel>
				<DayTotal showCents={showCents} totals={section.totals} />
			</View>
			{/* A 1.3 stroke with round caps, not a 1px border. */}
			<View className="bg-border" style={{ borderRadius: 0.65, height: 1.3 }} />
		</>
	);
	const className = first ? "gap-1.25 pt-2.5" : "gap-1.25 pt-7";

	if (!onLongPress) {
		return <View className={className}>{body}</View>;
	}

	return (
		<Pressable accessibilityRole="button" className={className} onLongPress={onLongPress}>
			{body}
		</Pressable>
	);
}
