import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { useRevenueCat } from "@/contexts/revenuecat-context";
import { useTranslation } from "@/i18n/context";
import { managementUrl, onCustomerInfoUpdated } from "@/lib/revenuecat";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

import type { StoreTermsProps } from "./store-terms";

export type { StoreTermsProps } from "./store-terms";

/**
 * Where this customer manages their subscription, from RevenueCat: the store
 * that owns it, which is the App Store for one bought on an iPhone. Kept current
 * through RevenueCat's customer updates, so a purchase or a restore made here
 * brings the link with it. Null with nothing to manage: no subscription, or the
 * one-time lifetime purchase.
 */
function useManagementUrl(): string | null {
    const { isConfigured } = useRevenueCat();
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!isConfigured) {
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            const next = await managementUrl().catch(() => null);
            if (!cancelled) {
                setUrl(next);
            }
        };
        void load();
        const stopListening = onCustomerInfoUpdated((customerInfo) => setUrl(customerInfo.managementURL));
        return () => {
            cancelled = true;
            stopListening();
        };
    }, [isConfigured]);

    return url;
}

/**
 * Google Play's terms under the plans, while the selected plan is a
 * subscription (the lifetime plan is a single purchase): a trial turns into a
 * paid subscription unless it's cancelled first, and a subscription renews
 * until it's cancelled. Below them, the way to manage the subscription this
 * customer already has, wherever they bought it.
 */
export function StoreTerms({ plan }: StoreTermsProps) {
    const t = useTranslation();
    const m3 = useMaterialColors();
    const manage = useManagementUrl();
    const renews = plan !== null && plan.kind !== "lifetime";
    const terms = renews
        ? [plan.trialDays === null ? null : t("pro.play.trial"), t("pro.play.renews")].filter(Boolean).join(" ")
        : null;

    if (terms === null && manage === null) {
        return null;
    }
    return (
        <View className="items-center gap-1 px-5 pt-3">
            {terms === null ? null : (
                <Text className="text-caption text-m3-on-surface-variant text-center leading-5">{terms}</Text>
            )}
            {manage === null ? null : (
                <Pressable
                    accessibilityRole="link"
                    android_ripple={{ color: withAlpha(m3.primary, 0.12) }}
                    className="min-h-12 justify-center overflow-hidden rounded-full px-3"
                    onPress={() => Linking.openURL(manage)}
                    testID="paywall-manage"
                >
                    <Text className="font-sans-medium text-caption text-m3-primary">{t("pro.play.manage")}</Text>
                </Pressable>
            )}
        </View>
    );
}
