import { HugeiconsIcon } from "@hugeicons/react-native";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { useDatabase } from "@/contexts/local-data-context";
import {
	ordinalDay,
	setNumberSetting,
	useNumberSetting,
} from "@/data/settings";
import type { Database } from "@/db/client";
import { useColors } from "@/theme/use-colors";

const WEEKDAY_OPTIONS: readonly { label: string; value: number }[] = [
	{ label: "Sunday", value: 1 },
	{ label: "Monday", value: 2 },
];

const MONTH_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

export default function TimeFramesScreen() {
	const db = useDatabase();
	return <TimeFrames db={db} />;
}

function TimeFrames({ db }: { db: Database }) {
	const firstWeekday = useNumberSetting(db, "firstWeekday");
	const firstDayOfMonth = useNumberSetting(db, "firstDayOfMonth");

	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerClassName="px-5 pt-3 pb-safe-offset-10"
		>
			<View className="pb-1">
				<MonoLabel>START OF WEEK</MonoLabel>
			</View>
			<View className="border-border border-t">
				{WEEKDAY_OPTIONS.map((option) => (
					<ChoiceRow
						key={option.value}
						label={option.label}
						selected={firstWeekday === option.value}
						onPress={() => {
							setNumberSetting(db, "firstWeekday", option.value);
						}}
					/>
				))}
			</View>

			<View className="pt-7 pb-1">
				<MonoLabel>START OF MONTH</MonoLabel>
			</View>
			<View className="border-border border-t">
				{MONTH_DAYS.map((day) => (
					<ChoiceRow
						key={day}
						label={`${ordinalDay(day)} of month`}
						selected={firstDayOfMonth === day}
						onPress={() => {
							setNumberSetting(db, "firstDayOfMonth", day);
						}}
					/>
				))}
			</View>
			<Text className="pt-2 text-footnote text-muted">
				Close and reopen the app for the month start to take full effect.
			</Text>
		</ScrollView>
	);
}

function ChoiceRow({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	const colors = useColors();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			className="flex-row items-center border-border border-b py-3.5 active:opacity-60"
		>
			<Text className="flex-1 text-body text-foreground">{label}</Text>
			{selected ? (
				<HugeiconsIcon
					icon={Tick02Icon}
					size={20}
					color={colors.tint}
					strokeWidth={2.4}
				/>
			) : null}
		</Pressable>
	);
}
