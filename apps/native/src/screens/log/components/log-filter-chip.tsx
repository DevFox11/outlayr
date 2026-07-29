import type { MenuAction } from "@expo/ui/community/menu";
import { View } from "react-native";

import { ScopeChip } from "@/components/scope-chip";
import type { CategoryMetaRow } from "@/data/categories";
import type { LogFilter } from "@/domain/log-filter";
import {
	filterHasMenu,
	filterPeriodUnit,
	LOG_FILTER_LABEL,
} from "@/domain/log-filter";
import { canStepForward, stepCursor } from "@/domain/log-period-cursor";

interface LogFilterChipProps {
	filter: LogFilter;
	detail: string | null;
	categories: { id: string; meta: CategoryMetaRow }[];
	categoryId: string | null;
	onCategory: (id: string) => void;
	cursor: Date;
	onCursor: (date: Date) => void;
	income: boolean;
	onIncome: (income: boolean) => void;
	firstWeekday: number;
	nowMs: number;
	onClear: () => void;
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
}: LogFilterChipProps) {
	const hasMenu = filterHasMenu(filter);
	// `detail` may not have resolved yet, and the chip has to say what it is
	// regardless.
	const title = detail || LOG_FILTER_LABEL[filter];

	return (
		<View className="flex-row pt-3">
			<ScopeChip
				actions={
					hasMenu
						? menuActions({
								filter,
								categories,
								categoryId,
								cursor,
								income,
								firstWeekday,
								nowMs,
							})
						: undefined
				}
				clearAccessibilityLabel="Remove filter"
				onAction={(event) =>
					handleAction(event, {
						filter,
						cursor,
						firstWeekday,
						onCursor,
						onCategory,
						onIncome,
					})
				}
				onClear={onClear}
				title={title}
			/>
		</View>
	);
}

interface MenuContext {
	filter: LogFilter;
	categories: { id: string; meta: CategoryMetaRow }[];
	categoryId: string | null;
	cursor: Date;
	income: boolean;
	firstWeekday: number;
	nowMs: number;
}

const CATEGORY_PREFIX = "category:";

function menuActions(ctx: MenuContext): MenuAction[] {
	const unit = filterPeriodUnit(ctx.filter);
	if (unit) {
		return [
			{ id: "earlier", title: "Earlier", image: "chevron.left" },
			{
				id: "later",
				title: "Later",
				image: "chevron.right",
				attributes: {
					disabled: !canStepForward(
						unit,
						ctx.cursor,
						new Date(ctx.nowMs),
						ctx.firstWeekday,
					),
				},
			},
			// An inline section is how a native menu draws a separator.
			{
				id: "now-section",
				title: "",
				displayInline: true,
				subactions: [
					{ id: "now", title: "Now", image: "arrow.uturn.backward" },
				],
			},
		];
	}

	if (ctx.filter === "category") {
		return [
			{
				id: "category-section",
				title: LOG_FILTER_LABEL.category,
				displayInline: true,
				subactions: ctx.categories.map((entry) => ({
					id: `${CATEGORY_PREFIX}${entry.id}`,
					title: entry.meta.name ?? "",
					state: entry.id === ctx.categoryId ? "on" : "off",
				})),
			},
		];
	}

	return [
		{
			id: "type-section",
			title: LOG_FILTER_LABEL.type,
			displayInline: true,
			subactions: [
				{ id: "expense", title: "Expense", state: ctx.income ? "off" : "on" },
				{ id: "income", title: "Income", state: ctx.income ? "on" : "off" },
			],
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
	},
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
	ctx.onCursor(
		stepCursor(unit, ctx.cursor, event === "later" ? 1 : -1, ctx.firstWeekday),
	);
}
