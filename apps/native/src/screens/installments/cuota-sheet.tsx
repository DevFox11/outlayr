import { BottomSheetModal, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { useRef, useState } from "react";
import type { Ref } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { revealEntering } from "@/components/sentence/sentence-motion";
import { SheetGestureRoot } from "@/components/sheet-gesture-root";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { installmentsRepo } from "@/data/installments-core";
import type { InstallmentRow } from "@/data/installments-core";
import { formatTargetDate } from "@/domain/dates";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { useMergedRef } from "@/hooks/use-merged-ref";
import { useSheetSurface } from "@/hooks/use-sheet-surface";
import { useLanguage, useTranslation } from "@/i18n/context";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";
import { CompactDatePicker } from "@/screens/budgets/components/compact-date-picker";
import { EditorRow } from "@/screens/budgets/components/editor-row";

import { installmentTitle } from "./labels";

interface CuotaSheetProps {
    count: number;
    currency: string;
    /** The purchase's date: a cuota due before it would take the upfront's payment. */
    earliest?: Date;
    onDismiss: () => void;
    ref?: Ref<BottomSheetModal>;
    /** Null while no row is being edited. */
    row: InstallmentRow | null;
}

/**
 * One cuota's date and amount, each committed from its own row the way the
 * goal editor commits, and its delete. Moving or deleting a row touches only
 * that row; the payments already made are re-allocated by date on the next read.
 */
export function CuotaSheet({ count, currency, earliest, onDismiss, ref, row }: CuotaSheetProps) {
    const sheetSurface = useSheetSurface();
    const sheetRef = useRef<BottomSheetModal>(null);
    const setRefs = useMergedRef(sheetRef, ref);
    return (
        <BottomSheetModal
            backgroundStyle={{ backgroundColor: sheetSurface }}
            enableDynamicSizing
            enablePanDownToClose
            onDismiss={onDismiss}
            ref={setRefs}
        >
            <SheetGestureRoot style={{}}>
                <BottomSheetView style={{ paddingBottom: 36, paddingHorizontal: 20, paddingTop: 8 }}>
                    {row ? (
                        <CuotaBody
                            count={count}
                            currency={currency}
                            earliest={earliest}
                            key={row.id}
                            onClose={() => sheetRef.current?.dismiss()}
                            row={row}
                        />
                    ) : null}
                </BottomSheetView>
            </SheetGestureRoot>
        </BottomSheetModal>
    );
}

function CuotaBody({
    count,
    currency,
    earliest,
    onClose,
    row,
}: {
    count: number;
    currency: string;
    earliest?: Date;
    onClose: () => void;
    row: InstallmentRow;
}) {
    const db = useDatabase();
    const t = useTranslation();
    const haptics = useHaptics();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const minorUnits = minorUnitsFor(currency);
    const padRef = useRef<BottomSheetModal>(null);
    const [pickingDate, setPickingDate] = useState(false);
    const [dueDate, setDueDate] = useState(row.dueDate);
    const [amount, setAmount] = useState(row.amount);
    const [padText, setPadText] = useState(() => numberToNumpad(row.amount, minorUnits));

    const write = async (patch: { amount?: number; dueDate?: Date }) => {
        try {
            await installmentsRepo.updateInstallment(db, row.id, patch);
            haptics("success");
        } catch (error) {
            console.error("Failed to update the installment", error);
            notifyFailure({ body: t("installments.failedBody"), title: t("installments.failedTitle") });
        }
    };

    const commitAmount = () => {
        padRef.current?.dismiss();
        const next = numpadToNumber(padText);
        if (next > 0 && next !== amount) {
            setAmount(next);
            write({ amount: next }).catch(() => undefined);
        }
    };

    const remove = async () => {
        try {
            await installmentsRepo.deleteInstallment(db, row.id);
            haptics("warning");
            onClose();
        } catch (error) {
            console.error("Failed to delete the installment", error);
            notifyFailure({ body: t("installments.failedBody"), title: t("installments.failedTitle") });
        }
    };

    return (
        <View>
            <Text accessibilityRole="header" className="text-foreground pb-3 text-center text-lg font-medium">
                {installmentTitle(t, row, count)}
            </Text>
            <View className="border-border border-t">
                <EditorRow
                    label={t("installments.cuota.due")}
                    onPress={() => setPickingDate((open) => !open)}
                    value={formatTargetDate(dueDate, language)}
                />
                {pickingDate ? (
                    <Animated.View className="border-border border-b py-2" entering={revealEntering()}>
                        <CompactDatePicker
                            label={t("installments.cuota.due")}
                            onChange={(next) => {
                                setPickingDate(false);
                                setDueDate(next);
                                write({ dueDate: next }).catch(() => undefined);
                            }}
                            onDismiss={() => setPickingDate(false)}
                            range={{ start: earliest }}
                            value={dueDate}
                        />
                    </Animated.View>
                ) : null}
                <EditorRow
                    label={t("installments.cuota.amount")}
                    onPress={() => padRef.current?.present()}
                    value={formatAmount(amount, currency, showCents, language)}
                />
                <Pressable
                    accessibilityRole="button"
                    className="border-border border-b py-3.5 active:opacity-60"
                    onPress={remove}
                >
                    <Text className="text-over-budget text-body">{t("installments.cuota.delete")}</Text>
                </Pressable>
            </View>
            <AmountEntrySheet
                code={currency}
                minorUnits={minorUnits}
                onChange={setPadText}
                onDone={commitAmount}
                ref={padRef}
                value={padText}
            />
        </View>
    );
}
