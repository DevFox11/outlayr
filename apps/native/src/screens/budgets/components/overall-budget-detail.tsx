import { Color, Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	budgetsRepo,
	useBudgetContributions,
	useExpenseContributions,
	useMainBudget,
	windowEndMs,
} from "@/data/budgets";
import { useBoolSetting } from "@/data/settings";
import type { Database } from "@/db/client";
import {
	budgetPace,
	budgetPeriodPhrase,
	budgetWindowLabel,
	isBehindPace,
	leftPerDay,
	shouldShowPaceMarker,
} from "@/domain/budget-math";
import { confirmDeleteBudget } from "@/lib/budget-actions";
import { BudgetDetailView } from "@/screens/budgets/components/budget-detail-view";
import { BudgetPeriodStepper } from "@/screens/budgets/components/budget-period-stepper";

/**
 * Lives under `/budgets/[id]` with the reserved id `overall` rather than its own
 * route: a static sibling of a dynamic segment never resolved here.
 */
export function OverallBudgetDetail({
	db,
	onDone,
}: {
	db: Database;
	onDone: () => void;
}) {
	return <MainBudgetDetail db={db} onDone={onDone} />;
}

function MainBudgetDetail({
	db,
	onDone,
}: {
	db: Database;
	onDone: () => void;
}) {
	const router = useRouter();
	const currency = useGlobalCurrency(db);
	const showCents = useBoolSetting(db, "showCents");
	const showSign = useBoolSetting(db, "showExpenseOrIncomeSign");
	const [nowMs] = useState(() => Date.now());
	const [periodOffset, setPeriodOffset] = useState(0);
	const contributions = useExpenseContributions(db, nowMs);
	const budget = useMainBudget(db, nowMs, contributions, periodOffset);
	const transactions = useBudgetContributions(
		db,
		null,
		budget?.window.start ?? null,
		budget ? windowEndMs(budget.window, nowMs) : nowMs,
	);

	useEffect(() => {
		if (budget === null) {
			onDone();
		}
	}, [budget, onDone]);

	if (!budget) {
		return <View className="flex-1 bg-background" />;
	}

	const confirmDelete = () => {
		confirmDeleteBudget(null, async () => {
			await budgetsRepo.deleteMainBudget(db, budget.id);
			onDone();
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
						: budgetPeriodPhrase(budget.type)
				}
				spent={budget.spent}
				amount={budget.amount}
				leftover={budget.leftover}
				overBudget={budget.overBudget}
				currency={currency}
				transactions={transactions}
				onPressTransaction={(txId) => router.push(`/transaction/${txId}`)}
				paceRemaining={showMarker ? pace.remaining : null}
				paceBehind={!closed && behind}
				leftPerDayAmount={perDay}
				showCents={showCents}
				showSign={showSign}
				closed={closed}
				stepper={
					budget.periodsBack > 0 ? (
						<BudgetPeriodStepper
							maxBack={budget.periodsBack}
							offset={periodOffset}
							onStep={setPeriodOffset}
							type={budget.type}
							window={budget.window}
						/>
					) : null
				}
			/>
			<Stack.Screen.Title>Overall Budget</Stack.Screen.Title>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("delete")}
					accessibilityLabel="Delete"
					onPress={confirmDelete}
					tintColor={Color.ios.systemRed}
				/>
			</Stack.Toolbar>
		</>
	);
}
