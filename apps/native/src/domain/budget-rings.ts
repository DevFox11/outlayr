import type { CategoryBudgetView } from "@/data/budgets";

const MAX_BUDGET_RINGS = 4;

export interface BudgetRingDatum {
	color: string;
	id: string;
	label: string;
	maxValue: number;
	overAmount: number;
	overBudget: boolean;
	percent: number;
	value: number;
}

export function budgetRingData(budgets: readonly CategoryBudgetView[]): BudgetRingDatum[] {
	const rings: BudgetRingDatum[] = [];

	for (const budget of budgets) {
		if (budget.amount <= 0) {
			continue;
		}

		const value = Math.max(0, budget.spent);
		const overAmount = Math.max(0, value - budget.amount);
		rings.push({
			color: budget.color,
			id: budget.id,
			label: budget.name,
			maxValue: budget.amount,
			overAmount,
			overBudget: overAmount > 0,
			percent: Math.round((value / budget.amount) * 100),
			value,
		});

		if (rings.length === MAX_BUDGET_RINGS) {
			break;
		}
	}

	return rings;
}
