import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useDatabase } from "@/contexts/local-data-context";
import {
	HAPTICS_OPTIONS,
	setNumberSetting,
	useNumberSetting,
} from "@/data/settings";
import type { Database } from "@/db/client";

const DETAIL: Record<number, string> = {
	0: "No taps at all.",
	1: "A light tap when something lands.",
	2: "A tap for every action.",
};

export default function HapticsRoute() {
	const db = useDatabase();
	return <Haptics db={db} />;
}

function Haptics({ db }: { db: Database }) {
	const haptics = useNumberSetting(db, "haptics");

	return (
		<SettingsScreen>
			<SettingsSection title="Feedback">
				{HAPTICS_OPTIONS.map((option) => (
					<ChoiceRow
						detail={DETAIL[option.value]}
						key={option.value}
						label={option.label}
						onPress={() => {
							setNumberSetting(db, "haptics", option.value);
						}}
						selected={haptics === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
