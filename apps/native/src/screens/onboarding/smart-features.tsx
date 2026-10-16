import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { AiConsentDetails } from "@/components/ai-consent";
import { FirstRun } from "@/components/first-run";
import { useDatabase } from "@/contexts/local-data-context";
import { setBoolSetting } from "@/data/settings-core";
import { useTranslation } from "@/i18n/context";

/**
 * Asks before anything goes to xAI, on the first launch and before an account
 * exists, so the answer is in place by the time a feature could send. Either
 * answer moves on; Not now is asked again when Speak or Scan is opened.
 */
export function OnboardingSmartFeatures() {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();

    const answer = (allowed: boolean) => {
        setBoolSetting(db, "aiConsent", allowed)
            .then(() => router.push("/onboarding/rhythm"))
            .catch((cause: unknown) => {
                console.error("Saving the xAI consent failed", cause);
                router.push("/onboarding/rhythm");
            });
    };

    return (
        <FirstRun
            action={{ label: t("aiConsent.allow"), onPress: () => answer(true) }}
            body={t("aiConsent.lead")}
            eyebrow={t("aiConsent.eyebrow")}
            skip={{ label: t("aiConsent.notNow"), onPress: () => answer(false) }}
            title={t("aiConsent.title")}
        >
            {/* Sized to the rows and scrolling only when large text outgrows the stage. */}
            <ScrollView className="shrink grow-0">
                <AiConsentDetails />
            </ScrollView>
        </FirstRun>
    );
}
