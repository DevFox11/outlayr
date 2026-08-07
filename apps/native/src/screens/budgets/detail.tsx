import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useGlobalCurrency } from "@/data/app-meta";
import { budgetsRepo, useCategoryBudget } from "@/data/budgets";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import {
	budgetPace,
	budgetPeriodPhrase,
	budgetWindowLabel,
	isBehindPace,
	leftPerDay,
	shouldShowPaceMarker,
} from "@/domain/budget-math";
import { useTranslation } from "@/i18n";
import { showBudgetActions } from "@/lib/budget-actions";
import { BudgetDetailView } from "@/screens/budgets/components/budget-detail-view";
import { BudgetPeriodStepper } from "@/screens/budgets/components/budget-period-stepper";

export function BudgetDetail({
	db,
	id,
	onDone,
}: {
	db: Database;
	id: string;
	onDone: () => void;
}) {
	const router = useRouter();
	const t = useTranslation();
	const currency = useGlobalCurrency(db);
	const nowMs = useNow();
	const [periodOffset, setPeriodOffset] = useState(0);
	const { budget, transactions, periodsBack } = useCategoryBudget(
		db,
		id,
		nowMs,
		periodOffset,
	);

	useEffect(() => {
		if (budget === null) {
			onDone();
		}
	}, [budget, onDone]);

	if (!budget) {
		return <View className="flex-1 bg-background" />;
	}

	const openActions = () => {
		showBudgetActions({
			name: budget.name,
			onEdit: () => router.push(`/budgets/edit/${budget.id}`),
			onDelete: async () => {
				await budgetsRepo.deleteBudget(db, budget.id);
				onDone();
			},
		});
	};

	const now = new Date(nowMs);
	const closed = periodOffset < 0;
	const pace = budgetPace(budget.window, now);
	const showMarker =
		!closed &&
		shouldShowPaceMarker(budget.type, pace.remaining, budget.overBudget);
	const behind = isBehindPace(pace.remaining, budget.amount, budget.leftover);
	const perDay =
		closed || budget.overBudget
			? null
			: leftPerDay(budget.leftover, budget.window, now);

	return (
		<>
			<BudgetDetailView
				period={
					closed
						? budgetWindowLabel(budget.window, budget.type)
						: t(budgetPeriodPhrase(budget.type))
				}
				spent={budget.spent}
				amount={budget.amount}
				leftover={budget.leftover}
				overBudget={budget.overBudget}
				currency={currency}
				transactions={transactions}
				onPressTransaction={(txId) => router.push(`/transactions/${txId}`)}
				paceRemaining={showMarker ? pace.remaining : null}
				paceBehind={!closed && behind}
				leftPerDayAmount={perDay}
				closed={closed}
				stepper={
					periodsBack > 0 ? (
						<BudgetPeriodStepper
							maxBack={periodsBack}
							offset={periodOffset}
							onStep={setPeriodOffset}
							type={budget.type}
							window={budget.window}
						/>
					) : null
				}
			/>
			<Stack.Screen.Title>{budget.name}</Stack.Screen.Title>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("more")}
					accessibilityLabel={t("budgets.action.moreA11y")}
					onPress={openActions}
				/>
			</Stack.Toolbar>
		</>
	);
}
