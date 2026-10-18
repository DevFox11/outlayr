import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { Stack, useRouter } from "expo-router";
import { Button } from "panelui-native/components/button";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { HeroNumber } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { ScreenHeader } from "@/components/screen-header";
import { Text } from "@/components/text";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import { useInstallmentPlans } from "@/data/installments";
import { installmentsRepo } from "@/data/installments-core";
import type { InstallmentRow, PlanWithStanding } from "@/data/installments-core";
import { useNow } from "@/data/use-now";
import { formatSentenceDate } from "@/domain/dates";
import { orderName } from "@/domain/installments";
import type { InstallmentStanding } from "@/domain/installments";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { rearmInstallmentReminders } from "@/lib/installment-reminder-sync";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";

import { CuotaSheet } from "./cuota-sheet";
import { dueIn, installmentTitle } from "./labels";

/**
 * One order: what is left, what it was bought for, and every row of its
 * schedule, the upfront first. Paying opens the pay sheet; nothing posts here
 * on its own. A cuota is edited from its row, the way providers move one date
 * or round one amount.
 */
export function InstallmentOrder({ planId }: { planId: string }) {
    const db = useDatabase();
    const router = useRouter();
    const nowMs = useNow();
    const entry = useInstallmentPlans(db, nowMs).find(({ plan }) => plan.id === planId) ?? null;

    useEffect(() => {
        if (entry == null) {
            router.back();
        }
    }, [entry, router]);

    return entry == null ? null : <OrderLoaded entry={entry} nowMs={nowMs} />;
}

function OrderLoaded({ entry, nowMs }: { entry: PlanWithStanding; nowMs: number }) {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const haptics = useHaptics();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const { plan, purchase, standing } = entry;
    const account = useAccounts(db).find((row) => row.id === plan.accountId);
    const money = (value: number) => formatAmount(value, plan.currency, showCents, language);
    const cuotaSheetRef = useRef<BottomSheetModal>(null);
    const [editing, setEditing] = useState<InstallmentRow | null>(null);
    const name = orderName(t, purchase);

    useEffect(() => {
        if (editing) {
            cuotaSheetRef.current?.present();
        }
    }, [editing]);

    const pay = (all: boolean) =>
        router.push({ params: { all: all ? "1" : "0", planId: plan.id }, pathname: "/installments/pay" });

    const deleteOrder = () =>
        Alert.alert(t("installments.deleteOrder"), t("installments.deleteOrder.body"), [
            { style: "cancel", text: t("common.cancel") },
            {
                onPress: async () => {
                    try {
                        await installmentsRepo.deletePlan(db, plan.id);
                        rearmInstallmentReminders(db);
                        haptics("warning");
                    } catch (error) {
                        console.error("Failed to delete the order", error);
                        notifyFailure({ body: t("installments.failedBody"), title: t("installments.failedTitle") });
                    }
                },
                style: "destructive",
                text: t("common.delete"),
            },
        ]);

    return (
        <>
            <ScreenHeader title={name} />
            <Stack.Screen.BackButton displayMode="minimal" />
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Menu {...toolbarIcon("more")} accessibilityLabel={t("installments.order")}>
                    <Stack.Toolbar.MenuAction destructive icon="trash" onPress={deleteOrder}>
                        {t("installments.deleteOrder")}
                    </Stack.Toolbar.MenuAction>
                </Stack.Toolbar.Menu>
            </Stack.Toolbar>
            <ScrollView
                className="bg-background"
                contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View className="gap-1 pt-6">
                    <MonoLabel>{t("installments.leftToPay")}</MonoLabel>
                    <HeroNumber amount={standing.remaining} code={plan.currency} showCents={showCents} sign="" />
                    {purchase ? (
                        <Text className="text-muted text-subtitle">
                            {[
                                account?.name,
                                t("installments.bought", {
                                    date: formatSentenceDate(purchase.date, language),
                                    price: money(purchase.amount),
                                }),
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </Text>
                    ) : null}
                </View>

                {standing.next ? (
                    <View className="flex-row gap-2.5 pt-5">
                        <Button className="flex-1 rounded-full" onPress={() => pay(false)} size="md" variant="primary">
                            {t("installments.pay", { amount: money(standing.next.remaining) })}
                        </Button>
                        <Button className="flex-1 rounded-full" onPress={() => pay(true)} size="md" variant="secondary">
                            {t("installments.payAll", { amount: money(standing.remaining) })}
                        </Button>
                    </View>
                ) : null}

                <MonoLabel accessibilityRole="header" className="pt-7 pb-1.5">
                    {t("installments.schedule")}
                </MonoLabel>
                <View className="border-border border-t">
                    {standing.rows.map((row) => (
                        <ScheduleRow
                            count={standing.installmentsTotal}
                            isNext={row === standing.next}
                            key={row.row.id}
                            money={money}
                            nowMs={nowMs}
                            onPress={row.row.sequence === 0 ? undefined : () => setEditing({ ...row.row })}
                            row={row}
                        />
                    ))}
                </View>
            </ScrollView>
            <CuotaSheet
                count={standing.installmentsTotal}
                currency={plan.currency}
                earliest={purchase?.date}
                onDismiss={() => setEditing(null)}
                ref={cuotaSheetRef}
                row={editing}
            />
        </>
    );
}

interface ScheduleRowProps {
    count: number;
    isNext: boolean;
    money: (value: number) => string;
    nowMs: number;
    onPress?: () => void;
    row: InstallmentStanding<InstallmentRow>;
}

function ScheduleRow({ count, isNext, money, nowMs, onPress, row }: ScheduleRowProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const due = isNext ? dueIn(t, row.row.dueDate, nowMs) : null;
    const when = [formatSentenceDate(row.row.dueDate, language), due].filter(Boolean).join(" · ");
    let status: { className: string; text: string } | null = null;
    if (row.status === "paid") {
        status = { className: "text-income", text: t("installments.paid") };
    } else if (row.overdue) {
        status = { className: "text-expense", text: t("installments.overdue") };
    } else if (row.status === "partial") {
        status = { className: "text-muted", text: t("installments.partly", { amount: money(row.covered) }) };
    }
    return (
        <Pressable
            accessibilityRole={onPress ? "button" : undefined}
            className="border-border flex-row items-center gap-3 border-b py-3 active:opacity-60"
            disabled={!onPress}
            onPress={onPress}
        >
            <View className="flex-1 gap-0.5">
                <Text className="text-body text-foreground">{installmentTitle(t, row.row, count)}</Text>
                <Text className={row.overdue ? "text-expense text-subtitle" : "text-muted text-subtitle"}>{when}</Text>
            </View>
            <View className="items-end gap-0.5">
                <Text className="text-body text-foreground tabular-nums">{money(row.row.amount)}</Text>
                {status ? <Text className={`${status.className} text-subtitle`}>{status.text}</Text> : null}
            </View>
        </Pressable>
    );
}
