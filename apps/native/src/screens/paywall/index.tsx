import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { Button, RadioGroup } from "panelui-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useRevenueCat } from "@/contexts/revenuecat-context";
import type { RevenueCatValue } from "@/contexts/revenuecat-context";
import { APP_ICONS } from "@/domain/app-icons";
import { FREE_ACCOUNTS, FREE_BUDGETS, FREE_CURRENCIES } from "@/domain/pro-limits";
import { readPlans } from "@/domain/pro-plans";
import type { Plan, PlanKind } from "@/domain/pro-plans";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { proSellable } from "@/hooks/use-pro-locked";
import type { TranslationKey } from "@/i18n/catalog";
import { useTranslation } from "@/i18n/context";
import type { TranslateFn } from "@/i18n/context";
import { useAuthSession } from "@/lib/auth-session";
import { useColors } from "@/theme/use-colors";

const UNLIMITED = "\u221E";

const TERMS_URL = "https://tryoutlayr.com/terms";
const PRIVACY_URL = "https://tryoutlayr.com/privacy";

function Row({ label, free, pro }: { free: string; label: string; pro: string }) {
    return (
        <View className="border-border flex-row items-center border-b py-2.5">
            <Text className="text-foreground text-subtitle flex-1">{label}</Text>
            <Text className="text-muted text-footnote w-[74px] text-right font-mono tabular-nums">{free}</Text>
            <Text className="text-income text-footnote w-[74px] text-right font-mono tabular-nums">{pro}</Text>
        </View>
    );
}

function LegalDot() {
    return <Text className="text-muted text-micro">·</Text>;
}

function Comparison() {
    const t = useTranslation();
    return (
        <View className="pt-4">
            <View className="flex-row items-baseline pb-1.5">
                <View className="flex-1" />
                <MonoLabel className="w-[74px] text-right">{t("pro.col.free")}</MonoLabel>
                <MonoLabel className="text-foreground w-[74px] text-right">{t("pro.col.pro")}</MonoLabel>
            </View>
            <View className="border-foreground border-t">
                <Row free="20" label={t("pro.row.captures")} pro="500" />
                <Row free={String(FREE_ACCOUNTS)} label={t("pro.row.accounts")} pro={UNLIMITED} />
                <Row free={String(FREE_BUDGETS)} label={t("pro.row.budgets")} pro={UNLIMITED} />
                <Row free={String(FREE_CURRENCIES)} label={t("pro.row.currencies")} pro={UNLIMITED} />
                <Row free={t("pro.value.off")} label={t("pro.row.devices")} pro={t("pro.value.on")} />
                <Row free={t("pro.value.off")} label={t("pro.row.photos")} pro={t("pro.value.on")} />
                <Row free={t("pro.value.off")} label={t("pro.row.import")} pro={t("pro.value.on")} />
                <Row free={t("pro.value.off")} label={t("pro.row.lookup")} pro={t("pro.value.web")} />
                <Row free="1" label={t("pro.row.icons")} pro={String(APP_ICONS.length)} />
            </View>
        </View>
    );
}

function unitOf(plan: Plan, t: TranslateFn): string | null {
    if (plan.kind === "lifetime") {
        return t("pro.plan.once");
    }
    if (plan.kind === "monthly") {
        return t("pro.plan.perMonthBare");
    }
    return plan.perMonth === null ? null : t("pro.plan.perMonth", { price: plan.perMonth });
}

function noteOf(plan: Plan, t: TranslateFn): string | null {
    const parts = [
        plan.trialDays === null ? null : t("pro.plan.trial", { days: plan.trialDays }),
        plan.savingsPercent === null ? null : t("pro.plan.save", { percent: plan.savingsPercent }),
    ].filter((part): part is string => part !== null);
    return parts.length === 0 ? null : parts.join(" · ");
}

function ctaLabel(plan: Plan | null, t: TranslateFn): string {
    if (plan === null || plan.trialDays === null) {
        return t("pro.cta.continue");
    }
    return t("pro.cta.start", { days: plan.trialDays });
}

function PlanCard({ plan, selected }: { plan: Plan; selected: boolean }) {
    const t = useTranslation();
    const ink = selected ? "text-accent-foreground" : "text-foreground";
    const quiet = selected ? "text-accent-foreground/70" : "text-muted";
    const note = noteOf(plan, t);
    const unit = unitOf(plan, t);

    return (
        <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
                <Text className={cn("text-callout font-medium", ink)}>{t(`pro.plan.${plan.kind}`)}</Text>
                {note === null ? null : <Text className={cn("text-footnote", quiet)}>{note}</Text>}
            </View>
            <View
                className={cn(
                    "w-[118px] items-end gap-0.5 border-l pl-3",
                    selected ? "border-accent-foreground/25" : "border-border"
                )}
            >
                <Text className={cn("text-body font-mono tabular-nums", ink)}>{plan.priceString}</Text>
                {unit === null ? null : <Text className={cn("text-micro font-mono uppercase", quiet)}>{unit}</Text>}
            </View>
        </View>
    );
}

async function loadPlans(
    getPackages: RevenueCatValue["getPackages"],
    eligibleForTrial: RevenueCatValue["eligibleForTrial"]
): Promise<Plan[]> {
    const packages = await getPackages();
    const eligible = await eligibleForTrial(packages.map((offer) => offer.product.identifier)).catch(
        () => new Set<string>()
    );
    return readPlans(packages, eligible);
}

function PlanPicker({
    plans,
    selected,
    empty,
    onSelect,
    onRetry,
}: {
    empty: boolean;
    onRetry: () => void;
    onSelect: (kind: PlanKind) => void;
    plans: readonly Plan[] | null;
    selected: PlanKind | null;
}) {
    const t = useTranslation();
    const colors = useColors();

    if (empty) {
        return (
            <View className="items-center gap-3 pt-8">
                <Text className="text-muted text-subtitle text-center">{t("pro.unavailable")}</Text>
                <Pressable accessibilityRole="button" onPress={onRetry} testID="paywall-retry">
                    <MonoLabel className="text-foreground">{t("pro.retry")}</MonoLabel>
                </Pressable>
            </View>
        );
    }
    if (plans === null) {
        return (
            <View className="items-center pt-8">
                <ActivityIndicator color={colors.foreground} />
            </View>
        );
    }
    const best = plans.some((plan) => plan.savingsPercent !== null);

    return (
        <>
            {best ? <MonoLabel className="text-income pt-4">{t("pro.plan.bestValue")}</MonoLabel> : null}
            <RadioGroup
                className="pt-1.5"
                onValueChange={(kind) => {
                    const picked = plans.find((plan) => plan.kind === kind);
                    if (picked !== undefined) {
                        onSelect(picked.kind);
                    }
                }}
                value={selected ?? undefined}
                variant="card"
            >
                {plans.map((candidate) => (
                    <RadioGroup.Item hideIndicator key={candidate.kind} value={candidate.kind}>
                        <PlanCard plan={candidate} selected={candidate.kind === selected} />
                    </RadioGroup.Item>
                ))}
            </RadioGroup>
        </>
    );
}

export function Paywall() {
    const t = useTranslation();
    const router = useRouter();
    const { eligibleForTrial, getPackages, isMirrored, isPro, mirrorEntitlement, purchasePackage, restorePurchases } =
        useRevenueCat();
    const isMounted = useIsMounted();
    const { accountId } = useAuthSession();
    const [plans, setPlans] = useState<readonly Plan[] | null>(null);
    const [selected, setSelected] = useState<PlanKind | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [failure, setFailure] = useState<TranslationKey | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadPlans(getPackages, eligibleForTrial)
            .then((next) => {
                if (!cancelled) {
                    // oxlint-disable-next-line promise/no-callback-in-promise -- an effect body cannot be async, so the setState has nowhere else to be sequenced from
                    setPlans(next);
                    // oxlint-disable-next-line promise/no-callback-in-promise -- as above
                    setSelected(next.find((plan) => plan.kind === "annual")?.kind ?? next[0]?.kind ?? null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setFailed(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [attempt, eligibleForTrial, getPackages]);

    const retry = () => {
        setFailed(false);
        setPlans(null);
        setAttempt((count) => count + 1);
    };

    /** For a customer the store calls Pro whose account has not been told yet. */
    const confirm = async () => {
        setBusy(true);
        setFailure(null);
        try {
            if (!(await mirrorEntitlement()) && isMounted()) {
                setFailure("pro.syncPendingBody");
            }
        } finally {
            if (isMounted()) {
                setBusy(false);
            }
        }
    };

    const plan = plans?.find((candidate) => candidate.kind === selected) ?? null;

    const buy = async () => {
        if (plan === null) {
            return;
        }
        setBusy(true);
        setFailure(null);
        try {
            const outcome = await purchasePackage(plan.offer);
            const mirrored = outcome !== "pro" || (await mirrorEntitlement());
            if (!isMounted()) {
                return;
            }
            if (!mirrored) {
                setFailure("pro.syncPendingBody");
            } else if (outcome === "pro") {
                router.back();
            } else if (outcome === "unentitled") {
                setFailure("pro.unentitledBody");
            }
        } catch {
            setFailure("pro.failedBody");
        } finally {
            setBusy(false);
        }
    };

    const restore = async () => {
        setBusy(true);
        setFailure(null);
        try {
            const restored = await restorePurchases();
            const mirrored = !restored || (await mirrorEntitlement());
            if (!isMounted()) {
                return;
            }
            if (!mirrored) {
                setFailure("pro.restorePendingBody");
            } else if (restored) {
                router.back();
            } else {
                setFailure("pro.nothingRestoredBody");
            }
        } catch {
            setFailure("pro.restoreFailedBody");
        } finally {
            setBusy(false);
        }
    };

    const empty = failed || (plans !== null && plans.length === 0);
    // Most of what Pro sells runs on the account: sync, photo backup, AI import
    // and the web lookup all need a backend. A build without one cannot deliver
    // what this screen advertises, so it does not take money for it either.
    const noCloud = !proSellable();
    const needsAccount = !noCloud && accountId === null;
    const canBuy = !(isPro || needsAccount || noCloud);

    return (
        <View className="bg-background flex-1">
            <ScrollView
                className="flex-1"
                contentContainerClassName="px-5 pb-2"
                contentInsetAdjustmentBehavior="automatic"
            >
                <View className="pt-2">
                    <MonoLabel>{t("pro.eyebrow")}</MonoLabel>
                    <Text className="text-foreground text-title font-sans-semibold pt-2 tracking-tight">
                        {t("pro.title")}
                    </Text>
                </View>
                <Comparison />
            </ScrollView>

            <ScrollView bounces={false} className="shrink grow-0" contentContainerClassName="pb-safe-offset-4">
                {needsAccount ? (
                    <View className="items-center px-5 pt-5">
                        <Text className="text-muted text-subtitle text-center">{t("pro.needsAccount")}</Text>
                    </View>
                ) : null}
                {noCloud ? (
                    <View className="items-center px-5 pt-5">
                        <Text className="text-muted text-subtitle text-center" testID="paywall-no-cloud">
                            {t("pro.needsCloud")}
                        </Text>
                    </View>
                ) : null}
                {canBuy ? (
                    <View className="px-5">
                        <PlanPicker
                            empty={empty}
                            onRetry={retry}
                            onSelect={setSelected}
                            plans={plans}
                            selected={selected}
                        />
                    </View>
                ) : null}
                {isPro && failure === null ? (
                    <View className="items-center gap-3 px-5 pt-5">
                        {isMirrored ? (
                            <Text className="text-income text-subtitle text-center">{t("pro.alreadyActive")}</Text>
                        ) : (
                            <>
                                <Text className="text-muted text-subtitle text-center" testID="paywall-unconfirmed">
                                    {t("pro.unconfirmed")}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={busy}
                                    onPress={confirm}
                                    testID="paywall-confirm"
                                >
                                    <MonoLabel className="text-foreground">{t("pro.retry")}</MonoLabel>
                                </Pressable>
                            </>
                        )}
                    </View>
                ) : null}

                {failure === null ? null : (
                    <View className="px-5 pt-3">
                        <Text className="text-danger text-footnote text-center" testID="paywall-failure">
                            {t(failure)}
                        </Text>
                    </View>
                )}

                {canBuy ? (
                    <View className="px-5 pt-5">
                        <Button
                            className="rounded-full"
                            disabled={plan === null}
                            fullWidth
                            loading={busy}
                            onPress={buy}
                            size="md"
                            testID="paywall-cta"
                            variant="primary"
                        >
                            {ctaLabel(plan, t)}
                        </Button>
                        {plan === null || plan.trialDays === null ? null : (
                            <Text className="text-muted text-micro pt-2 text-center font-mono">
                                {t("pro.cta.then", { price: plan.priceString })}
                            </Text>
                        )}
                    </View>
                ) : null}

                <View className="flex-row items-center justify-center gap-4 px-5 pt-4">
                    {needsAccount ? null : (
                        <>
                            <Pressable
                                accessibilityRole="button"
                                disabled={busy}
                                onPress={restore}
                                testID="paywall-restore"
                            >
                                <MonoLabel>{t("pro.legal.restore")}</MonoLabel>
                            </Pressable>
                            <LegalDot />
                        </>
                    )}
                    <Pressable accessibilityRole="link" onPress={() => openBrowserAsync(TERMS_URL)}>
                        <MonoLabel>{t("pro.legal.terms")}</MonoLabel>
                    </Pressable>
                    <LegalDot />
                    <Pressable accessibilityRole="link" onPress={() => openBrowserAsync(PRIVACY_URL)}>
                        <MonoLabel>{t("pro.legal.privacy")}</MonoLabel>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}
