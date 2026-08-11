import { Stack } from "expo-router";

import type { ToolbarIconName } from "@/components/toolbar-icons";
import { toolbarIcon } from "@/components/toolbar-icons";
import type { LogPeriod } from "@/data/log-totals";
import { LOG_PERIOD_ORDER } from "@/data/log-totals";
import type { LogFilter } from "@/domain/log-filter";
import { LOG_FILTER_ORDER } from "@/domain/log-filter";
import { useTranslation } from "@/i18n/context";
import { FILTER_LABEL_KEY, PERIOD_PHRASE_KEY } from "../labels";

const FILTER_ICON: Record<LogFilter, ToolbarIconName> = {
	all: "showAll",
	category: "showCategory",
	day: "showDay",
	month: "showMonth",
	recurring: "showRecurring",
	transfers: "showTransfers",
	type: "showType",
	upcoming: "showUpcoming",
	week: "showWeek",
};

interface LogToolbarProps {
	filter: LogFilter;
	onFilter: (filter: LogFilter) => void;
	onPeriod: (period: LogPeriod) => void;
	onSearch: () => void;
	period: LogPeriod;
}

/**
 * Rendered from the screen rather than the layout, because both menus read and
 * write screen state.
 */
export function LogToolbar({ period, onPeriod, filter, onFilter, onSearch }: LogToolbarProps) {
	const t = useTranslation();
	return (
		<>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("search")}
					accessibilityLabel={t("log.toolbar.search")}
					onPress={onSearch}
				/>
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Menu {...toolbarIcon("period")} accessibilityLabel={t("log.toolbar.period")}>
					{/* Nested and inline so the options carry a section header. */}
					<Stack.Toolbar.Menu inline title={t("log.toolbar.period")}>
						{LOG_PERIOD_ORDER.map((option) => (
							<Stack.Toolbar.MenuAction isOn={option === period} key={option} onPress={() => onPeriod(option)}>
								{t(PERIOD_PHRASE_KEY[option])}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Menu
					{...toolbarIcon(filter === "all" ? "filter" : "filterActive")}
					accessibilityLabel={t("log.toolbar.filter")}
				>
					<Stack.Toolbar.Menu inline title={t("log.toolbar.show")}>
						{LOG_FILTER_ORDER.map((option) => (
							<Stack.Toolbar.MenuAction
								key={option}
								{...toolbarIcon(FILTER_ICON[option])}
								isOn={option === filter}
								onPress={() => onFilter(option)}
							>
								{t(FILTER_LABEL_KEY[option])}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
		</>
	);
}
