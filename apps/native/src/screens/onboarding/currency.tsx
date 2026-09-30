import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { currencyDisplayFor } from "@outlayr/money/currency";
import { useForm, useSelector } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { CurrencyPickerSheet } from "@/components/currency-picker-sheet";
import { FirstRun } from "@/components/first-run";
import { holdSubmitting, pressSubmitWith } from "@/components/form/submit-guard";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { finishOnboarding } from "@/data/onboarding-core";
import { setCurrency } from "@/data/settings-core";
import { useTranslation } from "@/i18n/context";
import { notifyFailure } from "@/lib/notify";
import { posthog } from "@/lib/posthog";

type CommitKind = "continue" | "finish";

// Named so the form's submit-meta type is the union rather than whichever
// literal the default happened to be.
const CONTINUE: CommitKind = "continue";
const FINISH: CommitKind = "finish";

const EASE_OUT = Easing.bezier(0.19, 1, 0.22, 1);

/**
 * The stage object: the chosen currency's symbol at display size, flipping on
 * its vertical axis when the pick changes — the glyph turns over like a coin,
 * with the label swapped at the 90° edge where the face is invisible.
 */
function CurrencyGlyph({ symbol }: { symbol: string }) {
    const reduced = useReducedMotion();
    const [spun, setSpun] = useState(symbol);
    // Reduced motion has no edge to swap at, so the glyph is just the symbol —
    // derived rather than written back from the effect below.
    const shown = reduced ? symbol : spun;
    const spin = useSharedValue(0);

    useEffect(() => {
        if (reduced || symbol === shown) {
            return;
        }
        const commit = (next: string) => {
            setSpun(next);
            spin.set(-90);
            spin.set(withTiming(0, { duration: 320, easing: EASE_OUT }));
        };
        spin.set(
            withTiming(90, { duration: 160, easing: Easing.in(Easing.ease) }, (finished) => {
                if (finished) {
                    runOnJS(commit)(symbol);
                }
            })
        );
    }, [symbol, shown, reduced, spin]);

    const style = useAnimatedStyle(() => ({
        transform: [{ perspective: 600 }, { rotateY: `${spin.get()}deg` }],
    }));

    return (
        <Animated.View style={style}>
            <Text
                adjustsFontSizeToFit
                className="font-sans-bold text-fr-ink w-56 text-center text-[104px] leading-[116px]"
                numberOfLines={1}
            >
                {shown}
            </Text>
        </Animated.View>
    );
}

export function OnboardingCurrency() {
    const db = useDatabase();
    const router = useRouter();
    const stored = useGlobalCurrency(db);
    const sheet = useRef<BottomSheetModal>(null);
    const t = useTranslation();

    const [initialValues] = useState<{ picked: string | null }>(() => ({ picked: null }));
    const form = useForm({
        defaultValues: initialValues,
        onSubmit: async ({ value, meta }) => {
            const code = value.picked ?? stored;
            try {
                await setCurrency(db, code);
                if (meta === "continue") {
                    // The root guard does not swap on this write alone — grounding is
                    // next, so this screen has to push there itself.
                    router.push("/onboarding/grounding");
                } else {
                    // Nothing navigates on success here: `finishOnboarding` settles the
                    // root guard, which swaps this stack for sign-in. Pushing as well
                    // would race it.
                    await finishOnboarding(db);
                }
                posthog?.capture("onboarding_currency_saved", { onboarding_path: meta });
                return await holdSubmitting();
            } catch (error) {
                // A toast, unlike its sheet-bound siblings: onboarding is a plain
                // pushed route, so nothing covers the viewport at the app root.
                console.error("Failed to save the onboarding currency", error);
                notifyFailure({
                    body: t("onboarding.currency.saveFailed.body"),
                    title: t("onboarding.currency.saveFailed.title"),
                });
            }
        },
        onSubmitMeta: CONTINUE,
    });
    const { picked } = useSelector(form.store, (s) => s.values);
    const isSubmitting = useSelector(form.store, (s) => s.isSubmitting);

    const code = picked ?? stored;
    const display = currencyDisplayFor(code);

    return (
        <FirstRun
            action={{
                disabled: isSubmitting,
                label: isSubmitting ? t("onboarding.currency.saving") : t("common.continue"),
                onPress: () => pressSubmitWith(form, CONTINUE),
            }}
            body={t("onboarding.currency.body")}
            eyebrow={t("onboarding.currency.eyebrow")}
            object={<CurrencyGlyph symbol={display.symbol} />}
            skip={{
                label: t("onboarding.currency.shortcut"),
                onPress: () => pressSubmitWith(form, FINISH),
            }}
            title={t("onboarding.currency.title")}
        >
            <Pressable
                accessibilityHint={t("onboarding.currency.openHint")}
                accessibilityRole="button"
                className="border-fr-rule bg-fr-card flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 active:opacity-60"
                onPress={() => sheet.current?.present()}
            >
                <Text className="text-fr-muted text-headline w-8 text-center">{display.symbol}</Text>
                <View className="flex-1 gap-0.5">
                    <Text className="font-sans-semibold text-body text-fr-ink">{code}</Text>
                    <Text className="text-footnote text-fr-muted" numberOfLines={1}>
                        {display.name}
                    </Text>
                </View>
                <MonoLabel className="text-fr-muted">{t("onboarding.currency.change")}</MonoLabel>
            </Pressable>

            <CurrencyPickerSheet
                onSelect={(next) => {
                    form.setFieldValue("picked", next);
                    sheet.current?.dismiss();
                }}
                ref={sheet}
                selected={code}
            />
        </FirstRun>
    );
}
