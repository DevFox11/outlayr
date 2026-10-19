import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { useDatabase } from "@/contexts/local-data-context";
import { useInstallmentPlans } from "@/data/installments";
import { installmentsRepo } from "@/data/installments-core";
import type { InstallmentRow, PlanWithStanding } from "@/data/installments-core";
import { useNow } from "@/data/use-now";
import { useTranslation } from "@/i18n/context";
import { rearmInstallmentReminders } from "@/lib/installment-reminder-sync";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";

/** The order behind `planId`, null once it is gone, which also leaves the screen. */
export function useInstallmentEntry(planId: string) {
    const db = useDatabase();
    const router = useRouter();
    const nowMs = useNow();
    const entry = useInstallmentPlans(db, nowMs).find(({ plan }) => plan.id === planId) ?? null;

    useEffect(() => {
        if (entry == null) {
            router.back();
        }
    }, [entry, router]);

    return { entry, nowMs };
}

/** What the order screen does on either platform: pay, delete, and the cuota being edited in its sheet. */
export function useOrderActions({ plan }: PlanWithStanding) {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const haptics = useHaptics();
    const cuotaSheetRef = useRef<BottomSheetModal>(null);
    const [editing, setEditing] = useState<InstallmentRow | null>(null);

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

    return { cuotaSheetRef, deleteOrder, editing, pay, setEditing };
}
