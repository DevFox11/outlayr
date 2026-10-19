import { BottomSheetModal, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { OutlinedSelectField } from "@/components/material/outlined-field";
import { SheetGestureRoot } from "@/components/sheet-gesture-root";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { InstallmentRow } from "@/data/installments-core";
import { formatTargetDate } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { useMergedRef } from "@/hooks/use-merged-ref";
import { useSheetSurface } from "@/hooks/use-sheet-surface";
import { useLanguage, useTranslation } from "@/i18n/context";
import { CompactDatePicker } from "@/screens/budgets/components/compact-date-picker";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

import type { CuotaSheetProps } from "./cuota-sheet";
import { installmentTitle } from "./labels";
import { useCuotaEditor } from "./use-cuota-editor";

const PRESSED_ALPHA = 0.1;

/** What an outlined select field reads. */
function fieldValue(value: string) {
    return (
        <Text className="text-body text-m3-on-surface tabular-nums" numberOfLines={1}>
            {value}
        </Text>
    );
}

/**
 * One cuota as a Material 3 modal bottom sheet: Due and Amount as outlined
 * fields, each written as soon as it is picked, and Delete as an error text
 * button. Same contract as `cuota-sheet.tsx`.
 */
export function CuotaSheet({ count, currency, earliest, onDismiss, ref, row }: CuotaSheetProps) {
    const insets = useSafeAreaInsets();
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
                <BottomSheetView style={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}>
                    {row ? (
                        <CuotaBody
                            count={count}
                            currency={currency}
                            earliest={earliest}
                            key={row.id}
                            onClose={() => sheetRef.current?.dismiss()}
                            row={row}
                            sheetSurface={sheetSurface}
                        />
                    ) : null}
                </BottomSheetView>
            </SheetGestureRoot>
        </BottomSheetModal>
    );
}

interface CuotaBodyProps {
    count: number;
    currency: string;
    earliest?: Date;
    onClose: () => void;
    row: InstallmentRow;
    sheetSurface: string;
}

function CuotaBody({ count, currency, earliest, onClose, row, sheetSurface }: CuotaBodyProps) {
    const t = useTranslation();
    const m3 = useMaterialColors();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const [pickingDate, setPickingDate] = useState(false);
    const { amount, commitAmount, dueDate, minorUnits, moveTo, padRef, padText, remove, setPadText } = useCuotaEditor({
        currency,
        onClose,
        row,
    });
    const due = formatTargetDate(dueDate, language);
    const shownAmount = formatAmount(amount, currency, showCents, language);

    return (
        <View>
            <Text accessibilityRole="header" className="text-m3-on-surface px-2 pb-4 text-[22px] leading-7">
                {installmentTitle(t, row, count)}
            </Text>
            <View className="gap-4">
                {pickingDate ? (
                    <CompactDatePicker
                        label={t("installments.cuota.due")}
                        onChange={(next) => {
                            setPickingDate(false);
                            moveTo(next);
                        }}
                        onDismiss={() => setPickingDate(false)}
                        range={{ start: earliest }}
                        value={dueDate}
                    />
                ) : (
                    <OutlinedSelectField
                        accessibilityValue={due}
                        dropdown={false}
                        ground={sheetSurface}
                        label={t("installments.cuota.due")}
                        onPress={() => setPickingDate(true)}
                        value={fieldValue(due)}
                    />
                )}
                <OutlinedSelectField
                    accessibilityValue={shownAmount}
                    dropdown={false}
                    ground={sheetSurface}
                    label={t("installments.cuota.amount")}
                    onPress={() => padRef.current?.present()}
                    value={fieldValue(shownAmount)}
                />
            </View>
            <Pressable
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(m3.error, PRESSED_ALPHA) }}
                className="mt-2 h-12 justify-center self-start overflow-hidden rounded-full px-3"
                onPress={remove}
            >
                <Text className="font-sans-medium text-body text-m3-error">{t("installments.cuota.delete")}</Text>
            </Pressable>
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
