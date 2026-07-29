import { BUDGET_TYPE } from "@/domain/budget-math";
import type { TranslationKey } from "@/i18n";

/** The localized counterpart of `budgetPeriodPhrase`, which returns English. */
export function budgetPeriodKey(type: number): TranslationKey {
	switch (type) {
		case BUDGET_TYPE.day:
			return "budgets.period.day";
		case BUDGET_TYPE.week:
			return "budgets.period.week";
		case BUDGET_TYPE.month:
			return "budgets.period.month";
		case BUDGET_TYPE.year:
			return "budgets.period.year";
		default:
			return "budgets.period.other";
	}
}
