import { useRouter, useSegments } from "expo-router";
import { BottomSheet } from "panelui-native/components/bottom-sheet";
import { Button } from "panelui-native/components/button";
import { cn } from "panelui-native/utils/cn";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppLockOpen } from "@/components/app-lock-gate";
import { useAuthCovered } from "@/components/auth-cover";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useAiConsent } from "@/data/settings";
import { setBoolSetting } from "@/data/settings-core";
import type { AiConsent } from "@/data/settings-core";
import type { Database } from "@/db/client";
import type { TranslationKey } from "@/i18n/catalog";
import { useLanguage, useTranslation } from "@/i18n/context";
import { openInAppBrowser } from "@/lib/app-handoff";
import { useAuthSession } from "@/lib/auth-session";
import { legalUrl } from "@/lib/legal-url";
import { useColors } from "@/theme/use-colors";

/** Every feature that sends data to the AI providers, with what it sends. */
const FEATURES = [
    { sends: "aiConsent.voiceSends", title: "aiConsent.voice" },
    { sends: "aiConsent.scanSends", title: "aiConsent.scan" },
    { sends: "aiConsent.suggestionsSends", title: "aiConsent.suggestions" },
    { sends: "aiConsent.lookupSends", title: "aiConsent.lookup" },
] as const satisfies readonly { sends: TranslationKey; title: TranslationKey }[];

export function recordAiConsent(db: Database, allowed: boolean): void {
    setBoolSetting(db, "aiConsentV2", allowed).catch((cause: unknown) => {
        console.error("Saving the AI consent failed", cause);
    });
}

/** The features, what each sends to the AI providers, and the privacy policy. Shared by every place that asks. */
export function AiConsentDetails() {
    const t = useTranslation();
    const { language } = useLanguage();
    return (
        <View>
            {FEATURES.map((feature, index) => (
                <View
                    className={cn("border-border border-t py-2.5", index === FEATURES.length - 1 && "border-b")}
                    key={feature.title}
                >
                    <Text className="text-body text-foreground">{t(feature.title)}</Text>
                    <Text className="text-footnote text-muted pt-0.5 leading-snug">{t(feature.sends)}</Text>
                </View>
            ))}
            <Text className="text-footnote text-muted pt-3 leading-snug">
                {t("aiConsent.fine")}{" "}
                <Text
                    accessibilityRole="link"
                    className="text-tint"
                    onPress={() => openInAppBrowser(legalUrl("privacy", language))}
                >
                    {t("aiConsent.privacy")}
                </Text>
            </Text>
        </View>
    );
}

function AiConsentPrompt({ onAnswer }: { onAnswer: (allowed: boolean) => void }) {
    const t = useTranslation();
    return (
        <View>
            <Text accessibilityRole="header" className="text-foreground font-sans-semibold text-title">
                {t("aiConsent.title")}
            </Text>
            <Text className="text-muted text-subtitle pt-1 pb-4 leading-snug">{t("aiConsent.lead")}</Text>
            <AiConsentDetails />
            <Button className="mt-5 rounded-full" fullWidth onPress={() => onAnswer(true)} size="md" variant="primary">
                {t("aiConsent.allow")}
            </Button>
            <Button className="mt-2.5 rounded-full" fullWidth onPress={() => onAnswer(false)} size="md" variant="ghost">
                {t("aiConsent.notNow")}
            </Button>
        </View>
    );
}

/**
 * Stands in for voice entry and receipt scan until the AI providers are allowed. It has to
 * come before either screen mounts: voice starts recording on open, and both
 * send on their own once they have a clip or a photo. Not now leaves.
 */
export function AiConsentGate() {
    const db = useDatabase();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const answer = (allowed: boolean) => {
        recordAiConsent(db, allowed);
        if (!allowed) {
            router.back();
        }
    };
    return (
        <ScrollView
            className="bg-background flex-1"
            contentContainerClassName="px-5 pt-8"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
            <AiConsentPrompt onAnswer={answer} />
        </ScrollView>
    );
}

/**
 * Asks once, on the tabs, anyone signed in who has not answered yet: people
 * past onboarding before the question existed, or who skipped its step. A
 * swipe away is Not now. Waits for no cover for the reason `UpdateSheet` does.
 * Mounts once the question is unanswered this run, and stays so an answer animates out.
 */
export function AiConsentSheet() {
    const consent = useAiConsent(useDatabase());
    const [asked, setAsked] = useState(consent === "unanswered");
    if (consent === "unanswered" && !asked) {
        setAsked(true);
    }
    return asked ? <AiConsentSheetBody consent={consent} /> : null;
}

function AiConsentSheetBody({ consent }: { consent: AiConsent }) {
    const db = useDatabase();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const sheetInsets = useMemo(() => ({ ...insets, bottom: 0 }), [insets]);
    const { gate } = useAuthSession();
    const onTabs = useSegments()[0] === "(tabs)";
    const lockOpen = useAppLockOpen();
    const covered = useAuthCovered();

    const open = gate === "signed-in" && consent === "unanswered" && onTabs && lockOpen && !covered;

    return (
        <BottomSheet
            native
            nativeBackground={colors.background}
            onOpenChange={(next) => {
                // Only a swipe the person made: a close this render asked for
                // (an answer landed, a lock came up) is not a Not now.
                if (!next && open) {
                    recordAiConsent(db, false);
                }
            }}
            open={open}
        >
            <SafeAreaInsetsContext.Provider value={sheetInsets}>
                <BottomSheet.Content size="auto">
                    <AiConsentPrompt onAnswer={(allowed) => recordAiConsent(db, allowed)} />
                </BottomSheet.Content>
            </SafeAreaInsetsContext.Provider>
        </BottomSheet>
    );
}
