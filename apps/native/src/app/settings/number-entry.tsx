import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useDatabase } from "@/contexts/local-data-context";
import { setNumberSetting, useNumberSetting } from "@/data/settings";
import type { Database } from "@/db/client";

const ENTRY_OPTIONS: readonly {
	label: string;
	detail: string;
	value: number;
}[] = [
	{
		label: "Type 1 · Pre-dotted",
		detail: "The last two digits are cents. Type 1234 to get 12.34.",
		value: 1,
	},
	{
		label: "Type 2 · Cent-less",
		detail: "Whole amounts only. Type 12 to get 12.",
		value: 2,
	},
];

export default function NumberEntryRoute() {
	const db = useDatabase();
	return <NumberEntry db={db} />;
}

function NumberEntry({ db }: { db: Database }) {
	const numberEntryType = useNumberSetting(db, "numberEntryType");

	return (
		<SettingsScreen>
			<SettingsSection title="Amount keypad">
				{ENTRY_OPTIONS.map((option) => (
					<ChoiceRow
						detail={option.detail}
						key={option.value}
						label={option.label}
						onPress={() => {
							setNumberSetting(db, "numberEntryType", option.value);
						}}
						selected={numberEntryType === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
