import { useRouter } from "expo-router";
import { useState } from "react";
import { FirstRun } from "@/components/first-run";
import { ToggleRow } from "@/components/settings/settings-row";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { setBoolSetting } from "@/data/settings";
import type { Database } from "@/db/client";
import { useTranslation } from "@/i18n";

export function OnboardingGrounding() {
	const db = useDatabase();
	return <OnboardingGroundingContent db={db} />;
}

function OnboardingGroundingContent({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const { state: settings } = useAppSettings();
	const [enabled, setEnabled] = useState(() => settings.bool("groundedLookup"));

	const confirm = () => {
		setBoolSetting(db, "groundedLookup", enabled)
			.then(() => router.push("/onboarding/rhythm"))
			.catch((error: unknown) => {
				console.error("Saving the grounded-lookup choice failed", error);
				router.push("/onboarding/rhythm");
			});
	};

	return (
		<FirstRun
			action={{ label: t("common.continue"), onPress: confirm }}
			body={t("onboarding.grounding.body")}
			eyebrow={t("onboarding.grounding.eyebrow")}
			title={t("onboarding.grounding.title")}
		>
			<ToggleRow
				icon="Sparkles"
				onValueChange={setEnabled}
				title={t("onboarding.grounding.toggle")}
				value={enabled}
			/>
		</FirstRun>
	);
}
