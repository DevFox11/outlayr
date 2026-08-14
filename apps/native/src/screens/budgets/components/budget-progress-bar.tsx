import { View } from "react-native";

import { cn, tv } from "@/components/tw";
import { budgetRail } from "@/domain/budget-math";

interface BudgetProgressBarProps {
    height?: number;
    limit: number;
    /** True when spending has outrun the clock. */
    paceBehind?: boolean;
    /** Fraction of period time remaining, or null to hide the pace marker. */
    paceRemaining?: number | null;
    spent: number;
    /**
     * The budget's category colour, drawn as the fill. Omitted by the overall
     * budget, which spans every category and so answers in ink. Ignored once the
     * budget is over: past the limit the rail is stating a verdict, not naming a
     * category, and that verdict is the only thing it is allowed to say.
     */
    tint?: string | null;
}

const rail = tv({
    base: "w-full overflow-hidden rounded-full",
    variants: {
        over: { false: "bg-rail-track", true: "bg-rail-over" },
    },
});

const railFill = tv({
    base: "h-full rounded-full",
    variants: {
        over: { false: "bg-foreground", true: "bg-over-budget" },
    },
});

/** The arithmetic lives in `budgetRail`. */
export function BudgetProgressBar({
    spent,
    limit,
    paceRemaining = null,
    paceBehind = false,
    height = 6,
    tint = null,
}: BudgetProgressBarProps) {
    const { fill: pct, over } = budgetRail(spent, limit);
    // The pace triangle reads against the limit; over budget the rail is no
    // longer drawn to that scale, so it has nothing to point at.
    const showMarker = !over && paceRemaining != null && paceRemaining > 0 && paceRemaining < 1;

    return (
        <View className={cn("relative", showMarker ? "pt-[9px]" : "pt-0")}>
            {showMarker && paceRemaining != null ? (
                <View
                    className={cn(
                        "absolute top-0 size-0 -translate-x-1.5 border-t-[7px] border-r-[6px] border-l-[6px] border-r-transparent border-l-transparent",
                        paceBehind ? "border-t-over-budget" : "border-t-foreground"
                    )}
                    style={{ left: `${paceRemaining * 100}%` }}
                />
            ) : null}
            <View className={rail({ over })} style={{ height }}>
                <View
                    className={railFill({ over })}
                    style={
                        over || tint == null
                            ? { width: `${pct * 100}%` }
                            : { backgroundColor: tint, width: `${pct * 100}%` }
                    }
                />
            </View>
        </View>
    );
}
