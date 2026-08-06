import { HugeiconsIcon } from "@hugeicons/react-native";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "@/components/text";
import { useCsvImportContext } from "@/contexts/csv-import-context";
import type { UnavailableReason } from "@/domain/import-flow";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { type TranslationKey, useTranslation } from "@/i18n";
import { importDraftStore, useImportDraft } from "@/lib/import-draft-store";
import { useColors } from "@/theme/use-colors";
import { EyebrowRow } from "../eyebrow-row";
import { StepCta } from "../step-cta";

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
		<View className="flex-row items-center gap-3 border-border border-b py-2.5">
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
				<Text className="font-mono text-footnote text-muted tabular-nums">
					{trailing}
				</Text>
			)}
		</View>
	);
}

interface ResolveStepProps {
	review: ImportReviewResult;
	onOpenFeatureLab: () => void;
}

export function ResolveStep({ review, onOpenFeatureLab }: ResolveStepProps) {
	const t = useTranslation();
	const { flow } = useImportDraft();
	const {
		running,
		outcome,
		reason,
		totalLabels,
		tier1Matched,
		tier2Sent,
		run,
	} = useCsvImportContext();

	useEffect(() => {
		if (!running && outcome == null) {
			run();
		}
	}, [running, outcome, run]);

	const entryCount = review.plan.entries.length;
	const advancedRef = useRef(false);
	useEffect(() => {
		if (outcome === "applied" && entryCount > 0 && !advancedRef.current) {
			advancedRef.current = true;
			importDraftStore.setStep("review");
		}
	}, [outcome, entryCount]);

	if (outcome === "unavailable" && reason != null) {
		return (
			<View className="flex-1 gap-4 px-5 pt-4">
				<View className="gap-2 border-border border-y py-3">
					<Text className="font-sans-medium text-callout text-foreground">
						{t("import.unavailableTitle")}
					</Text>
					<Text className="text-footnote text-muted">
						{t(REASON_COPY[reason])}
					</Text>
				</View>
				{NO_RETRY_REASONS.has(reason) ? null : (
					<Pressable accessibilityRole="button" onPress={run}>
						<Text className="font-sans-medium text-body text-tint">
							{t("import.tryAgain")}
						</Text>
					</Pressable>
				)}
			</View>
		);
	}

	if (outcome === "declined") {
		return (
			<View className="flex-1 gap-4 px-5 pt-4">
				<View className="gap-2 border-border border-y py-3">
					<Text className="font-sans-medium text-callout text-foreground">
						{t("import.unavailableTitle")}
					</Text>
					<Text className="text-footnote text-muted">
						{t("import.declinedBody")}
					</Text>
				</View>
				<Pressable accessibilityRole="button" onPress={onOpenFeatureLab}>
					<Text className="font-sans-medium text-body text-tint">
						{t("import.openFeatureLab")}
					</Text>
				</Pressable>
			</View>
		);
	}

	const started = running || outcome === "applied";
	const rowCount = flow.parsed?.rows.length ?? 0;
	const showCta = outcome === "applied" && entryCount > 0;

	return (
		<View className="flex-1 gap-4 px-5 pt-2">
			{flow.file == null ? null : (
				<EyebrowRow
					label={flow.file.name}
					value={t("import.resolveEyebrowRows", { count: rowCount })}
				/>
			)}
			<View>
				<ResolveRow done={started} label={t("import.resolveRunningReadFile")} />
				<ResolveRow
					done={started}
					label={t("import.resolveRunningMatched")}
					trailing={started ? `${tier1Matched} / ${totalLabels}` : undefined}
				/>
				<ResolveRow
					done={outcome === "applied"}
					label={t("import.resolveRunningAsked")}
					trailing={tier2Sent > 0 ? `${tier2Sent} / ${tier2Sent}` : undefined}
				/>
			</View>
			<Text className="text-footnote text-muted leading-snug">
				{t("import.resolveFootnote")}
			</Text>

			{showCta ? (
				<StepCta
					className="mt-6"
					label={t("import.resolveReviewCta", { count: entryCount })}
					onPress={() => importDraftStore.setStep("review")}
				/>
			) : null}
		</View>
	);
}
