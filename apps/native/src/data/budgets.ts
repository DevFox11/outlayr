import { utcDateString } from "@outlayr/money";
import {
	and,
	asc,
	desc,
	eq,
	getTableColumns,
	gte,
	inArray,
	isNull,
	lte,
} from "drizzle-orm";
import { useEffect, useMemo } from "react";
import type { Database } from "@/db/client";
import { budgets, mainBudget, transactions } from "@/db/schema";
import { type Burndown, buildBurndown } from "@/domain/budget-burndown";
import { advanceBudgetWindow, type BudgetWindow } from "@/domain/budget-math";
import { limitIn, sumValuedIn, valueIn } from "@/domain/valuation";
import {
	type ExpenseContribution,
	expenseContributionQuery,
	spentForCategory,
	spentForMain,
} from "./budget-spent";
import { budgetsRepo } from "./budgets-core";
import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import type { TransactionWithCategory } from "./transactions";
import { useValuation } from "./use-valuation";

export {
	type BudgetSeverity,
	compareBudgetSeverity,
} from "@/domain/budget-severity";
export * from "./budgets-core";

export type Budget = typeof budgets.$inferSelect;
export type MainBudget = typeof mainBudget.$inferSelect;

export interface CategoryBudgetView {
	id: string;
	categoryId: string | null;
	name: string;
	color: string;
	icon: string | null;
	amount: number;
	type: number;
	window: BudgetWindow;
	spent: number;
	leftover: number;
	overBudget: boolean;
}

export interface MainBudgetView {
	id: string;
	name: string;
	amount: number;
	type: number;
	window: BudgetWindow;
	spent: number;
	leftover: number;
	overBudget: boolean;
}

/**
 * `useLiveQuery` registers a fresh database listener per call, so this list is a
 * *parameter* to the budget hooks rather than something each one fetches. Call
 * it once per screen and thread the result down, or a single insert re-runs the
 * same full scan N times.
 */
export function useExpenseContributions(
	db: Database,
	nowMs: number,
): ExpenseContribution[] {
	const data = useLiveQuery(
		transactions,
		() => expenseContributionQuery(db, new Date(nowMs)),
		[nowMs],
	);

	const categoryMeta = useCategoryMeta(db);
	const valuation = useValuation(db);

	return useMemo(
		() =>
			data.map((row) => ({
				categoryId: row.categoryId,
				date: row.date,
				// `amount` is the valued amount from here down, not the row's stored one.
				amount: valueIn(
					{
						amount: row.amount,
						currency: row.currency,
						amountUsd: row.amountUsd,
						dateKey: utcDateString(row.date.getTime()),
					},
					valuation.displayCurrency,
					valuation.rates,
				),
				parentId: row.categoryId
					? (categoryMeta.get(row.categoryId)?.parentId ?? null)
					: null,
			})),
		[data, categoryMeta, valuation],
	);
}

/**
 * Null means no budget is set, never "not read yet": the read runs in render.
 * Rolls the persisted window forward on access.
 */
export function useMainBudget(
	db: Database,
	nowMs: number,
	contributions: readonly ExpenseContribution[],
): MainBudgetView | null {
	const data = useLiveQuery(mainBudget, () =>
		db.select().from(mainBudget).where(isNull(mainBudget.deletedAt)).limit(1),
	);
	const row = data[0] ?? null;
	const { displayCurrency, rates } = useValuation(db);

	useEffect(() => {
		if (!row?.startDate) {
			return;
		}
		const win = advanceBudgetWindow(row.startDate, row.type, new Date(nowMs));
		if (win.start.getTime() !== row.startDate.getTime()) {
			budgetsRepo.advanceMainStart(db, row.id, win.start);
		}
	}, [db, row, nowMs]);

	return useMemo(() => {
		if (!row) {
			return null;
		}
		const now = new Date(nowMs);
		const window = advanceBudgetWindow(row.startDate ?? now, row.type, now);
		const spent = spentForMain(contributions, window.start, now);
		const amount = limitIn(row, window.start, displayCurrency, rates);
		return {
			id: row.id,
			name: row.name?.trim() ? row.name.trim() : "Overall Budget",
			amount,
			type: row.type,
			window,
			spent,
			leftover: amount - spent,
			overBudget: spent > amount,
		};
	}, [row, contributions, nowMs, displayCurrency, rates]);
}

/** A null `categoryId` scopes the series to the overall budget. */
export function useBurndown(
	contributions: readonly ExpenseContribution[],
	nowMs: number,
	budget: { amount: number; window: BudgetWindow } | null,
	categoryId: string | null = null,
): Burndown | null {
	return useMemo(() => {
		if (!budget) {
			return null;
		}
		return buildBurndown(contributions, {
			limit: budget.amount,
			window: budget.window,
			now: new Date(nowMs),
			categoryId,
		});
	}, [contributions, budget, nowMs, categoryId]);
}

export function useBurndowns(
	contributions: readonly ExpenseContribution[],
	nowMs: number,
	budgetList: readonly CategoryBudgetView[],
): Map<string, Burndown> {
	return useMemo(() => {
		const now = new Date(nowMs);
		const series = new Map<string, Burndown>();
		for (const budget of budgetList) {
			series.set(
				budget.id,
				buildBurndown(contributions, {
					limit: budget.amount,
					window: budget.window,
					now,
					categoryId: budget.categoryId,
				}),
			);
		}
		return series;
	}, [contributions, budgetList, nowMs]);
}

/**
 * Rolls each persisted window forward on access. An empty list means the user
 * has no budgets — it is never "not read yet".
 */
export function usePerCategoryBudgets(
	db: Database,
	nowMs: number,
	contributions: readonly ExpenseContribution[],
): CategoryBudgetView[] {
	const rows = useLiveQuery(budgets, () =>
		db
			.select(getTableColumns(budgets))
			.from(budgets)
			.where(isNull(budgets.deletedAt))
			.orderBy(asc(budgets.dateCreated)),
	);
	const categoryMeta = useCategoryMeta(db);
	const { displayCurrency, rates } = useValuation(db);

	useEffect(() => {
		const now = new Date(nowMs);
		for (const row of rows) {
			if (!row.startDate) {
				continue;
			}
			const win = advanceBudgetWindow(row.startDate, row.type, now);
			if (win.start.getTime() !== row.startDate.getTime()) {
				budgetsRepo.advanceBudgetStart(db, row.id, win.start);
			}
		}
	}, [db, rows, nowMs]);

	return useMemo(() => {
		const now = new Date(nowMs);
		return rows.map((row) => {
			const window = advanceBudgetWindow(row.startDate ?? now, row.type, now);
			const spent = row.categoryId
				? spentForCategory(contributions, row.categoryId, window.start, now)
				: 0;
			const meta = row.categoryId
				? categoryMeta.get(row.categoryId)
				: undefined;
			const amount = limitIn(row, window.start, displayCurrency, rates);
			return {
				id: row.id,
				categoryId: row.categoryId,
				name: row.name?.trim() ? row.name.trim() : (meta?.name ?? "Budget"),
				color: meta?.color ?? "#767676",
				icon: meta?.icon ?? null,
				amount,
				type: row.type,
				window,
				spent,
				leftover: amount - spent,
				overBudget: spent > amount,
			};
		});
	}, [rows, contributions, categoryMeta, nowMs, displayCurrency, rates]);
}

export function useOverBudgetCount(db: Database, nowMs: number): number {
	const contributions = useExpenseContributions(db, nowMs);
	const budgets = usePerCategoryBudgets(db, nowMs, contributions);
	return budgets.reduce(
		(count, budget) => (budget.overBudget ? count + 1 : count),
		0,
	);
}

export interface CategoryBudgetDetail {
	/** `null` once the budget is gone. */
	budget: CategoryBudgetView | null;
	/** Newest first. */
	transactions: TransactionWithCategory[];
}

export function useCategoryBudget(
	db: Database,
	id: string,
	nowMs: number,
): CategoryBudgetDetail {
	const data = useLiveQuery(
		budgets,
		() =>
			db
				.select(getTableColumns(budgets))
				.from(budgets)
				.where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
				.limit(1),
		[id],
	);
	const row = data[0] ?? null;
	const categoryMeta = useCategoryMeta(db);
	const { displayCurrency, rates } = useValuation(db);

	const window = useMemo(() => {
		if (!row) {
			return null;
		}
		const now = new Date(nowMs);
		return advanceBudgetWindow(row.startDate ?? now, row.type, now);
	}, [row, nowMs]);

	useEffect(() => {
		if (!row?.startDate || !window) {
			return;
		}
		if (window.start.getTime() !== row.startDate.getTime()) {
			budgetsRepo.advanceBudgetStart(db, row.id, window.start);
		}
	}, [db, row, window]);

	const transactions = useBudgetContributions(
		db,
		row?.categoryId ?? null,
		window?.start ?? null,
		nowMs,
	);

	const budget = useMemo(() => {
		if (!row || !window) {
			return null;
		}
		// This screen queries its own rows instead of sharing
		// `useExpenseContributions`, so the conversion has to happen here.
		const spent = sumValuedIn(transactions, displayCurrency, rates);
		const meta = row.categoryId ? categoryMeta.get(row.categoryId) : undefined;
		const amount = limitIn(row, window.start, displayCurrency, rates);
		return {
			id: row.id,
			categoryId: row.categoryId,
			name: row.name?.trim() ? row.name.trim() : (meta?.name ?? "Budget"),
			color: meta?.color ?? "#767676",
			icon: meta?.icon ?? null,
			amount,
			type: row.type,
			window,
			spent,
			leftover: amount - spent,
			overBudget: spent > amount,
		};
	}, [row, window, transactions, categoryMeta, displayCurrency, rates]);

	return { budget, transactions };
}

/**
 * Newest first. `categoryId === null` means the overall budget (every expense);
 * returns [] until `start` is known.
 *
 * The category relationship is resolved through {@link useCategoryMeta} rather
 * than a join: expressing "this category or its children" as
 * `eq(categories.parentId, …)` inside the join makes the *row set* depend on a
 * table the subscription does not watch, so re-parenting a subcategory silently
 * adds or drops its transactions until some transaction happens to be written.
 * Resolving the id set in JS and matching with `inArray` keeps it reactive.
 */
export function useBudgetContributions(
	db: Database,
	categoryId: string | null,
	start: Date | null,
	nowMs: number,
): TransactionWithCategory[] {
	// A null start (budget not loaded yet) must match nothing, not everything.
	const startMs = start ? start.getTime() : nowMs + 1;
	const categoryMeta = useCategoryMeta(db);

	const contributingIds = useMemo(() => {
		if (!categoryId) {
			return null;
		}
		const ids = [categoryId];
		for (const [id, meta] of categoryMeta) {
			if (meta.parentId === categoryId) {
				ids.push(id);
			}
		}
		return ids;
	}, [categoryId, categoryMeta]);

	// A primitive so the subscription re-runs when the contributing set changes
	// without re-subscribing on every render's fresh array identity.
	const contributingKey = contributingIds?.join(",") ?? "";

	const data = useLiveQuery(
		transactions,
		() =>
			db
				.select(getTableColumns(transactions))
				.from(transactions)
				.where(
					and(
						eq(transactions.income, false),
						isNull(transactions.deletedAt),
						gte(transactions.date, new Date(startMs)),
						lte(transactions.date, new Date(nowMs)),
						contributingIds
							? inArray(transactions.categoryId, contributingIds)
							: undefined,
					),
				)
				.orderBy(desc(transactions.date)),
		[contributingKey, startMs, nowMs],
	);

	return useMemo(
		() =>
			data.map((row) => {
				const meta = row.categoryId
					? categoryMeta.get(row.categoryId)
					: undefined;
				return {
					...row,
					categoryName: meta?.name ?? null,
					categoryColor: meta?.color ?? null,
					categoryIcon: meta?.icon ?? null,
				};
			}),
		[data, categoryMeta],
	);
}
