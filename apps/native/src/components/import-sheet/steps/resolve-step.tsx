import { HugeiconsIcon } from "@hugeicons/react-native";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "@/components/text";
import { useCsvImportContext } from "@/contexts/csv-import-context";
import type { UnavailableReason } from "@/domain/import-flow";
import { type TranslationKey, useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

const REASON_COPY: Record<UnavailableReason, TranslationKey> = {
	offline: "import.unavailableOffline",
	timeout: "import.unavailableTimeout",
	rateLimited: "import.unavailableRateLimited",
	providerError: "import.unavailableProviderError",
	notConfigured: "import.unavailableNotConfigured",
	invalidResponse: "import.unavailableInvalidResponse",
	overCap: "import.unavailableOverCap",
	unauthenticated: "import.unavailableUnauthenticated",
};

const NO_RETRY_REASONS: ReadonlySet<UnavailableReason> = new Set([
	"overCap",
	"notConfigured",
]);

function ResolveRow({
	done,
	label,
	trailing,
}: {
	done: boolean;
	label: string;
	trailing?: string;
}) {
	const colors = useColors();
	return (
		<View className="flex-row items-center gap-3 border-border border-b py-2">
			{done ? (
				<HugeiconsIcon
					color={colors.income}
					icon={Tick02Icon}
					size={18}
					strokeWidth={2}
				/>
			) : (
				<ActivityIndicator color={colors.foreground} size="small" />
			)}
			<Text className="flex-1 text-body text-foreground">{label}</Text>
			{trailing == null ? null : (
				<Text className="text-footnote text-muted tabular-nums">
					{trailing}
				</Text>
			)}
		</View>
	);
}

export function ResolveStep() {
	const t = useTranslation();
	const router = useRouter();
	const {
		running,
		outcome,
		reason,
		totalLabels,
		tier1Matched,
		tier2Sent,
		run,
	} = useCsvImportContext();

	if (outcome === "unavailable" && reason != null) {
		return (
			<View className="gap-4 pt-6">
				<View className="gap-2 rounded-xl border border-border p-4">
					<Text className="font-sans-medium text-callout text-foreground">
						{t("import.unavailableTitle")}
					</Text>
					<Text className="text-footnote text-muted">
						{t(REASON_COPY[reason])}
					</Text>
				</View>
				<View className="flex-row gap-5">
					{NO_RETRY_REASONS.has(reason) ? null : (
						<Pressable accessibilityRole="button" onPress={run}>
							<Text className="font-sans-medium text-body text-tint">
								{t("import.tryAgain")}
							</Text>
						</Pressable>
					)}
					<Pressable
						accessibilityRole="button"
						onPress={() => {
							router.push("/settings/import");
							router.dismissAll();
						}}
					>
						<Text className="font-sans-medium text-body text-foreground underline">
							{t("import.mapManually")}
						</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	if (outcome === "declined") {
		return (
			<View className="gap-4 pt-6">
				<View className="gap-2 rounded-xl border border-border p-4">
					<Text className="font-sans-medium text-callout text-foreground">
						{t("import.unavailableTitle")}
					</Text>
					<Text className="text-footnote text-muted">
						{t("import.declinedBody")}
					</Text>
				</View>
				<Pressable
					accessibilityRole="button"
					onPress={() => router.push("/settings/feature-lab")}
				>
					<Text className="font-sans-medium text-body text-tint">
						{t("import.openFeatureLab")}
					</Text>
				</Pressable>
			</View>
		);
	}

	if (running || outcome === "applied") {
		return (
			<View className="gap-1 pt-6">
				<ResolveRow done label={t("import.resolveRunningReadFile")} />
				<ResolveRow
					done
					label={t("import.resolveRunningMatched")}
					trailing={`${tier1Matched} of ${totalLabels}`}
				/>
				<ResolveRow
					done={!running}
					label={t("import.resolveRunningAsked")}
					trailing={tier2Sent > 0 ? `${tier2Sent} of ${tier2Sent}` : undefined}
				/>
			</View>
		);
	}

	return (
		<View className="gap-4 pt-6">
			<View className="gap-2 rounded-xl bg-surface p-4">
				<Text className="font-sans-medium text-callout text-foreground">
					{t("import.resolveConsentHeading")}
				</Text>
				<Text
					className="text-footnote text-muted leading-snug"
					testID="import-resolve-consent-bullet"
				>
					{t("import.resolveConsentBulletLabels")}
				</Text>
				<Text
					className="text-footnote text-muted leading-snug"
					testID="import-resolve-consent-bullet"
				>
					{t("import.resolveConsentBulletCategories")}
				</Text>
				<Text
					className="text-footnote text-muted leading-snug"
					testID="import-resolve-consent-bullet"
				>
					{t("import.resolveConsentBulletNever")}
				</Text>
			</View>
		</View>
	);
}
