import { View } from "react-native";
import { formatDayHeader } from "@/domain/dates";
import type { DaySection } from "@/domain/day-sections";
import { DayTotal } from "./amount-text";
import { MonoLabel } from "./mono-label";

interface DaySectionHeaderProps {
	section: DaySection<unknown>;
	showCents: boolean;
	/**
	 * The top inset is the gap between one day group and the next — the previous
	 * group's 18pt trailing padding plus this header's own 10pt. The first group
	 * has no predecessor, so it gets only the 10.
	 */
	first?: boolean;
}

export function DaySectionHeader({
	section,
	showCents,
	first = false,
}: DaySectionHeaderProps) {
	return (
		<View className={first ? "gap-1.25 pt-2.5" : "gap-1.25 pt-7"}>
			<View className="flex-row items-baseline justify-between gap-2">
				<MonoLabel>{formatDayHeader(section.day)}</MonoLabel>
				<DayTotal totals={section.totals} showCents={showCents} />
			</View>
			{/* A 1.3 stroke with round caps, not a 1px border. */}
			<View className="bg-border" style={{ height: 1.3, borderRadius: 0.65 }} />
		</View>
	);
}
