import ArrowLeft01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowLeft01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import Animated, { Easing, Keyframe, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "@/components/glass-button";
import { FontScaleCapContext, Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useColors } from "@/theme/use-colors";

/**
 * The app's motion curve. Restated rather than imported because
 * `../../sentence/sentence-motion.ts` keeps its `EASE` module-private; that file
 * owns the value, and this must not drift from it.
 */
const EASE = Easing.bezier(0.645, 0.045, 0.355, 1);

const SWAP_MS = 240;

const LABEL_MS = 160;

/** How far the incoming body travels, in the direction of travel. */
const SLIDE = 8;

/** The design's own bottom padding, before any home-indicator inset. */
const BOTTOM_PAD = 30;

/**
 * While the keyboard is up it covers the home indicator, so reserving the inset
 * for it only pushes the footer under the keyboard instead. Measured on the
 * merchant step: the button was clipped by about that inset and nothing else.
 */
const KEYBOARD_BOTTOM_PAD = 12;

function useKeyboardShown(): boolean {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener("keyboardWillShow", () => setShown(true));
        const hide = Keyboard.addListener("keyboardWillHide", () => setShown(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return shown;
}

/**
 * Matches the header's own ✕ and ✓, which are 38pt circles. A bare chevron beside
 * a title was the smallest control on a screen whose other two are a 38pt circle
 * and a 52pt bar, and it reads as decoration rather than as the way back.
 */
const BACK_GLYPH = 19;

const STAGE_FONT_SCALE_CAP = 1.35;

/**
 * A body arriving where another already was. No `exiting` partner on purpose:
 * Reanimated keeps an exiting view mounted, and two bodies inside a
 * bottom-pinned container would hold the stage at both heights for the length of
 * the fade — the taller one wins and the surface jumps when it finally leaves.
 */
function stageBodyEntering(forward: boolean) {
    return new Keyframe({
        0: { opacity: 0, transform: [{ translateX: forward ? SLIDE : -SLIDE }] },
        100: { easing: EASE, opacity: 1, transform: [{ translateX: 0 }] },
    })
        .duration(SWAP_MS)
        .reduceMotion(ReduceMotion.System);
}

/** The label alone cross-fades; the button around it is a fixed box either way. */
const FOOTER_LABEL_ENTERING = new Keyframe({
    0: { opacity: 0 },
    100: { easing: EASE, opacity: 1 },
})
    .duration(LABEL_MS)
    .reduceMotion(ReduceMotion.System);

/**
 * `primary` is the committing button. `muted` is the same button while the entry
 * is not whole yet — it is never `disabled`, because a press that cannot save
 * still has to be able to say what is missing.
 */
type StageTone = "muted" | "primary";

const FOOTER_FILL = {
    muted: "bg-surface-secondary",
    primary: "bg-tint",
} as const satisfies Record<StageTone, string>;

/**
 * `text-accent-foreground` stands in for the design's literal white: it is
 * paper in light and ink in dark, which is the readable side of both `--tint`
 * and `--surface-secondary`. A literal white is enumerated per file by
 * `src/theme/token-contrast.test.ts`, which this must not have to edit.
 */
const FOOTER_INK = {
    muted: "text-muted",
    primary: "text-accent-foreground",
} as const satisfies Record<StageTone, string>;

export interface StageAction {
    label: string;
    onPress: () => void;
}

export type StageFooter = StageAction & { tone?: StageTone };

interface StageContentProps {
    children: ReactNode;
    footer?: StageFooter;
    /** Direction of travel. The body slides in from the side it came from. */
    forward?: boolean;
    /**
     * Trailing meta the stage only draws. Split from {@link StageContentProps.rightAction}
     * rather than accepting either shape under one name: a `ReactNode` and a
     * `{ label, onPress }` are not distinguishable at runtime without inspecting
     * the value, and a plain string would land on the wrong branch.
     */
    right?: ReactNode;
    /** Trailing meta the stage draws as its own tap target. Wins over `right`. */
    rightAction?: StageAction;
    /** Identity of the body. A change swaps it, animating the arrival. */
    stepKey: string;
    /**
     * Absent on the amount step: the sentence above already states the amount, so
     * naming the field again is the one redundant word on the surface.
     */
    title?: string;
}

/** The chevron's accessibility label is only meaningful when there is a chevron. */
type StageBackProps = { backLabel: string; onBack: () => void } | { backLabel?: never; onBack?: never };

export type TransactionStageProps = StageBackProps & StageContentProps;

/**
 * A trailing action is a glass pill at the back chevron's height, not a bare
 * label. The header above this surface carries 38pt circles and the footer below
 * it a 52pt bar; a tint word between them read as the smallest thing on screen
 * and was easy to miss.
 */
function StageRightMeta({ action, node }: { action?: StageAction; node?: ReactNode }) {
    if (action) {
        return (
            <View className="ml-auto">
                <GlassButton
                    accessibilityLabel={action.label}
                    className="h-[38px] rounded-full px-4"
                    onPress={action.onPress}
                >
                    <Text className="font-sans-semibold text-subtitle text-tint">{action.label}</Text>
                </GlassButton>
            </View>
        );
    }
    if (node == null) {
        return null;
    }
    return <View className="ml-auto">{node}</View>;
}

/**
 * The one surface pinned to the bottom of the transaction form. Nothing is
 * presented over the form any more: `transactions/create` is itself a modal, and
 * a native sheet over it insets the parent and drops it from the accessibility
 * tree.
 *
 * Pure: every string arrives as a prop and every action is a callback, so the
 * same container serves whichever step the form is on.
 */
export function TransactionStage({
    backLabel,
    children,
    footer,
    forward = true,
    onBack,
    right,
    rightAction,
    stepKey,
    title,
}: TransactionStageProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const keyboardShown = useKeyboardShown();
    const tone = footer?.tone ?? "primary";

    return (
        <FontScaleCapContext value={STAGE_FONT_SCALE_CAP}>
            <View
                className="border-separator bg-background border-t px-5 pt-[15px]"
                // Nothing presents this surface, so it clears the home indicator on
                // its own rather than inheriting a parent's inset.
                style={{ paddingBottom: keyboardShown ? KEYBOARD_BOTTOM_PAD : Math.max(BOTTOM_PAD, insets.bottom) }}
            >
                {/* Centred the way the sheet's own header above it is, rather than
                trailing the back chevron: laid out in the flow the title would sit
                in a different place on every step, depending on whether that step
                has a chevron and what its trailing control is. Absolute keeps it on
                the screen's centre line; `pointerEvents` keeps it from covering the
                two controls it sits between. */}
                <View className="h-[38px] flex-row items-center">
                    {onBack ? (
                        <GlassButton
                            accessibilityLabel={backLabel}
                            className="h-[38px] w-[38px] rounded-full"
                            onPress={onBack}
                        >
                            <HugeiconsIcon color={colors.foreground} icon={ArrowLeft01Icon} size={BACK_GLYPH} />
                        </GlassButton>
                    ) : null}
                    {title == null ? null : (
                        <View className="absolute right-0 left-0 items-center" pointerEvents="none">
                            <Text className="font-sans-semibold text-foreground text-callout">{title}</Text>
                        </View>
                    )}
                    <StageRightMeta action={rightAction} node={right} />
                </View>

                {/* The header used to sit directly on the body, so a keypad read as one
                block with the control above it. */}
                <Animated.View className="pt-3" entering={stageBodyEntering(forward)} key={stepKey} testID="stage-body">
                    {children}
                </Animated.View>

                {/* The keyboard replaces this button: a step with a text field cannot fit
                both above the keyboard, and return already does the same job. */}
                {footer && !keyboardShown ? (
                    <Pressable
                        accessibilityLabel={footer.label}
                        accessibilityRole="button"
                        className={cn(
                            "mt-4 h-[48px] items-center justify-center rounded-[14px] active:opacity-80",
                            FOOTER_FILL[tone]
                        )}
                        onPress={footer.onPress}
                        testID="stage-footer"
                    >
                        <Animated.View entering={FOOTER_LABEL_ENTERING} key={footer.label}>
                            <Text className={cn("font-sans-semibold text-callout", FOOTER_INK[tone])}>
                                {footer.label}
                            </Text>
                        </Animated.View>
                    </Pressable>
                ) : null}
            </View>
        </FontScaleCapContext>
    );
}
