import type { MenuAction } from "@expo/ui/community/menu";
import { View } from "react-native";

import { MeasureCellAmount } from "@/components/amount-text";
import { type LedgerCell, LedgerHead } from "@/components/ledger-head";
import { MonoLabel } from "@/components/mono-label";
import { ScopeChip } from "@/components/scope-chip";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { CategoryMetaRow } from "@/data/categories";
import type { LogFilter } from "@/domain/log-filter";
import { filterHasMenu, filterPeriodUnit } from "@/domain/log-filter";
import {
	type LogFigures,
	type LogMeasure,
	measureAlternatives,
	measureIsIncome,
	measureIsPositive,
	measureMagnitude,
} from "@/domain/log-measure";
import { canStepForward, stepCursor } from "@/domain/log-period-cursor";
import type { ScopeTotals } from "@/domain/log-scope-figures";
import { type TranslateFn, useTranslation } from "@/i18n/context";
import { FILTER_LABEL_KEY, MEASURE_WORD_KEY, scopeMeasureLabel } from "../labels";
import { LogHeroNumber } from "./log-hero-number";

interface LogFilterChipProps {
	categories: { id: string; meta: CategoryMetaRow }[];
	categoryId: string | null;
	cursor: Date;
	detail: string | null;
	/** The currency the whole screen is being read in. */
	displayCurrency: string;
	filter: LogFilter;
	firstWeekday: number;
	income: boolean;
	measure: LogMeasure;
	nowMs: number;
	onCategory: (id: string) => void;
	onClear: () => void;
	onCursor: (date: Date) => void;
	onIncome: (income: boolean) => void;
	onMeasure: (measure: LogMeasure) => void;
	/**
	 * In/out/net over the whole filtered scope. Null for a scope with nothing in
	 * it, which has no figure to state and says so in the list instead.
	 */
	totals: ScopeTotals | null;
}

export function LogFilterChip({
	filter,
	detail,
	categories,
	categoryId,
	onCategory,
	cursor,
	onCursor,
	income,
	onIncome,
	firstWeekday,
	nowMs,
	onClear,
	totals,
	measure,
	onMeasure,
	displayCurrency,
}: LogFilterChipProps) {
	const { showCents } = useDisplaySettings().state;
	const t = useTranslation();
	const hasMenu = filterHasMenu(filter);
	// `detail` may not have resolved yet, and the chip has to say what it is
	// regardless.
	const title = detail || t(FILTER_LABEL_KEY[filter]);

	return (
		<View className="pt-3">
			<View className="flex-row">
				<ScopeChip
					actions={
						hasMenu
							? menuActions({
									categories,
									categoryId,
									cursor,
									filter,
									firstWeekday,
									income,
									nowMs,
									t,
								})
							: undefined
					}
					clearAccessibilityLabel={t("log.chip.remove")}
					onAction={(event) =>
						handleAction(event, {
							cursor,
							filter,
							firstWeekday,
							onCategory,
							onCursor,
							onIncome,
						})
					}
					onClear={onClear}
					title={title}
				/>
			</View>

			{totals ? (
				<ScopeFigures
					displayCurrency={displayCurrency}
					measure={measure}
					onMeasure={onMeasure}
					showCents={showCents}
					totals={totals}
				/>
			) : null}
		</View>
	);
}

/**
 * The same trio the unfiltered header shows, over the scope instead of the
 * period: filtering to a category or a week is the user asking a money question,
 * and the chip alone does not answer it.
 */
function ScopeFigures({
	totals,
	measure,
	onMeasure,
	displayCurrency,
	showCents,
}: {
	totals: ScopeTotals;
	measure: LogMeasure;
	onMeasure: (measure: LogMeasure) => void;
	displayCurrency: string;
	showCents: boolean;
}) {
	const t = useTranslation();
	const { shown, others } = totals;

	return (
		<View className="pt-3 pb-1.5">
			<MonoLabel>{scopeMeasureLabel(t, measure, shown.currencyCode, displayCurrency)}</MonoLabel>
			<View className="pt-1">
				<LogHeroNumber
					code={shown.currencyCode}
					magnitude={measureMagnitude(measure, shown)}
					positive={measureIsPositive(measure, shown)}
					showCents={showCents}
				/>
			</View>
			<View className="pt-3">
				<LedgerHead
					cells={measureAlternatives(measure).map(
						(alternative): LedgerCell => ({
							income: measureIsIncome(alternative),
							key: alternative,
							label: t(MEASURE_WORD_KEY[alternative]),
							magnitude: measureMagnitude(alternative, shown),
							onPress: () => onMeasure(alternative),
							positive: measureIsPositive(alternative, shown),
						})
					)}
					code={shown.currencyCode}
				/>
			</View>
			{others.length > 0 ? (
				<View className="gap-1.5 pt-3">
					<MonoLabel>{t("log.scope.otherCurrencies")}</MonoLabel>
					{others.map((figures) => (
						<OtherCurrencyRow figures={figures} key={figures.currencyCode} measure={measure} showCents={showCents} />
					))}
				</View>
			) : null}
		</View>
	);
}

/**
 * One row per currency the scope also used. Never folded into the figure above:
 * without a rate reaching them, one number across two currencies is invented.
 */
function OtherCurrencyRow({
	figures,
	measure,
	showCents,
}: {
	figures: LogFigures;
	measure: LogMeasure;
	showCents: boolean;
}) {
	return (
		<View className="flex-row items-baseline justify-between">
			<MonoLabel>{figures.currencyCode}</MonoLabel>
			<MeasureCellAmount
				code={figures.currencyCode}
				income={measureIsIncome(measure)}
				magnitude={measureMagnitude(measure, figures)}
				positive={measureIsPositive(measure, figures)}
				showCents={showCents}
			/>
		</View>
	);
}

interface MenuContext {
	categories: { id: string; meta: CategoryMetaRow }[];
	categoryId: string | null;
	cursor: Date;
	filter: LogFilter;
	firstWeekday: number;
	income: boolean;
	nowMs: number;
	t: TranslateFn;
}

const CATEGORY_PREFIX = "category:";

function menuActions(ctx: MenuContext): MenuAction[] {
	const unit = filterPeriodUnit(ctx.filter);
	if (unit) {
		return [
			{
				id: "earlier",
				image: "chevron.left",
				title: ctx.t("log.chip.earlier"),
			},
			{
				attributes: {
					disabled: !canStepForward(unit, ctx.cursor, new Date(ctx.nowMs), ctx.firstWeekday),
				},
				id: "later",
				image: "chevron.right",
				title: ctx.t("log.chip.later"),
			},
			// An inline section is how a native menu draws a separator.
			{
				displayInline: true,
				id: "now-section",
				subactions: [
					{
						id: "now",
						image: "arrow.uturn.backward",
						title: ctx.t("log.chip.now"),
					},
				],
				title: "",
			},
		];
	}

	if (ctx.filter === "category") {
		return [
			{
				displayInline: true,
				id: "category-section",
				subactions: ctx.categories.map((entry) => ({
					id: `${CATEGORY_PREFIX}${entry.id}`,
					state: entry.id === ctx.categoryId ? "on" : "off",
					title: entry.meta.name ?? "",
				})),
				title: ctx.t("log.filter.category"),
			},
		];
	}

	return [
		{
			displayInline: true,
			id: "type-section",
			subactions: [
				{
					id: "expense",
					state: ctx.income ? "off" : "on",
					title: ctx.t("log.type.expense"),
				},
				{
					id: "income",
					state: ctx.income ? "on" : "off",
					title: ctx.t("log.type.income"),
				},
			],
			title: ctx.t("log.filter.type"),
		},
	];
}

function handleAction(
	event: string,
	ctx: {
		filter: LogFilter;
		cursor: Date;
		firstWeekday: number;
		onCursor: (date: Date) => void;
		onCategory: (id: string) => void;
		onIncome: (income: boolean) => void;
	}
) {
	if (event.startsWith(CATEGORY_PREFIX)) {
		ctx.onCategory(event.slice(CATEGORY_PREFIX.length));
		return;
	}
	if (event === "expense" || event === "income") {
		ctx.onIncome(event === "income");
		return;
	}

	const unit = filterPeriodUnit(ctx.filter);
	if (!unit) {
		return;
	}
	if (event === "now") {
		ctx.onCursor(new Date());
		return;
	}
	ctx.onCursor(stepCursor(unit, ctx.cursor, event === "later" ? 1 : -1, ctx.firstWeekday));
}
