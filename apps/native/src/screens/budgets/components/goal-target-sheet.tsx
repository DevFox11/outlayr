import { BottomSheetModal, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { AmountNumpad } from "@/components/amount-numpad";
import { HeroNumber } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { Sentence } from "@/components/sentence/sentence";
import { revealEntering } from "@/components/sentence/sentence-motion";
import { SheetGestureRoot } from "@/components/sheet-gesture-root";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useNow } from "@/data/use-now";
import { formatTargetMonth } from "@/domain/dates";
import { addLocalMonths, tomorrowLocal } from "@/domain/local-day";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { goalProgress } from "@/domain/savings-goal";
import { useSheetSurface } from "@/hooks/use-sheet-surface";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";

import { CompactDatePicker } from "./compact-date-picker";
import { SheetCommitButton } from "./sheet-commit-button";

/** The account a goal is being set on. Its balance is the goal's starting line. */
export interface GoalTarget {
    accountId: string;
    /**
     * The account's balance today, in `currency`. Frozen as the goal's start.
     *
     * Null when it cannot be stated in that currency — retargeting a goal held in
     * a currency the ledger is no longer displayed in. The sheet then drops the
     * figures that depend on it rather than converting a balance it was not given.
     */
    balance: number | null;
    currency: string;
    /**
     * The goal's figures as they stand, when one is being re-set rather than
     * created. Opening a blank sheet over an existing goal would read as
     * discarding it — the same contract the budget limit sheet keeps.
     */
    existing?: { targetAmount: number; targetDate: Date } | null;
    name: string;
}

export interface GoalCommit {
    startAmount: number;
    targetAmount: number;
    /**
     * True only when the keypad was actually used. An existing target must
     * otherwise stand as stored: what is on screen is that target *converted*
     * into the ledger's currency, and writing it back would restate a EUR 1,000
     * goal as EUR 1,100.
     *
     * Tracked as an interaction rather than inferred by comparing the figure with
     * the stored one — the sheet seeds its keypad through `numberToNumpad`, which
     * rounds to the currency's minor units, so a converted target carrying finer
     * precision than that would never compare equal and every commit would read
     * as an edit. Mirrors `LimitCommit.limitChanged`.
     */
    targetChanged: boolean;
    /**
     * True only when the date was picked. An untouched deadline must not travel
     * into the patch at all: the sheet holds the one it opened on, and a peer can
     * move it while the sheet is up — writing the snapshot back would revert them
     * over an edit that never touched it.
     */
    dateChanged: boolean;
    targetDate: Date;
}

interface GoalTargetSheetProps {
    onCommit: (commit: GoalCommit) => Promise<void> | void;
    ref?: Ref<BottomSheetModal>;
    /** Null while nothing is being set; the sheet then has nothing to state. */
    target: GoalTarget | null;
}

/** Six months out: far enough that the monthly figure is a decision, not a shock. */
const DEFAULT_HORIZON_MONTHS = 6;

const STATED = "font-sans-medium text-[19px] leading-[28px] tracking-tight text-grammar";

/**
 * Setting a goal, stated and then placed.
 *
 * Presented over the tab rather than pushed, for the reason the budget sheet is:
 * the figures it changes are the ones behind it. There is no goal form — every
 * fact after this one commit is edited on the goal's own screen, where it is read.
 */
export function GoalTargetSheet({ target, onCommit, ref }: GoalTargetSheetProps) {
    const sheetSurface = useSheetSurface();
    // Bumped as the sheet closes, so a dismissed draft is never what the next
    // presentation opens on — same contract as the budget limit sheet.
    const [presentation, setPresentation] = useState(0);

    return (
        <BottomSheetModal
            backgroundStyle={{ backgroundColor: sheetSurface }}
            enableDynamicSizing
            enablePanDownToClose
            onDismiss={() => setPresentation((count) => count + 1)}
            ref={ref}
        >
            {/* Sized to its content: a root that doesn't flex (chrome contract 1b). */}
            <SheetGestureRoot style={{}}>
                <BottomSheetView style={{ paddingBottom: 28, paddingTop: 14 }}>
                    {target ? (
                        <GoalTargetBody
                            // A fresh body per account, per stored figure and per
                            // presentation: a dismissed draft must not be what the next
                            // one opens on.
                            key={`${target.accountId}:${target.existing?.targetAmount ?? "new"}:${presentation}`}
                            onCommit={onCommit}
                            target={target}
                        />
                    ) : null}
                </BottomSheetView>
            </SheetGestureRoot>
        </BottomSheetModal>
    );
}

/** The later of the two, so a floor lowered for rendering cannot be selected into. */
function notBefore(picked: Date, floor: Date): Date {
    return picked < floor ? floor : picked;
}

function GoalTargetBody({ target, onCommit }: { onCommit: GoalTargetSheetProps["onCommit"]; target: GoalTarget }) {
    const t = useTranslation();
    const { language } = useLanguage();
    const haptics = useHaptics();
    const nowMs = useNow();
    const minorUnits = minorUnitsFor(target.currency);
    const money = (value: number) => formatAmount(value, target.currency, false, language);

    const [mode, setMode] = useState<"amount" | "date">("amount");
    const [entry, setEntry] = useState(() => numberToNumpad(target.existing?.targetAmount ?? 0, minorUnits));
    /** Whether the keypad was used at all. A goal being created is always an edit. */
    const [edited, setEdited] = useState(target.existing == null);
    /** Whether the DATE was picked. An untouched one is committed as it stands. */
    const [dateEdited, setDateEdited] = useState(target.existing == null);
    const [date, setDate] = useState(() => {
        if (target.existing) {
            return target.existing.targetDate;
        }
        return addLocalMonths(Date.now(), DEFAULT_HORIZON_MONTHS);
    });

    const amount = numpadToNumber(entry);
    // Shown only when there are any, so a round target stays clean and a typed one
    // is never rounded away. The keypad's own display is off — this figure IS the
    // display — and in pre-dotted entry the trailing digits are minor units, so
    // hiding them let `123` read as "$1" and commit 1.23.
    //
    // Scaled by the currency's OWN exponent, not by a hard-coded 100: a
    // three-decimal currency like KWD would otherwise show "KWD 1" for 1.001.
    const scale = 10 ** minorUnits;
    const hasMinorUnits = minorUnits > 0 && Math.round(amount * scale) % scale !== 0;
    /** The figure as typed. `money` is for the derived lines, which stay whole. */
    const typed = (value: number) => formatAmount(value, target.currency, hasMinorUnits, language);

    // Tomorrow at the earliest: a goal due today has no month to hold a pace over,
    // which is the one thing the goal is for.
    const range = useMemo(() => {
        const start = tomorrowLocal(nowMs);
        // An existing date already in the past stays selectable, so re-setting the
        // amount does not silently move a deadline the owner did not touch.
        return { start: target.existing && target.existing.targetDate < start ? target.existing.targetDate : start };
    }, [target.existing, nowMs]);

    /** A write in flight, not one already made — the sheet outlives its dismissal. */
    const inFlight = useRef(false);

    const commit = async () => {
        if (amount <= 0) {
            setMode("amount");
            return;
        }
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        const write = async () => {
            // Re-clamped here, not only where it is picked: the sheet can sit open
            // across midnight, at which point yesterday's "tomorrow" is today and
            // the change handler that would have caught it never runs again.
            //
            // Only a date the reader actually chose, though. An overdue goal opened
            // to change its amount still holds its old deadline, and clamping that
            // would move it to tomorrow — rewriting the one fact this visit never
            // touched, and recomputing the whole pace from it.
            await onCommit({
                dateChanged: dateEdited,
                startAmount: target.balance ?? 0,
                targetAmount: amount,
                targetChanged: edited,
                targetDate: dateEdited ? notBefore(date, tomorrowLocal(nowMs)) : date,
            });
        };
        await write().finally(() => {
            inFlight.current = false;
        });
    };

    // The same measure the goal will report once it exists, asked here of the
    // figure being typed — so the cost is on screen before it is committed to.
    const { pace } = goalProgress(
        target.balance ?? 0,
        amount,
        {
            startAmount: target.balance ?? 0,
            startDate: new Date(),
            targetDate: date,
        },
        minorUnits
    );

    // What the figure being typed costs, stated before it is committed to. Until
    // there is one, the line explains what a goal is instead.
    const demand = (() => {
        // Without a balance in this currency there is no gap to pace out, so the
        // sheet states what a goal is instead of a figure it cannot stand behind.
        if (target.balance === null || pace == null || amount <= 0) {
            return t("goals.empty.body");
        }
        if (pace.monthsLeft === 0) {
            return t("goals.sheet.demandsNow", { amount: money(pace.perMonth) });
        }
        return t("goals.sheet.demands", { amount: money(pace.perMonth), months: pace.monthsLeft });
    })();

    return (
        <View>
            <View className="px-5">
                <Sentence
                    slots={{
                        account: <Text className={cn(STATED, "text-foreground")}>{target.name}</Text>,
                        amount: (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected: mode === "amount" }}
                                onPress={() => setMode("amount")}
                            >
                                <Text
                                    className={cn(
                                        STATED,
                                        mode === "amount" ? "text-tint border-tint border-b-[1.5px]" : "text-foreground"
                                    )}
                                >
                                    {amount > 0 ? typed(amount) : t("goals.sheet.amountBlank")}
                                </Text>
                            </Pressable>
                        ),
                        date: (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected: mode === "date" }}
                                onPress={() => {
                                    haptics("selection");
                                    setMode("date");
                                }}
                            >
                                <Text
                                    className={cn(
                                        STATED,
                                        mode === "date" ? "text-tint border-tint border-b-[1.5px]" : "text-tint"
                                    )}
                                >
                                    {formatTargetMonth(date, language)}
                                </Text>
                            </Pressable>
                        ),
                    }}
                    template={t("goals.sheet.stated")}
                    textClassName={STATED}
                />

                <View className="flex-row items-baseline justify-between pt-3">
                    <Pressable
                        accessibilityLabel={t("goals.sheet.editTargetA11y")}
                        accessibilityRole="button"
                        onPress={() => setMode("amount")}
                    >
                        <HeroNumber
                            amount={amount}
                            code={target.currency}
                            showCents={hasMinorUnits}
                            sign=""
                            size={40}
                        />
                    </Pressable>
                    {target.balance === null ? null : (
                        <MonoLabel>{t("goals.sheet.holds", { amount: money(target.balance) }).toUpperCase()}</MonoLabel>
                    )}
                </View>
            </View>

            {mode === "amount" ? (
                // Keyed, because both branches are an `Animated.View` in the same
                // position: without one React reconciles in place and the entrance
                // never runs.
                <Animated.View className="px-5 pt-4" entering={revealEntering()} key="pad">
                    <AmountNumpad
                        code={target.currency}
                        minorUnits={minorUnits}
                        onChange={(next) => {
                            setEdited(true);
                            setEntry(next);
                        }}
                        showDisplay={false}
                        value={entry}
                    />
                </Animated.View>
            ) : (
                <Animated.View className="px-5 pt-2" entering={revealEntering()} key="date">
                    <CompactDatePicker
                        height={44}
                        label={t("goals.editor.by")}
                        // Clamped, not merely bounded: an existing deadline already in
                        // the past lowers the range's floor so it can render at all,
                        // which would otherwise let any day between then and now be
                        // chosen afresh.
                        onChange={(next) => {
                            setDateEdited(true);
                            setDate(notBefore(next, tomorrowLocal(nowMs)));
                        }}
                        range={range}
                        value={date}
                    />
                </Animated.View>
            )}

            <View className="px-5 pt-5">
                <Text className="text-footnote text-muted border-border border-t pt-2.5 leading-snug">{demand}</Text>
                {/* Never inert: a target of nothing is one not typed yet, and the
				    button that says so is the one being pressed. */}
                <View className="mt-3">
                    <SheetCommitButton
                        label={t(target.existing ? "goals.sheet.save" : "goals.sheet.commit")}
                        onPress={commit}
                    />
                </View>
            </View>
        </View>
    );
}
