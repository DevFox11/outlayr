import { BottomSheetModal, BottomSheetScrollView } from "@expo/ui/community/bottom-sheet";
import MinusSignIcon from "@hugeicons-pro/core-stroke-rounded/MinusSignIcon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import Tick02Icon from "@hugeicons-pro/core-stroke-rounded/Tick02Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRef, useState } from "react";
import type { Ref } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { ChoiceRow } from "@/components/list/list-row";
import { revealEntering } from "@/components/sentence/sentence-motion";
import type { Account } from "@/data/accounts-core";
import { useNow } from "@/data/use-now";
import { formatSentenceDate, formatTargetDate } from "@/domain/dates";
import {
    EVERY_ORDER,
    overPrice,
    paidBeforeCount,
    rescheduled,
    UPFRONT_SHARES,
    upfrontOf,
} from "@/domain/installment-draft";
import type { InstallmentDraft } from "@/domain/installment-draft";
import type { ScheduledInstallment } from "@/domain/installments";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { useSheetSurface } from "@/hooks/use-sheet-surface";
import { useLanguage, useTranslation } from "@/i18n/context";
import { CompactDatePicker } from "@/screens/budgets/components/compact-date-picker";
import { EditorRow } from "@/screens/budgets/components/editor-row";
import { dueIn } from "@/screens/installments/labels";
import { MenuRow } from "@/screens/installments/menu-row";
import { useColors } from "@/theme/use-colors";

import { AmountEntrySheet } from "../amount-entry-sheet";
import { SheetGestureRoot } from "../sheet-gesture-root";
import { Text } from "../text";

const MAX_COUNT = 48;
const PERCENT = 100;
/** No account id can collide: they are uuids. */
const NONE = "__none__";

type PadTarget = "each" | "upfront" | { sequence: number };

interface InstallmentsSheetProps {
    /** Accounts the upfront can come from. */
    accounts: readonly Account[];
    currency: string;
    draft: InstallmentDraft;
    onChange: (next: InstallmentDraft) => void;
    price: number;
    purchaseDay: Date;
    ref?: Ref<BottomSheetModal>;
    /** What the draft generates for the price, or null while it cannot. */
    schedule: readonly ScheduledInstallment[] | null;
}

/**
 * How a purchase on a liability account is paid: the part paid now and where it
 * came from, then N installments of an amount, their rhythm and the first due
 * date, and the whole schedule they make. Cuotas already paid before Outlayr are
 * checked off in it, always from the first one. Every field is the draft's; the
 * entry form writes the order on save.
 */
export function InstallmentsSheet({
    accounts,
    currency,
    draft,
    onChange,
    price,
    purchaseDay,
    ref,
    schedule,
}: InstallmentsSheetProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const colors = useColors();
    const sheetSurface = useSheetSurface();
    const nowMs = useNow();
    const minorUnits = minorUnitsFor(currency);
    const padRef = useRef<BottomSheetModal>(null);
    const [pad, setPad] = useState<{ target: PadTarget; text: string } | null>(null);
    const [open, setOpen] = useState<"every" | "firstDue" | number | null>(null);
    const money = (value: number) => formatAmount(value, currency, true, language);

    const upfront = upfrontOf(draft, price, currency);
    const installments = schedule?.filter((row) => row.sequence > 0) ?? [];
    const firstDue = installments[0]?.dueDate ?? draft.firstDue;
    const each = draft.each ?? installments[0]?.amount ?? 0;
    const from = accounts.find((account) => account.id === draft.upfrontAccountId) ?? null;
    const shareOn = (share: number) => "share" in draft.upfront && draft.upfront.share === share;
    const paidBefore = schedule ? paidBeforeCount(draft, schedule, new Date(nowMs)) : 0;
    const total = schedule?.reduce((sum, row) => sum + row.amount, 0) ?? 0;
    const over = schedule ? overPrice(schedule, price, currency) : 0;

    const openPad = (target: PadTarget, value: number) => {
        setPad({ target, text: numberToNumpad(value, minorUnits) });
        padRef.current?.present();
    };

    const closePad = () => {
        padRef.current?.dismiss();
        if (pad === null) {
            return;
        }
        const value = numpadToNumber(pad.text);
        const { target } = pad;
        if (target === "each") {
            onChange(rescheduled(draft, { each: value > 0 ? value : null }));
        } else if (target === "upfront") {
            onChange({ ...draft, upfront: { amount: value } });
        } else if (value > 0) {
            const edit = { ...draft.edits[target.sequence], amount: value };
            onChange({ ...draft, edits: { ...draft.edits, [target.sequence]: edit } });
        }
        setPad(null);
    };

    const editDate = (sequence: number, dueDate: Date) => {
        setOpen(null);
        onChange({ ...draft, edits: { ...draft.edits, [sequence]: { ...draft.edits[sequence], dueDate } } });
    };

    // Payments apply oldest first, so checking a cuota checks every one before it.
    const toggle = (sequence: number) =>
        onChange({ ...draft, paidBefore: sequence <= paidBefore ? sequence - 1 : sequence });

    const rowDetail = (row: ScheduledInstallment): string | null => {
        if (row.sequence === 0) {
            return `${formatSentenceDate(row.dueDate, language)} · ${from ? from.name : t("installments.notFromAccount")}`;
        }
        if (row.sequence <= paidBefore) {
            return t("installments.paidBefore");
        }
        return row.sequence === paidBefore + 1 ? dueIn(t, row.dueDate, nowMs) : null;
    };

    const step = (by: number) =>
        onChange(rescheduled(draft, { count: Math.min(MAX_COUNT, Math.max(1, draft.count + by)) }));

    return (
        <BottomSheetModal
            backgroundStyle={{ backgroundColor: sheetSurface }}
            enableDynamicSizing
            enablePanDownToClose
            ref={ref}
        >
            <SheetGestureRoot style={{}}>
                <BottomSheetScrollView
                    contentContainerStyle={{ paddingBottom: 36, paddingHorizontal: 20, paddingTop: 8 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text accessibilityRole="header" className="text-foreground pb-3 text-center text-lg font-medium">
                        {t("installments.chip")}
                    </Text>
                    <View className="border-border border-t">
                        <View className="border-border border-b py-3">
                            <Pressable
                                accessibilityRole="button"
                                className="flex-row items-center gap-3 active:opacity-60"
                                onPress={() => openPad("upfront", upfront)}
                            >
                                <Text className="text-body text-foreground flex-1">{t("installments.paidNow")}</Text>
                                <Text className="text-body text-muted tabular-nums">{money(upfront)}</Text>
                            </Pressable>
                            <View className="flex-row gap-1.5 pt-2">
                                {UPFRONT_SHARES.map((share) => (
                                    <ShareOption
                                        key={share}
                                        label={`${Math.round(share * PERCENT)}%`}
                                        onPress={() => onChange({ ...draft, upfront: { share } })}
                                        selected={shareOn(share)}
                                    />
                                ))}
                                <ShareOption
                                    label={t("installments.none")}
                                    onPress={() => onChange({ ...draft, upfront: { amount: 0 } })}
                                    selected={upfront === 0}
                                />
                            </View>
                        </View>

                        {upfront > 0 ? (
                            <MenuRow
                                label={t("installments.from")}
                                onPick={(id) => onChange({ ...draft, upfrontAccountId: id === NONE ? null : id })}
                                options={[
                                    { id: NONE, title: t("installments.from.none") },
                                    ...accounts.map((account) => ({ id: account.id, title: account.name })),
                                ]}
                                selected={from?.id ?? NONE}
                                value={
                                    from
                                        ? from.name
                                        : `${t("installments.from.none")} · ${t("installments.notFromAccount")}`
                                }
                            />
                        ) : null}

                        <View className="border-border flex-row items-center gap-3 border-b py-2">
                            <Text className="text-body text-foreground flex-1">{t("installments.then")}</Text>
                            <Pressable
                                accessibilityLabel="−"
                                accessibilityRole="button"
                                className="p-2 active:opacity-60"
                                disabled={draft.count <= 1}
                                onPress={() => step(-1)}
                            >
                                <HugeiconsIcon color={colors.muted} icon={MinusSignIcon} size={16} strokeWidth={2.2} />
                            </Pressable>
                            <Text className="text-body text-foreground tabular-nums">{`${draft.count} ×`}</Text>
                            <Pressable
                                accessibilityLabel="+"
                                accessibilityRole="button"
                                className="p-2 active:opacity-60"
                                disabled={draft.count >= MAX_COUNT}
                                onPress={() => step(1)}
                            >
                                <HugeiconsIcon color={colors.muted} icon={PlusSignIcon} size={16} strokeWidth={2.2} />
                            </Pressable>
                            <Pressable
                                accessibilityLabel={t("installments.each")}
                                accessibilityRole="button"
                                className="py-1.5 active:opacity-60"
                                onPress={() => openPad("each", each)}
                            >
                                <Text className="text-body text-muted tabular-nums">{money(each)}</Text>
                            </Pressable>
                        </View>

                        <EditorRow
                            label={t("installments.every")}
                            onPress={() => setOpen((shown) => (shown === "every" ? null : "every"))}
                            value={t(`installments.every.${draft.every}`)}
                        />
                        {open === "every" ? (
                            <Animated.View entering={revealEntering()}>
                                {EVERY_ORDER.map((key) => (
                                    <ChoiceRow
                                        detail={key === "weekly" ? undefined : t(`installments.every.${key}.providers`)}
                                        key={key}
                                        label={t(`installments.every.${key}`)}
                                        onPress={() => {
                                            setOpen(null);
                                            onChange(rescheduled(draft, { every: key, firstDue: null }));
                                        }}
                                        selected={draft.every === key}
                                    />
                                ))}
                            </Animated.View>
                        ) : null}

                        <EditorRow
                            label={t("installments.firstDue")}
                            onPress={() => setOpen((shown) => (shown === "firstDue" ? null : "firstDue"))}
                            value={firstDue ? formatTargetDate(firstDue, language) : ""}
                        />
                        {open === "firstDue" && firstDue ? (
                            <Animated.View className="border-border border-b py-2" entering={revealEntering()}>
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
                            </Animated.View>
                        ) : null}
                    </View>

                    {schedule === null ? (
                        <Text className="text-expense text-subtitle pt-2">{t("installments.nothingLeft")}</Text>
                    ) : (
                        <View className="pt-5">
                            {schedule.map((row) => (
                                <ScheduleRow
                                    detail={rowDetail(row)}
                                    editing={open === row.sequence}
                                    key={row.sequence}
                                    money={money}
                                    onAmount={() =>
                                        row.sequence === 0
                                            ? openPad("upfront", upfront)
                                            : openPad({ sequence: row.sequence }, row.amount)
                                    }
                                    onDate={(next) => editDate(row.sequence, next)}
                                    onPress={() =>
                                        row.sequence === 0
                                            ? openPad("upfront", upfront)
                                            : setOpen((shown) => (shown === row.sequence ? null : row.sequence))
                                    }
                                    onStopEditing={() => setOpen(null)}
                                    onToggle={() => toggle(row.sequence)}
                                    paid={row.sequence === 0 || row.sequence <= paidBefore}
                                    purchaseDay={purchaseDay}
                                    row={row}
                                />
                            ))}
                            <View className="flex-row items-center gap-3 py-3">
                                <View className="flex-1 gap-0.5">
                                    <Text className="text-body text-foreground font-medium">
                                        {t("installments.total")}
                                    </Text>
                                    {over > 0 ? (
                                        <Text className="text-tint text-subtitle">
                                            {t("installments.overPrice", { amount: money(over) })}
                                        </Text>
                                    ) : null}
                                </View>
                                <Text className="text-body text-foreground font-medium tabular-nums">
                                    {money(total)}
                                </Text>
                            </View>
                        </View>
                    )}
                </BottomSheetScrollView>
            </SheetGestureRoot>
            <AmountEntrySheet
                code={currency}
                minorUnits={minorUnits}
                onChange={(text) => setPad((current) => (current ? { ...current, text } : current))}
                onDone={closePad}
                ref={padRef}
                value={pad?.text ?? ""}
            />
        </BottomSheetModal>
    );
}

function ShareOption({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`rounded-lg px-2.5 py-1 active:opacity-60 ${selected ? "bg-surface-secondary" : ""}`}
            onPress={onPress}
        >
            <Text className={`text-subtitle tabular-nums ${selected ? "text-foreground" : "text-muted"}`}>{label}</Text>
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
    onStopEditing: () => void;
    onToggle: () => void;
    paid: boolean;
    purchaseDay: Date;
    row: ScheduledInstallment;
}

/** One row of the draft's schedule: its check, its date and amount, and an inline editor while it is open. */
function ScheduleRow({
    detail,
    editing,
    money,
    onAmount,
    onDate,
    onPress,
    onStopEditing,
    onToggle,
    paid,
    purchaseDay,
    row,
}: ScheduleRowProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const isUpfront = row.sequence === 0;
    const date = formatSentenceDate(row.dueDate, language);
    return (
        <View>
            <View className="border-border flex-row items-center gap-3 border-b">
                <CheckCircle checked={paid} disabled={isUpfront} label={date} onPress={onToggle} />
                <Pressable
                    accessibilityRole="button"
                    className="flex-1 flex-row items-center gap-3 py-3 active:opacity-60"
                    onPress={onPress}
                >
                    <View className="flex-1 gap-0.5">
                        <Text className="text-body text-foreground">
                            {isUpfront ? t("installments.upfront") : date}
                        </Text>
                        {detail ? <Text className="text-muted text-subtitle">{detail}</Text> : null}
                    </View>
                    <Text className="text-body text-foreground tabular-nums">{money(row.amount)}</Text>
                </Pressable>
            </View>
            {editing ? (
                <Animated.View
                    className="border-border flex-row items-center gap-3 border-b py-2"
                    entering={revealEntering()}
                >
                    <View className="flex-1">
                        <CompactDatePicker
                            label={t("installments.cuota.due")}
                            onChange={onDate}
                            onDismiss={onStopEditing}
                            range={{ start: purchaseDay }}
                            value={row.dueDate}
                        />
                    </View>
                    <Pressable
                        accessibilityLabel={t("installments.cuota.amount")}
                        accessibilityRole="button"
                        className="py-1.5 active:opacity-60"
                        onPress={onAmount}
                    >
                        <Text className="text-body text-tint tabular-nums">{money(row.amount)}</Text>
                    </Pressable>
                </Animated.View>
            ) : null}
        </View>
    );
}

const CIRCLE = 22;

function CheckCircle({
    checked,
    disabled,
    label,
    onPress,
}: {
    checked: boolean;
    disabled: boolean;
    label: string;
    onPress: () => void;
}) {
    const colors = useColors();
    return (
        <Pressable
            accessibilityLabel={label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled }}
            className="active:opacity-60"
            disabled={disabled}
            hitSlop={10}
            onPress={onPress}
        >
            <View
                className={`items-center justify-center rounded-full ${checked ? "bg-foreground" : "border-border border-[1.5px]"}`}
                style={{ height: CIRCLE, width: CIRCLE }}
            >
                {checked ? (
                    <HugeiconsIcon color={colors.background} icon={Tick02Icon} size={14} strokeWidth={2.6} />
                ) : null}
            </View>
        </Pressable>
    );
}
