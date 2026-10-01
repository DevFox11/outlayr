import type { CategoryBudgetView } from "@/data/budgets";
import { budgetTimeLeftLabel } from "@/domain/budget-math";
import type { TranslateFn } from "@/i18n/context";

export function timeLeftUnlessHeroShows(
    budget: CategoryBudgetView,
    heroTimeLeft: string | null,
    now: Date,
    t: TranslateFn
): string | null {
    const timeLeft = budgetTimeLeftLabel(budget.window, budget.type, now, t);
    return timeLeft === heroTimeLeft ? null : timeLeft;
}
