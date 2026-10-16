import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { ScreenHeader } from "@/components/screen-header";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useSavingsGoal } from "@/data/savings-goals";
import { GoalValuationError, savingsGoalsRepo } from "@/data/savings-goals-core";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import { useTranslation } from "@/i18n/context";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";
import { GoalDetailView } from "@/screens/budgets/components/goal-detail-view";
import { GoalEditor } from "@/screens/budgets/components/goal-editor";
import type { GoalEdit } from "@/screens/budgets/components/goal-editor";
import { GoalTargetSheet } from "@/screens/budgets/components/goal-target-sheet";
import type { GoalCommit, GoalTarget } from "@/screens/budgets/components/goal-target-sheet";

/**
 * A goal, read and edited in the same place.
 *
 * There is no goal form: the target is placed on the same sheet that created it,
 * and every other fact commits from its own row — see `goal-editor.tsx`.
 */
export default function GoalScreen() {
    const router = useRouter();
    const t = useTranslation();
    const db = useDatabase();
    const haptics = useHaptics();
    const nowMs = useNow();
    const currency = useGlobalCurrency(db);
    const { id } = useLocalSearchParams<{ id: string }>();
    const entry = useSavingsGoal(db, id, nowMs);
    const { requestDelete } = useDeferredDelete("goal");

    const targetSheetRef = useRef<BottomSheetModal>(null);
    const [retarget, setRetarget] = useState<GoalTarget | null>(null);

    // Presented from an effect keyed on the target rather than from the row's own
    // handler: this screen builds its editor during render, and a closure reaching
    // for `targetSheetRef.current` reads a ref in render as far as the compiler
    // can tell. Setting state is not.
    useEffect(() => {
        if (retarget) {
            targetSheetRef.current?.present();
        }
    }, [retarget]);

    if (entry == null) {
        return null;
    }

    const { goal } = entry;

    const write = async (patch: Parameters<typeof savingsGoalsRepo.update>[2]) => {
        try {
            await savingsGoalsRepo.update(db, goal.id, patch);
            haptics("success");
        } catch (error) {
            console.error("Failed to save the goal", error);
            // A target that cannot be canonicalised is refused rather than stored
            // against a null, which would read back as the face value in whatever
            // currency the ledger is shown in next.
            notifyFailure(
                error instanceof GoalValuationError
                    ? {
                          body: t("goals.unvalued.body", { account: entry.accountName }),
                          title: t("goals.unvalued.title"),
                      }
                    : { body: t("goals.failedBody"), title: t("goals.failedTitle") }
            );
        }
    };

    /**
     * Each fact commits only when it was actually touched.
     *
     * The sheet holds the deadline it opened on, and a peer can move it while the
     * sheet is up — so writing that snapshot back on an amount-only edit would
     * revert them silently.
     *
     * A goal's currency never changes. The sheet is opened in the goal's own
     * currency and seeded with its stored target, so a figure typed here is
     * already in the right denomination and nothing needs restating — which is
     * what keeps the start anchor, the frozen USD figures and the valuation date
     * all describing one moment. Restating them instead was three separate ways
     * to write a number that means something other than what it says.
     */
    const commitTarget = async ({ dateChanged, targetAmount, targetChanged, targetDate }: GoalCommit) => {
        targetSheetRef.current?.dismiss();
        await write({ ...(dateChanged && { targetDate }), ...(targetChanged && { targetAmount }) });
    };

    return (
        <>
            <GoalDetailView
                currency={currency}
                editor={
                    <GoalEditor
                        accountName={entry.accountName}
                        currency={currency}
                        // Only where it differs: a goal set and read in the same currency
                        // has nothing to explain.
                        foreignCurrency={goal.currency === currency ? null : goal.currency}
                        name={goal.name}
                        onChange={(edit: GoalEdit) => write(edit)}
                        onChangeTarget={() =>
                            setRetarget({
                                accountId: goal.accountId,
                                // Both in the goal's own currency: `saved` is valued
                                // into the display one, so it is only the same figure
                                // while the two agree.
                                balance: goal.currency === currency ? entry.saved : null,
                                currency: goal.currency,
                                existing: { targetAmount: goal.targetAmount, targetDate: goal.targetDate },
                                name: entry.accountName,
                            })
                        }
                        onDelete={() => {
                            requestDelete(goal.id);
                            router.back();
                        }}
                        perMonth={entry.progress.pace?.perMonth ?? null}
                        targetAmount={entry.target}
                        // The TARGET's own exactness, not the entry's: that broader
                        // flag also fails when the balance cannot be valued, and a
                        // target that converted perfectly would then be stamped with
                        // the goal's currency while holding a display-currency figure.
                        targetCurrency={entry.targetExact ? currency : goal.currency}
                        targetDate={goal.targetDate}
                    />
                }
                entry={entry}
                nowMs={nowMs}
            />
            <ScreenHeader title={goal.name} />
            <GoalTargetSheet onCommit={commitTarget} ref={targetSheetRef} target={retarget} />
        </>
    );
}
