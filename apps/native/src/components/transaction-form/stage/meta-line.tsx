import { View } from "react-native";

import { Text } from "@/components/text";
import { cn } from "@/components/tw";

type MetaTone = "danger" | "info" | "muted" | "warning";

/**
 * The two panelui tones take their `-foreground` pairs, which is that library's
 * name for the readable side. The warning tone in particular must never take
 * `--warning` itself: that token is a rail and chart fill at 1.51:1 on paper,
 * and `src/theme/token-contrast.test.ts` classifies it as a fill and fails the
 * moment any file writes it as a text utility.
 */
const TONE = {
    danger: "text-danger",
    info: "text-info-foreground",
    muted: "text-muted",
    warning: "text-warning-foreground",
} as const satisfies Record<MetaTone, string>;

interface MetaLineProps {
    /** Mono detail under the statement — a rate, a code, a converted amount. */
    detail?: string;
    /** Trailing qualifier on the statement's own line. */
    qualifier?: string;
    /**
     * Draws the qualifier as the thing to tap rather than as more information.
     * The caller owns the press — a line is either wholly pressable or not at
     * all, so there is no second target hiding inside it.
     */
    qualifierIsAction?: boolean;
    statement: string;
    tone?: MetaTone;
}

/**
 * The only notice anatomy in the app. It replaced a set of tinted, left-accented
 * alert boxes: a hairline, the statement, and colour to carry the urgency —
 * deliberately no fill, no radius, no accent bar and no icon.
 */
export function MetaLine({ detail, qualifier, qualifierIsAction, statement, tone = "muted" }: MetaLineProps) {
    return (
        <View
            // Only the two urgent tones interrupt; an informational line is read
            // in order like any other text.
            accessibilityRole={tone === "danger" || tone === "warning" ? "alert" : undefined}
            className="border-separator border-t pt-2.5"
        >
            <View className="flex-row items-baseline gap-3">
                <Text className={cn("text-footnote flex-1 leading-snug", TONE[tone])}>{statement}</Text>
                {qualifier == null ? null : (
                    <Text
                        className={cn(
                            "text-footnote",
                            qualifierIsAction ? "text-tint font-sans-semibold" : "text-muted"
                        )}
                    >
                        {qualifier}
                    </Text>
                )}
            </View>
            {detail == null ? null : <Text className="text-label text-muted pt-1 font-mono">{detail}</Text>}
        </View>
    );
}
