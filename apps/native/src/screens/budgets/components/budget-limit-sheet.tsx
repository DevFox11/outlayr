import { BottomSheetModal, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { useState } from "react";
import type { Ref } from "react";

import type { ExpenseContribution } from "@/data/budget-spent";
import { useColors } from "@/theme/use-colors";

import { BudgetLimitBody } from "./budget-limit-body";
import type { LimitCommit, LimitTarget } from "./budget-limit-body";

interface BudgetLimitSheetProps {
    calendar: { firstDayOfMonth: number; firstWeekday: number };
    contributions: readonly ExpenseContribution[];
    currency: string;
    nowMs: number;
    onCommit: (commit: LimitCommit) => void;
    ref?: Ref<BottomSheetModal>;
    /** Null while nothing is being set; the sheet then has nothing to measure. */
    target: LimitTarget | null;
}

/**
 * The one surface a limit is set on, new or existing.
 *
 * Presented over whatever screen asked for it rather than pushed, because the
 * figures it changes are the ones behind it: the tab's head, the card, the
 * detail hero. A screen of its own would hide the thing being decided.
 */
export function BudgetLimitSheet({
    target,
    contributions,
    currency,
    nowMs,
    calendar,
    onCommit,
    ref,
}: BudgetLimitSheetProps) {
    const colors = useColors();
    // Bumped as the sheet closes, so the body below is thrown away rather than
    // kept: its cadence, its figure and whatever the keypad was half-way through
    // are a draft of one presentation, and a dismissed draft must not be what the
    // next one opens on.
    const [presentation, setPresentation] = useState(0);

    return (
        <BottomSheetModal
            backgroundStyle={{ backgroundColor: colors.background }}
            enableDynamicSizing
            enablePanDownToClose
            onDismiss={() => setPresentation((count) => count + 1)}
            ref={ref}
        >
            <BottomSheetView style={{ paddingBottom: 28, paddingTop: 14 }}>
                {target ? (
                    <BudgetLimitBody
                        calendar={calendar}
                        contributions={contributions}
                        currency={currency}
                        // A fresh body per scope, cadence, limit and presentation. The
                        // cadence and the limit are in the key because the editor behind
                        // this sheet can change either — and on a foreign-currency budget
                        // the limit also moves when the anchor does, since it is valued at
                        // the window's opening-day rate.
                        key={`${target.categoryId ?? "everything"}:${target.type}:${target.limit}:${presentation}`}
                        nowMs={nowMs}
                        onCommit={onCommit}
                        target={target}
                    />
                ) : null}
            </BottomSheetView>
        </BottomSheetModal>
    );
}
