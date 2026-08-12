import { Pressable, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import type { AccountsOverview } from "@/domain/account-display";
import { formatSignedAmount } from "@/domain/account-display";
import { useLanguage, useTranslation } from "@/i18n/context";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

interface AccountsOverviewCardProps {
	/** The display currency the total is valued in. */
	currency: string;
	onPress: () => void;
	/** Null hides the card entirely — no accounts, no ghost row. */
	overview: AccountsOverview | null;
	showCents: boolean;
}

export function AccountsOverviewCard({ overview, currency, showCents, onPress }: AccountsOverviewCardProps) {
	const t = useTranslation();
	const { language } = useLanguage();
	if (overview == null) {
		return null;
	}
	return (
		<Pressable
			accessibilityRole="button"
			className="pb-4.5 active:opacity-70"
			onPress={onPress}
			testID="accounts-overview-card"
		>
			<View className="gap-1.25 pt-2.5">
				<View className="flex-row items-baseline justify-between gap-2">
					<MonoLabel>{`${t("accounts.overview.heading")} · ${overview.count}`}</MonoLabel>
					<View className="flex-row items-baseline gap-1.5">
						{overview.exact ? null : <MonoLabel className="text-subtle">{`${currency}?`}</MonoLabel>}
						<Text className="font-sans-semibold text-body text-muted" numberOfLines={1} style={TABULAR}>
							{formatSignedAmount(overview.total, currency, showCents, language)}
						</Text>
					</View>
				</View>
				<View className="bg-border" style={{ borderRadius: 0.65, height: 1.3 }} />
			</View>
		</Pressable>
	);
}
