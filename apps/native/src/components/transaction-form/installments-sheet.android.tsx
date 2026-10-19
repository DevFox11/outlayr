import { BottomSheetModal, BottomSheetScrollView } from "@expo/ui/community/bottom-sheet";
import {
    Checkbox,
    SegmentedButton,
    SingleChoiceSegmentedButtonRow,
    Text as ComposeText,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import MinusSignIcon from "@hugeicons-pro/core-stroke-rounded/MinusSignIcon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { IconSvgElement } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceRow } from "@/components/list/list-row";
import { ListItemText } from "@/components/list/material-list-item";
import { MaterialHost } from "@/components/material-host";
import { OutlinedDropdownField } from "@/components/material/outlined-dropdown-field";
import { OutlinedSelectField } from "@/components/material/outlined-field";
import { formatSentenceDate, formatTargetDate } from "@/domain/dates";
import { EVERY_ORDER, rescheduled } from "@/domain/installment-draft";
import type { ScheduledInstallment } from "@/domain/installments";
import { useSheetSurface } from "@/hooks/use-sheet-surface";
import { useLanguage, useTranslation } from "@/i18n/context";
import { CompactDatePicker } from "@/screens/budgets/components/compact-date-picker";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

import { SheetGestureRoot } from "../sheet-gesture-root";
import { Text } from "../text";
import { InstallmentsPad, MAX_COUNT, NONE, useInstallmentsSheetForm } from "./installments-sheet-form";
import type { InstallmentsSheetProps } from "./installments-sheet-form";

const PRESSED_ALPHA = 0.1;
/** M3 icon button state layer: a 40dp circle inside the 48dp target. */
const STATE_LAYER_RADIUS = 20;
const LABEL_FONT = { fontFamily: "GoogleSansFlex_500Medium" } as const;
/** Taller than most screens, so it opens expanded and scrolls: a fitted sheet here cannot. */
const SNAP_POINTS = ["100%"];

/** What an outlined select field reads. */
function fieldValue(value: string) {
    return (
        <Text className="text-body text-m3-on-surface tabular-nums" numberOfLines={1}>
            {value}
        </Text>
    );
}

/**
 * The installments sheet as a Material 3 modal bottom sheet: outlined fields
 * for what is paid now, where from, the count and amount, the rhythm and the
 * first due date, segmented buttons for the upfront's share, then the schedule
 * with a checkbox per cuota already paid. Same contract and state as
 * `installments-sheet.tsx`.
 */
export function InstallmentsSheet(props: InstallmentsSheetProps) {
    const { accounts, currency, draft, onChange, purchaseDay, ref, schedule } = props;
    const t = useTranslation();
    const { language } = useLanguage();
    const insets = useSafeAreaInsets();
    const sheetSurface = useSheetSurface();
    const form = useInstallmentsSheetForm(props);
    const { each, emptyNote, firstDue, from, money, open, openPad, over, paidBefore, setOpen, step, total, upfront } =
        form;
    const noneLabel = `${t("installments.from.none")} · ${t("installments.notFromAccount")}`;
    const firstDueLabel = firstDue ? formatTargetDate(firstDue, language) : "";

    return (
        <BottomSheetModal
            backgroundStyle={{ backgroundColor: sheetSurface }}
            enableDynamicSizing={false}
            enablePanDownToClose
            ref={ref}
            snapPoints={SNAP_POINTS}
        >
            <SheetGestureRoot fill>
                <BottomSheetScrollView
                    contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text accessibilityRole="header" className="text-m3-on-surface px-2 pb-4 text-[22px] leading-7">
                        {t("installments.chip")}
                    </Text>
                    <View className="gap-4">
                        <OutlinedSelectField
                            accessibilityValue={money(upfront)}
                            dropdown={false}
                            ground={sheetSurface}
                            label={t("installments.paidNow")}
                            onPress={() => openPad("upfront", upfront)}
                            value={fieldValue(money(upfront))}
                        />
                        <MaterialHost matchContents={{ vertical: true }}>
                            <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                                {form.shares.map((share) => (
                                    <SegmentedButton
                                        key={share.label}
                                        onClick={share.onPress}
                                        selected={share.selected}
                                    >
                                        <SegmentedButton.Label>
                                            <ComposeText maxLines={1} style={LABEL_FONT}>
                                                {share.label}
                                            </ComposeText>
                                        </SegmentedButton.Label>
                                    </SegmentedButton>
                                ))}
                            </SingleChoiceSegmentedButtonRow>
                        </MaterialHost>

                        {upfront > 0 ? (
                            <OutlinedDropdownField
                                ground={sheetSurface}
                                label={t("installments.from")}
                                onChange={(id) => onChange({ ...draft, upfrontAccountId: id === NONE ? null : id })}
                                options={[
                                    { label: noneLabel, value: NONE },
                                    ...accounts.map((account) => ({ label: account.name, value: account.id })),
                                ]}
                                value={from?.id ?? NONE}
                            />
                        ) : null}

                        <OutlinedSelectField
                            accessibilityValue={`${draft.count} × ${money(each)}`}
                            dropdown={false}
                            ground={sheetSurface}
                            label={t("installments.then")}
                            leading={
                                <View className="flex-row items-center pr-2">
                                    <StepButton
                                        disabled={draft.count <= 1}
                                        icon={MinusSignIcon}
                                        label="−"
                                        onPress={() => step(-1)}
                                    />
                                    <Text className="text-body text-m3-on-surface tabular-nums">{`${draft.count} ×`}</Text>
                                    <StepButton
                                        disabled={draft.count >= MAX_COUNT}
                                        icon={PlusSignIcon}
                                        label="+"
                                        onPress={() => step(1)}
                                    />
                                </View>
                            }
                            onPress={() => openPad("each", each)}
                            value={fieldValue(money(each))}
                        />

                        <View>
                            <OutlinedSelectField
                                accessibilityValue={t(`installments.every.${draft.every}`)}
                                focused={open === "every"}
                                ground={sheetSurface}
                                label={t("installments.every")}
                                onPress={() => setOpen((shown) => (shown === "every" ? null : "every"))}
                                value={fieldValue(t(`installments.every.${draft.every}`))}
                            />
                            {open === "every"
                                ? EVERY_ORDER.map((key) => (
                                      <ChoiceRow
                                          detail={
                                              key === "weekly" ? undefined : t(`installments.every.${key}.providers`)
                                          }
                                          key={key}
                                          label={t(`installments.every.${key}`)}
                                          onPress={() => {
                                              setOpen(null);
                                              onChange(rescheduled(draft, { every: key, firstDue: null }));
                                          }}
                                          selected={draft.every === key}
                                      />
                                  ))
                                : null}
                        </View>

                        {open === "firstDue" && firstDue ? (
                            <CompactDatePicker
                                label={t("installments.firstDue")}
                                onChange={(next) => {
                                    setOpen(null);
                                    onChange(rescheduled(draft, { firstDue: next }));
                                }}
                                onDismiss={() => setOpen(null)}
                                range={{ start: purchaseDay }}
                                value={firstDue}
                            />
                        ) : (
                            <OutlinedSelectField
                                accessibilityValue={firstDueLabel}
                                dropdown={false}
                                ground={sheetSurface}
                                label={t("installments.firstDue")}
                                onPress={() => setOpen("firstDue")}
                                value={fieldValue(firstDueLabel)}
                            />
                        )}
                    </View>

                    {schedule === null ? (
                        emptyNote !== null && <Text className="text-caption text-m3-error px-4 pt-2">{emptyNote}</Text>
                    ) : (
                        <View className="pt-4">
                            {schedule.map((row) => (
                                <ScheduleRow
                                    detail={form.rowDetail(row)}
                                    editing={open === row.sequence}
                                    key={row.sequence}
                                    money={money}
                                    onAmount={() => openPad({ sequence: row.sequence }, row.amount)}
                                    onDate={(next) => form.editDate(row.sequence, next)}
                                    onPress={() =>
                                        row.sequence === 0
                                            ? openPad("upfront", upfront)
                                            : setOpen((shown) => (shown === row.sequence ? null : row.sequence))
                                    }
                                    onToggle={() => form.toggle(row.sequence)}
                                    paid={row.sequence === 0 || row.sequence <= paidBefore}
                                    purchaseDay={purchaseDay}
                                    row={row}
                                />
                            ))}
                            <View className="min-h-18 flex-row items-center gap-4 py-2 pl-12">
                                <View className="flex-1 pl-2">
                                    <Text className="font-sans-medium text-body text-m3-on-surface">
                                        {t("installments.total")}
                                    </Text>
                                    {over > 0 ? (
                                        <Text className="text-caption text-m3-primary">
                                            {t("installments.overPrice", { amount: money(over) })}
                                        </Text>
                                    ) : null}
                                </View>
                                <Text className="font-sans-medium text-body text-m3-on-surface tabular-nums">
                                    {money(total)}
                                </Text>
                            </View>
                        </View>
                    )}
                </BottomSheetScrollView>
            </SheetGestureRoot>
            <InstallmentsPad currency={currency} form={form} />
        </BottomSheetModal>
    );
}

function StepButton({
    disabled,
    icon,
    label,
    onPress,
}: {
    disabled: boolean;
    icon: IconSvgElement;
    label: string;
    onPress: () => void;
}) {
    const m3 = useMaterialColors();
    return (
        <Pressable
            accessibilityLabel={label}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            android_ripple={{
                borderless: true,
                color: withAlpha(m3.onSurface, PRESSED_ALPHA),
                radius: STATE_LAYER_RADIUS,
            }}
            className="size-12 items-center justify-center"
            disabled={disabled}
            onPress={onPress}
            style={{ opacity: disabled ? 0.38 : 1 }}
        >
            <HugeiconsIcon color={m3.onSurfaceVariant} icon={icon} size={20} />
        </Pressable>
    );
}

interface ScheduleRowProps {
    detail: string | null;
    editing: boolean;
    money: (value: number) => string;
    onAmount: () => void;
    onDate: (next: Date) => void;
    onPress: () => void;
    onToggle: () => void;
    paid: boolean;
    purchaseDay: Date;
    row: ScheduledInstallment;
}

/**
 * One row of the draft's schedule: a checkbox for a cuota paid before
 * Outlayr, its date and amount, and while it is open its due date and amount
 * as fields. The checkbox is drawn by Compose but pressed through RN, so a tap
 * on it never reaches the row.
 */
function ScheduleRow({
    detail,
    editing,
    money,
    onAmount,
    onDate,
    onPress,
    onToggle,
    paid,
    purchaseDay,
    row,
}: ScheduleRowProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const m3 = useMaterialColors();
    const sheetSurface = useSheetSurface();
    const [pickingDate, setPickingDate] = useState(false);
    const isUpfront = row.sequence === 0;
    const date = formatSentenceDate(row.dueDate, language);
    const due = formatTargetDate(row.dueDate, language);
    const amount = money(row.amount);
    return (
        <View className="border-m3-outline-variant border-b">
            <View className="min-h-18 flex-row items-center">
                <Pressable
                    accessibilityLabel={date}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: paid, disabled: isUpfront }}
                    android_ripple={{
                        borderless: true,
                        color: withAlpha(m3.onSurface, PRESSED_ALPHA),
                        radius: STATE_LAYER_RADIUS,
                    }}
                    className="size-12 items-center justify-center"
                    disabled={isUpfront}
                    onPress={onToggle}
                >
                    <View importantForAccessibility="no-hide-descendants" pointerEvents="none">
                        <MaterialHost matchContents>
                            <Checkbox value={paid} />
                        </MaterialHost>
                    </View>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={isUpfront ? undefined : { expanded: editing }}
                    android_ripple={{ color: withAlpha(m3.onSurface, PRESSED_ALPHA) }}
                    className="flex-1 flex-row items-center gap-4 self-stretch py-2 pl-2"
                    onPress={onPress}
                >
                    <View className="flex-1">
                        <ListItemText supporting={[detail]} title={isUpfront ? t("installments.upfront") : date} />
                    </View>
                    <Text className="text-body text-m3-on-surface tabular-nums">{amount}</Text>
                </Pressable>
            </View>
            {editing ? (
                <View className="flex-row gap-3 pb-4 pl-14">
                    <View className="flex-1">
                        {pickingDate ? (
                            <CompactDatePicker
                                label={t("installments.cuota.due")}
                                onChange={(next) => {
                                    setPickingDate(false);
                                    onDate(next);
                                }}
                                onDismiss={() => setPickingDate(false)}
                                range={{ start: purchaseDay }}
                                value={row.dueDate}
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
                    </View>
                    <View className="flex-1">
                        <OutlinedSelectField
                            accessibilityValue={amount}
                            dropdown={false}
                            ground={sheetSurface}
                            label={t("installments.cuota.amount")}
                            onPress={onAmount}
                            value={fieldValue(amount)}
                        />
                    </View>
                </View>
            ) : null}
        </View>
    );
}
