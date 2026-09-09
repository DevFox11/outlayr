import { Task } from "panelui-native";
import type { TaskStatus } from "panelui-native";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { useCsvImportContext } from "@/contexts/csv-import-context";
import type { UnavailableReason } from "@/domain/import-flow";
import type { CsvImportStage } from "@/hooks/use-csv-import";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import type { TranslationKey } from "@/i18n/catalog";
import { useTranslation } from "@/i18n/context";
import { importDraftStore, useImportDraft } from "@/lib/import-draft-store";
import { useColors } from "@/theme/use-colors";

import { StepCta } from "../step-cta";

const REASON_COPY = {
    invalidResponse: "import.unavailableInvalidResponse",
    notConfigured: "import.unavailableNotConfigured",
    notEntitled: "import.unavailableNotEntitled",
    offline: "import.unavailableOffline",
    overCap: "import.unavailableOverCap",
    providerError: "import.unavailableProviderError",
    rateLimited: "import.unavailableRateLimited",
    timeout: "import.unavailableTimeout",
    unauthenticated: "import.unavailableUnauthenticated",
} satisfies Record<UnavailableReason, TranslationKey>;

const NO_RETRY_REASONS: ReadonlySet<UnavailableReason> = new Set(["overCap", "notConfigured", "notEntitled"]);

function StageTask({ children, label, status }: { children: React.ReactNode; label: string; status: TaskStatus }) {
    const colors = useColors();
    return (
        <Task className="border-border gap-1.5 border-b py-2.5" status={status}>
            <Task.Trigger
                icon={status === "running" ? <ActivityIndicator color={colors.foreground} size="small" /> : undefined}
                title={label}
            />
            <Task.Content>{children}</Task.Content>
        </Task>
    );
}

export function matchedStatus(stage: CsvImportStage): TaskStatus {
    return stage === "idle" || stage === "matching" ? "running" : "complete";
}

/**
 * Stays `pending` after a settled run that sent nothing: the model was never
 * asked, so a tick would claim work that did not happen.
 */
export function askedStatus(stage: CsvImportStage, tier2Sent: number): TaskStatus {
    if (stage === "asking") {
        return "running";
    }
    if (stage === "settled") {
        return tier2Sent > 0 ? "complete" : "pending";
    }
    return "pending";
}

function StageDetail({ children }: { children: React.ReactNode }) {
    return <Text className="text-footnote text-muted font-mono tabular-nums">{children}</Text>;
}

interface ResolveStepProps {
    onOpenFeatureLab: () => void;
    review: ImportReviewResult;
}

export function ResolveStep({ review, onOpenFeatureLab }: ResolveStepProps) {
    const t = useTranslation();
    const { flow } = useImportDraft();
    const { running, stage, outcome, reason, totalLabels, tier1Matched, tier2Sent, run } = useCsvImportContext();

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
                <View className="border-border gap-2 border-y py-3">
                    <Text className="font-sans-medium text-callout text-foreground">
                        {t("import.unavailableTitle")}
                    </Text>
                    <Text className="text-footnote text-muted">{t(REASON_COPY[reason])}</Text>
                </View>
                {NO_RETRY_REASONS.has(reason) ? null : (
                    <Pressable accessibilityRole="button" onPress={run}>
                        <Text className="font-sans-medium text-body text-tint">{t("import.tryAgain")}</Text>
                    </Pressable>
                )}
            </View>
        );
    }

    if (outcome === "declined") {
        return (
            <View className="flex-1 gap-4 px-5 pt-4">
                <View className="border-border gap-2 border-y py-3">
                    <Text className="font-sans-medium text-callout text-foreground">
                        {t("import.unavailableTitle")}
                    </Text>
                    <Text className="text-footnote text-muted">{t("import.declinedBody")}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={onOpenFeatureLab}>
                    <Text className="font-sans-medium text-body text-tint">{t("import.openFeatureLab")}</Text>
                </Pressable>
            </View>
        );
    }

    const rowCount = flow.parsed?.rows.length ?? 0;
    const showCta = outcome === "applied" && entryCount > 0;
    const settledStage: CsvImportStage = outcome == null ? stage : "settled";

    return (
        <View className="flex-1 gap-4 px-5 pt-2">
            <View>
                <StageTask label={t("import.resolveRunningReadFile")} status="complete">
                    <Task.Item>
                        {flow.file == null ? null : <Task.File className="bg-transparent">{flow.file.name}</Task.File>}
                        <StageDetail>{t("import.resolveDetailRows", { count: rowCount })}</StageDetail>
                    </Task.Item>
                </StageTask>
                <StageTask label={t("import.resolveRunningMatched")} status={matchedStatus(settledStage)}>
                    <Task.Item>
                        <StageDetail>
                            {t("import.resolveDetailMatched", {
                                matched: tier1Matched,
                                total: totalLabels,
                            })}
                        </StageDetail>
                    </Task.Item>
                </StageTask>
                <StageTask label={t("import.resolveRunningAsked")} status={askedStatus(settledStage, tier2Sent)}>
                    <Task.Item>
                        <StageDetail>
                            {tier2Sent > 0
                                ? t("import.resolveDetailSent", { count: tier2Sent })
                                : t("import.resolveDetailNothingSent")}
                        </StageDetail>
                    </Task.Item>
                </StageTask>
            </View>
            <Text className="text-footnote text-muted leading-snug">{t("import.resolveFootnote")}</Text>

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
