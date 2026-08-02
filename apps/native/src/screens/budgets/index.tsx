import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Alert, ScrollView, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	budgetsRepo,
	compareBudgetSeverity,
	useBurndown,
	useBurndowns,
	useExpenseContributions,
	useMainBudget,
	usePerCategoryBudgets,
} from "@/data/budgets";
import { useBoolSetting } from "@/data/settings";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { buildBurndown } from "@/domain/budget-burndown";
import { BUDGET_TYPE, periodEnd } from "@/domain/budget-math";
import { firstOfMonth } from "@/domain/dates";
import { useTranslation } from "@/i18n";
import { showBudgetActions } from "@/lib/budget-actions";
import { BudgetBurndownHero } from "./components/budget-burndown-hero";
import { BudgetCard } from "./components/budget-card";
import { BudgetEmptyState } from "./components/budget-empty-state";
import { BudgetRow } from "./components/budget-row";

export default function BudgetScreen() {
	const db = useDatabase();
	return <BudgetContent db={db} />;
}

function pairs<T>(items: readonly T[]): [T, T | undefined][] {
	const rows: [T, T | undefined][] = [];
	for (let index = 0; index < items.length; index += 2) {
		rows.push([items[index], items[index + 1]]);
	}
	return rows;
}

function BudgetContent({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const currency = useGlobalCurrency(db);
	const asRows = useBoolSetting(db, "budgetViewStyle");
	const nowMs = useNow();

	// One transactions subscription for the screen: every hook below derives from
	// this list rather than opening its own listener.
	const contributions = useExpenseContributions(db, nowMs);
	const main = useMainBudget(db, nowMs, contributions);
	const budgets = usePerCategoryBudgets(db, nowMs, contributions);
	const mainBurndown = useBurndown(contributions, nowMs, main, null);
	const burndowns = useBurndowns(contributions, nowMs, budgets);

	const ranked = useMemo(
		() => [...budgets].sort(compareBudgetSeverity),
		[budgets],
	);
	const overCount = budgets.filter((budget) => budget.overBudget).length;

	// Both reads run in render, so null/[] here means the user genuinely has no
	// budgets — the pitch screen can be shown on it without flashing.
	const isEmpty = main === null && budgets.length === 0;

	const monthWindow = useMemo(() => {
		const start = firstOfMonth(new Date(nowMs));
		return { start, end: periodEnd(start, BUDGET_TYPE.month) };
	}, [nowMs]);

	const monthToDate = useMemo(
		() =>
			isEmpty
				? buildBurndown(contributions, {
						limit: 0,
						now: new Date(nowMs),
						window: monthWindow,
					})
				: null,
		[isEmpty, contributions, monthWindow, nowMs],
	);

	const monthExpenseCount = useMemo(
		() =>
			contributions.filter(
				(row) => row.date.getTime() >= monthWindow.start.getTime(),
			).length,
		[contributions, monthWindow],
	);

	// The write is async and the action sheet is already gone by the time it lands,
	// so an unhandled rejection would leave the budget sitting in the list with
	// nothing said about why the delete did not take.
	const deleteBudget = (id: string) => {
		budgetsRepo.deleteBudget(db, id).catch((error: unknown) => {
			console.error("Failed to delete the budget", error);
			Alert.alert(
				t("budgets.delete.failedTitle"),
				t("budgets.delete.failedBody"),
			);
		});
	};

	const createMainBudget = async (amount: number) => {
		try {
			await budgetsRepo.createMainBudget(db, {
				amount,
				type: BUDGET_TYPE.month,
			});
		} catch (error) {
			console.error("Failed to create the overall budget", error);
			Alert.alert(t("budgets.save.failedTitle"), t("budgets.save.failedBody"));
		}
	};

	const openActions = (id: string) => {
		const budget = budgets.find((candidate) => candidate.id === id);
		if (!budget) {
			return;
		}
		showBudgetActions({
			name: budget.name,
			onEdit: () => router.push(`/budgets/edit/${id}`),
			onDelete: () => deleteBudget(id),
		});
	};

	if (isEmpty && monthToDate) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<BudgetEmptyState
					burndown={monthToDate}
					currency={currency}
					onAddTransaction={() => router.push("/transaction/new")}
					onCommit={createMainBudget}
					sampleSize={monthExpenseCount}
					windowStart={monthWindow.start}
				/>
			</View>
		);
	}

	return (
		<ScrollView
			className="bg-background"
			contentInsetAdjustmentBehavior="automatic"
			style={{ flex: 1 }}
			contentContainerStyle={{
				paddingHorizontal: 20,
				// `NativeTabs` supplies the bar + safe-area inset; this only clears
				// the floating add button.
				paddingBottom: 100,
			}}
		>
			{main ? (
				<BudgetBurndownHero
					budget={main}
					burndown={mainBurndown}
					contributions={contributions}
					currency={currency}
					nowMs={nowMs}
					onPress={() => router.push("/budgets/overall")}
				/>
			) : null}

			{budgets.length ? (
				<View className="pt-6">
					<View className="flex-row items-baseline justify-between pb-2">
						<MonoLabel>
							{main ? t("budgets.list.categories") : t("budgets.list.budgets")}
						</MonoLabel>
						{overCount ? (
							<MonoLabel>
								{t("budgets.list.overCount", {
									over: overCount,
									total: budgets.length,
								})}
							</MonoLabel>
						) : null}
					</View>
					{asRows ? (
						<View className="divide-y divide-border">
							{ranked.map((budget) => (
								<BudgetRow
									budget={budget}
									burndown={burndowns.get(budget.id) ?? null}
									contributions={contributions}
									currency={currency}
									key={budget.id}
									nowMs={nowMs}
									onDelete={deleteBudget}
									onLongPress={openActions}
									onPress={(id) => router.push(`/budgets/${id}`)}
								/>
							))}
						</View>
					) : (
						<View className="gap-3">
							{pairs(ranked).map(([left, right]) => (
								<View className="flex-row gap-3" key={left.id}>
									<BudgetCard
										budget={left}
										burndown={burndowns.get(left.id) ?? null}
										contributions={contributions}
										currency={currency}
										nowMs={nowMs}
										onLongPress={openActions}
										onPress={(id) => router.push(`/budgets/${id}`)}
									/>
									{right ? (
										<BudgetCard
											budget={right}
											burndown={burndowns.get(right.id) ?? null}
											contributions={contributions}
											currency={currency}
											nowMs={nowMs}
											onLongPress={openActions}
											onPress={(id) => router.push(`/budgets/${id}`)}
										/>
									) : (
										// Holds the odd budget out to one column instead of
										// letting it stretch across the grid.
										<View className="flex-1" />
									)}
								</View>
							))}
						</View>
					)}
				</View>
			) : null}
		</ScrollView>
	);
}
