export interface BudgetSeverity {
	amount: number;
	spent: number;
	overBudget: boolean;
}

function overage(budget: BudgetSeverity): number {
	return budget.spent - budget.amount;
}

/** A zero limit has no fraction to spend — it is over the moment anything lands. */
function spentFraction(budget: BudgetSeverity): number {
	return budget.amount > 0 ? budget.spent / budget.amount : 0;
}

/**
 * Equal severity returns 0 so `Array.prototype.sort`'s stability keeps the
 * underlying oldest-first order intact.
 *
 * Lives outside `budgets.ts` only so the node test runner can import it — that
 * module pulls in Drizzle's expo-sqlite driver, which needs a native runtime.
 */
export function compareBudgetSeverity(
	a: BudgetSeverity,
	b: BudgetSeverity,
): number {
	if (a.overBudget !== b.overBudget) {
		return a.overBudget ? -1 : 1;
	}
	if (a.overBudget) {
		return overage(b) - overage(a);
	}
	return spentFraction(b) - spentFraction(a);
}
