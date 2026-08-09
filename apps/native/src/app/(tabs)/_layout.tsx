import { NativeTabs } from "expo-router/unstable-native-tabs";

import budgetsIcon from "@/assets/tab-icons/budgets.png";
import budgetsSelectedIcon from "@/assets/tab-icons/budgets-selected.png";
import insightsIcon from "@/assets/tab-icons/insights.png";
import insightsSelectedIcon from "@/assets/tab-icons/insights-selected.png";
import logIcon from "@/assets/tab-icons/log.png";
import logSelectedIcon from "@/assets/tab-icons/log-selected.png";
import settingsIcon from "@/assets/tab-icons/settings.png";
import settingsSelectedIcon from "@/assets/tab-icons/settings-selected.png";
import { useDatabase } from "@/contexts/local-data-context";
import { useOverBudgetCount } from "@/data/budgets";
import { useNow } from "@/data/use-now";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

// The ink tint barely distinguishes the selected label on its own, so the weight
// has to carry it.
const LABEL_STYLE = {
	default: { fontFamily: "SFProRounded-Regular" },
	selected: { fontFamily: "SFProRounded-Semibold" },
};

export default function TabLayout() {
	const { accent } = useColors();
	const t = useTranslation();
	const db = useDatabase();
	const nowMs = useNow();
	const overBudget = useOverBudgetCount(db, nowMs);

	return (
		<NativeTabs labelStyle={LABEL_STYLE} tintColor={accent}>
			<NativeTabs.Trigger name="(transactions)">
				<NativeTabs.Trigger.Icon renderingMode="template" src={{ default: logIcon, selected: logSelectedIcon }} />
				<NativeTabs.Trigger.Label>{t("nav.tab.log")}</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="insights">
				<NativeTabs.Trigger.Icon
					renderingMode="template"
					src={{ default: insightsIcon, selected: insightsSelectedIcon }}
				/>
				<NativeTabs.Trigger.Label>{t("nav.tab.insights")}</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="budgets">
				<NativeTabs.Trigger.Icon
					renderingMode="template"
					src={{ default: budgetsIcon, selected: budgetsSelectedIcon }}
				/>
				<NativeTabs.Trigger.Label>{t("nav.tab.budgets")}</NativeTabs.Trigger.Label>

				{overBudget > 0 ? <NativeTabs.Trigger.Badge>{String(overBudget)}</NativeTabs.Trigger.Badge> : null}
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="settings">
				<NativeTabs.Trigger.Icon
					renderingMode="template"
					src={{ default: settingsIcon, selected: settingsSelectedIcon }}
				/>
				<NativeTabs.Trigger.Label>{t("nav.tab.settings")}</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
