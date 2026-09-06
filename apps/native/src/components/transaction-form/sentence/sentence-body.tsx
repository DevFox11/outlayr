import DivideSignCircleSolidIcon from "@hugeicons-pro/core-solid-rounded/DivideSignCircleIcon";
import NoteEditSolidIcon from "@hugeicons-pro/core-solid-rounded/NoteEditIcon";
import RepeatSolidIcon from "@hugeicons-pro/core-solid-rounded/RepeatIcon";
import SparklesSolidIcon from "@hugeicons-pro/core-solid-rounded/SparklesIcon";
import Tag01SolidIcon from "@hugeicons-pro/core-solid-rounded/Tag01Icon";
import DivideSignCircleIcon from "@hugeicons-pro/core-stroke-rounded/DivideSignCircleIcon";
import NoteEditIcon from "@hugeicons-pro/core-stroke-rounded/NoteEditIcon";
import RepeatIcon from "@hugeicons-pro/core-stroke-rounded/RepeatIcon";
import SparklesIcon from "@hugeicons-pro/core-stroke-rounded/SparklesIcon";
import Tag01Icon from "@hugeicons-pro/core-stroke-rounded/Tag01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { IconSvgElement } from "@hugeicons/react-native";
import { Chip } from "panelui-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { useColors } from "@/theme/use-colors";

import { revealEntering } from "../../sentence/sentence-motion";
import { cn } from "../../tw";
import type { TransactionSentenceSlot } from "./slots";
import { TransactionSentence } from "./transaction-sentence";
import type { TransactionSentenceLabels } from "./transaction-sentence";

/**
 * The optional facts, and the glyph each states. Stroke while the fact is unset
 * and Solid once it is — the icon carries the same outline-to-fill idea as the
 * chip around it, so the row's state reads before any of its words do.
 */
const FACT_GLYPHS = {
    icon: { set: SparklesSolidIcon, unset: SparklesIcon },
    note: { set: NoteEditSolidIcon, unset: NoteEditIcon },
    repeat: { set: RepeatSolidIcon, unset: RepeatIcon },
    split: { set: DivideSignCircleSolidIcon, unset: DivideSignCircleIcon },
    tags: { set: Tag01SolidIcon, unset: Tag01Icon },
} as const satisfies Record<string, { set: IconSvgElement; unset: IconSvgElement }>;

/** Names a fact, and with it the chip's glyph. */
type SentenceFactKey = keyof typeof FACT_GLYPHS;

/**
 * A set chip is filled with `--tint` in both themes, so what sits on it is
 * literal white in both — the same rule the swipe pills follow.
 */
const ON_TINT = "#ffffff";

const CHIP_ICON = 15;

interface SentenceVerb {
    /** Already set, so the chip states the value and reads as a way back to it. */
    active: boolean;
    /** A fact that cannot be set yet — the split has nothing to divide without an amount. */
    disabled?: boolean;
    key: SentenceFactKey;
    /**
     * Resolved by the caller, and dynamic: once the fact is set this is its
     * VALUE — "2 tags", "monthly", "3 ways" — not the noun that offered it.
     */
    label: string;
    onPress: () => void;
    /** Clears an already-set fact, through the chip's own ✕. */
    onRemove?: () => void;
    removeAccessibilityLabel?: string;
}

interface SentenceBodyProps {
    account: string | null;
    accountTile?: ReactNode;
    /** The slot the stage below is editing, marked in place. */
    activeSlot?: TransactionSentenceSlot | null;
    amount: string | null;
    /**
     * The amount can hold the save back as readily as the category, and a
     * filled one can be the fault: zero is a value, not a blank.
     */
    amountFlagged?: boolean;
    amountShake?: boolean;
    category: string | null;
    categoryFlagged: boolean;
    categoryPending: boolean;
    categoryShake: boolean;
    categoryTile?: ReactNode;
    /**
     * `RNHostView matchContents` resolves an unconstrained child against the
     * SCREEN rather than the padded parent, so the sentence has to be told the
     * box it wraps inside or it bleeds past the form's margins.
     */
    contentWidth: number;
    /**
     * The cross-currency readout, drawn directly under the sentence because it
     * restates the amount the sentence just said. Absent for an entry whose
     * currency has nothing to convert to.
     */
    conversion?: ReactNode;
    /** Short clauses for anything the sentence itself does not carry. */
    extras: readonly string[];
    labels: TransactionSentenceLabels;
    merchant: string | null;
    merchantTile?: ReactNode;
    onAccountPress: () => void;
    /** The first-run line, drawn between the sentence and the chips. */
    coach?: ReactNode;
    onAmountPress: () => void;
    onCategoryPress: () => void;
    onCurrencyPress: () => void;
    onKindPress: () => void;
    onMerchantPress: () => void;
    onWhenPress: () => void;
    verbs: readonly SentenceVerb[];
    when: string;
}

export function TransactionSentenceBody({
    account,
    accountTile,
    activeSlot = null,
    amount,
    amountFlagged,
    amountShake,
    category,
    categoryFlagged,
    categoryPending,
    categoryShake,
    categoryTile,
    coach,
    contentWidth,
    conversion,
    extras,
    labels,
    merchant,
    merchantTile,
    onAccountPress,
    onAmountPress,
    onCategoryPress,
    onCurrencyPress,
    onKindPress,
    onMerchantPress,
    onWhenPress,
    verbs,
    when,
}: SentenceBodyProps) {
    const colors = useColors();

    // `pt-8`: the sentence opens the screen now that the segment above it is gone,
    // so it carries its own distance from the header rather than inheriting the
    // bar's bottom margin.
    return (
        <View className="pt-8" style={{ width: contentWidth }}>
            <TransactionSentence
                account={account}
                accountTile={accountTile}
                activeSlot={activeSlot}
                amount={amount}
                amountFlagged={amountFlagged}
                amountShake={amountShake}
                category={category}
                categoryFlagged={categoryFlagged}
                categoryPending={categoryPending}
                categoryShake={categoryShake}
                categoryTile={categoryTile}
                labels={labels}
                merchant={merchant}
                merchantTile={merchantTile}
                onAccountPress={onAccountPress}
                onAmountPress={onAmountPress}
                onCategoryPress={onCategoryPress}
                onCurrencyPress={onCurrencyPress}
                onKindPress={onKindPress}
                onMerchantPress={onMerchantPress}
                onWhenPress={onWhenPress}
                when={when}
            />

            {conversion === undefined ? null : (
                <Animated.View className="mt-5" entering={revealEntering()}>
                    {conversion}
                </Animated.View>
            )}

            {extras.length > 0 ? (
                <View className="mt-5 gap-1">
                    {extras.map((extra) => (
                        <Animated.Text className="text-muted text-subtitle" entering={revealEntering()} key={extra}>
                            {extra}
                        </Animated.Text>
                    ))}
                </View>
            ) : null}

            {coach === undefined ? null : (
                <Animated.View className="mt-5" entering={revealEntering()}>
                    {coach}
                </Animated.View>
            )}

            {/* `layout` rather than an entering animation per chip: a label that
                becomes its own value changes width, and the row has to close the
                gap without every chip after it jumping. `onClose` is its own hit
                target inside the pill, so clearing a fact no longer needs the ✕
                this bar used to hand-roll beside each verb. */}
            <Animated.View className="mt-7 flex-row flex-wrap gap-2" layout={LinearTransition.duration(240)}>
                {verbs.map((verb) => (
                    <Chip
                        className={cn(
                            "h-[34px] gap-[7px]",
                            verb.active ? "border-tint bg-tint" : "border-separator border-dashed",
                            verb.disabled && "opacity-40"
                        )}
                        closeLabel={verb.removeAccessibilityLabel}
                        disabled={verb.disabled}
                        haptics
                        key={verb.key}
                        // Sized with an arbitrary value on purpose: `text-subtitle`
                        // is this app's token and panelui merges with stock
                        // tailwind-merge, which files an unknown `text-*` as a
                        // COLOUR — so a token size beside `text-muted` is dropped.
                        // Ink on the vermilion fill, not white: measured, literal
                        // white is 3.33:1 on the dark theme's `--tint` and fails
                        // AA. `--accent-foreground` clears it in both themes
                        // (5.48:1 dark, 4.78:1 light) and is what panelui already
                        // paints the ✕ with, so the label and the ✕ finally agree.
                        labelClassName={cn(
                            "font-sans-medium text-[15px] leading-[21px]",
                            verb.active ? "text-accent-foreground" : "text-muted"
                        )}
                        onClose={verb.active ? verb.onRemove : undefined}
                        onPress={verb.onPress}
                        selected={verb.active}
                        // `lg` for its 14pt padding; the height and gap come from
                        // the classes above, which is the whole of the difference.
                        size="lg"
                        start={
                            <HugeiconsIcon
                                color={verb.active ? ON_TINT : colors.muted}
                                icon={verb.active ? FACT_GLYPHS[verb.key].set : FACT_GLYPHS[verb.key].unset}
                                size={CHIP_ICON}
                            />
                        }
                        variant="outline"
                    >
                        {verb.label}
                    </Chip>
                ))}
            </Animated.View>
        </View>
    );
}
