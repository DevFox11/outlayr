import { useRouter } from "expo-router";
import { Toast } from "panelui-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { formatSentenceDate } from "@/domain/dates";
import { formatWait } from "@/domain/usage-limits";
import type { CaptureFeature, LimitNotice } from "@/hooks/use-usage-limits";
import { useLanguage, useTranslation } from "@/i18n/context";

const COPY = {
    receiptScan: { last: "receipt.limit.last", next: "receipt.limit.next", paused: "receipt.limit.paused" },
    voiceEntry: { last: "voice.limit.last", next: "voice.limit.next", paused: "voice.limit.paused" },
} as const;

const TOP_OFFSET = 72;

export function LimitToast({
    feature,
    notice,
    now,
    pro,
}: {
    feature: CaptureFeature;
    notice: LimitNotice | null;
    now: number;
    pro: boolean;
}) {
    const t = useTranslation();
    const { language } = useLanguage();
    const router = useRouter();

    if (notice === null) {
        return null;
    }

    const copy = COPY[feature];
    const toPro = !pro && (notice.kind === "capturesEmpty" || notice.kind === "capturesLast");
    let title: string;
    let description: string | null = null;
    if (notice.kind === "paused" || notice.kind === "last") {
        title = t(notice.kind === "paused" ? copy.paused : copy.last);
        if (notice.nextAt !== null) {
            description = t(copy.next, { time: formatWait(notice.nextAt - now) });
        }
    } else {
        title = t(notice.kind === "capturesEmpty" ? "settings.usage.toast.empty" : "settings.usage.toast.last");
        if (notice.resetsAt !== null) {
            description = t("settings.usage.toast.moreOn", {
                count: notice.capacity,
                date: formatSentenceDate(new Date(notice.resetsAt), language),
            });
        }
    }

    return (
        <Animated.View
            entering={FadeInUp.duration(220)}
            exiting={FadeOutUp.duration(180)}
            pointerEvents="box-none"
            style={{ left: 16, position: "absolute", right: 16, top: TOP_OFFSET }}
        >
            <Toast variant={notice.kind === "paused" || notice.kind === "capturesEmpty" ? "destructive" : "warning"}>
                <Toast.Indicator />
                <Toast.Content>
                    <Toast.Title>{title}</Toast.Title>
                    {description === null ? null : <Toast.Description>{description}</Toast.Description>}
                </Toast.Content>
                <Toast.Action onPress={() => router.push(toPro ? "/paywall" : "/settings/usage")}>
                    {t(toPro ? "settings.usage.toast.pro" : "settings.usage.toast.usage")}
                </Toast.Action>
            </Toast>
        </Animated.View>
    );
}
