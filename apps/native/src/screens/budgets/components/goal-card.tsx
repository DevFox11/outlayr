import { Canvas, Path as SkPath } from "@shopify/react-native-skia";
import { Pressable, View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { SavingsGoalWithProgress } from "@/data/savings-goals";
import { formatTargetMonth } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

interface GoalCardProps {
    currency: string;
    entry: SavingsGoalWithProgress;
    onPress: (id: string) => void;
    /** Measured by the grid; null on the first frame, before any layout. */
    width: number | null;
}

const ARC = { radius: 19, size: 46, stroke: 4 } as const;

/**
 * One goal in the grid under the budgets.
 *
 * An arc rather than a bar, and open at the bottom rather than a closed ring: a
 * budget's ring is a container being filled up to a ceiling, a goal's arc is a
 * climb toward a mark. They must not read as the same instrument, because a full
 * budget ring is bad news and a full goal arc is the point.
 */
export function GoalCard({ currency, entry, onPress, width }: GoalCardProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const colors = useColors();

    const { exact, goal, progress, saved, target } = entry;
    // Reached is a comparison like any other here, so it only counts when the two
    // figures could be compared: an unconverted EUR 1,000 target is "met" by a GBP
    // 1,000 balance, and the card would dim as done beside its own "No rate yet".
    const reached = exact && progress.reached;
    const money = (value: number) => formatAmount(value, currency, showCents, language);
    const percent = Math.round(progress.fraction * 100);
    const { standing } = progress;
    const onPace = standing?.onPace ?? false;
    // Null when the goal has no line to be measured against, which is not the same
    // as being in front of one — `?? 0 >= 0` would have called that ahead.
    const ahead = onPace || (standing != null && standing.against >= 0);
    const tone = arcTone(reached, ahead, colors);
    const word = standingWord(reached, standing != null, onPace, ahead, t);

    return (
        <Pressable
            accessibilityHint={t("goals.a11y.openHint")}
            // The same branch the visible card takes. Reading out a percentage, a
            // balance and a target drawn from two currencies — or announcing a goal
            // as reached — is the failure this withholds, not a smaller one for
            // being spoken rather than drawn.
            accessibilityLabel={
                exact
                    ? t("goals.a11y.card", {
                          name: goal.name,
                          percent: String(percent),
                          saved: money(saved),
                          standing: word ?? t("goals.a11y.noStanding"),
                          target: money(target),
                      })
                    : t("goals.a11y.unvalued", { name: goal.name })
            }
            accessibilityRole="button"
            className={cn("border-border gap-2.5 rounded-2xl border p-3.5 active:opacity-70", reached && "opacity-60")}
            onPress={() => onPress(goal.id)}
            style={width === null ? { flex: 1 } : { width }}
        >
            <View className="flex-row items-start justify-between">
                <GoalArc fraction={exact ? progress.fraction : 0} tone={tone} />
                {exact ? (
                    <Text
                        className="text-micro text-muted font-mono"
                        numberOfLines={1}
                        style={{ fontVariant: ["tabular-nums"] }}
                    >
                        {`${percent}%`}
                    </Text>
                ) : null}
            </View>

            <Text className="font-sans-semibold text-subtitle text-foreground" numberOfLines={1}>
                {goal.name}
            </Text>

            {exact ? null : (
                // Every figure below measures the balance against the target, and one
                // of the two is not in the currency the other is stated in. A
                // percentage or a remainder read off that pair would be a precise
                // answer to a comparison nobody made.
                <MonoLabel numberOfLines={2}>{t("goals.card.unvalued")}</MonoLabel>
            )}

            <View className={exact ? undefined : "hidden"}>
                <Text
                    className={cn("font-sans-semibold text-body", reached ? "text-income" : "text-foreground")}
                    numberOfLines={1}
                    style={{ fontVariant: ["tabular-nums"] }}
                >
                    {reached ? money(saved) : money(progress.remaining)}
                </Text>
                <MonoLabel numberOfLines={1}>
                    {reached
                        ? t("goals.reached")
                        : `${t("goals.toGo")} · ${formatTargetMonth(goal.targetDate, language)}`}
                </MonoLabel>
            </View>

            {exact && progress.pace ? (
                <MonoLabel className={paceTone(word != null, onPace, ahead)} numberOfLines={1}>
                    {word
                        ? `${t("goals.pace", { amount: money(progress.pace.perMonth) })} · ${word}`
                        : t("goals.pace", { amount: money(progress.pace.perMonth) })}
                </MonoLabel>
            ) : null}
        </Pressable>
    );
}

/** The one word under the figure: reached, on pace, ahead, or behind. */
function standingWord(
    reached: boolean,
    measured: boolean,
    onPace: boolean,
    ahead: boolean,
    t: ReturnType<typeof useTranslation>
): string | null {
    if (reached) {
        return t("goals.reached");
    }
    // Nothing to say rather than something wrong: the card states the pace alone.
    if (!measured) {
        return null;
    }
    if (onPace) {
        return t("goals.onPace");
    }
    return ahead ? t("goals.ahead") : t("goals.behind");
}

/** On pace is stated, not praised: only a real lead or a real shortfall takes colour. */
function paceTone(measured: boolean, onPace: boolean, ahead: boolean): string {
    if (onPace || !measured) {
        return "text-muted";
    }
    return ahead ? "text-income" : "text-over-budget";
}

/** Reached reads as done, behind as a warning, ahead as the ordinary ink. */
function arcTone(reached: boolean, ahead: boolean, colors: ReturnType<typeof useColors>): string {
    if (reached) {
        return colors.income;
    }
    return ahead ? colors.foreground : colors.overBudget;
}

/**
 * A 270° arc opening at the bottom left, filled clockwise. Skia rather than a
 * view: an arc is a stroked path, and the alternative is two clipped circles.
 */
function GoalArc({ fraction, tone }: { fraction: number; tone: string }) {
    const colors = useColors();
    const center = ARC.size / 2;
    const sweep = 270 * Math.min(1, Math.max(0, fraction));
    const track = arcPath(center, ARC.radius, 135, 270);
    const filled = sweep > 0 ? arcPath(center, ARC.radius, 135, sweep) : null;

    return (
        <Canvas pointerEvents="none" style={{ height: ARC.size, width: ARC.size }}>
            <SkPath color={colors.railTrack} path={track} strokeWidth={ARC.stroke} style="stroke" />
            {filled ? (
                <SkPath color={tone} path={filled} strokeCap="round" strokeWidth={ARC.stroke} style="stroke" />
            ) : null}
        </Canvas>
    );
}

function arcPath(center: number, radius: number, startDegrees: number, sweepDegrees: number): string {
    const toPoint = (degrees: number) => {
        const radians = (degrees * Math.PI) / 180;
        return `${center + radius * Math.cos(radians)} ${center + radius * Math.sin(radians)}`;
    };
    const large = sweepDegrees > 180 ? 1 : 0;
    return `M ${toPoint(startDegrees)} A ${radius} ${radius} 0 ${large} 1 ${toPoint(startDegrees + sweepDegrees)}`;
}
