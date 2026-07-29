import { Stack } from "expo-router";

import type { ToolbarIconName } from "@/components/toolbar-icons";
import { toolbarIcon } from "@/components/toolbar-icons";
import type { LogPeriod } from "@/data/log-totals";
import { LOG_PERIOD_ORDER, LOG_PERIOD_PHRASE } from "@/data/log-totals";
import type { LogFilter } from "@/domain/log-filter";
import { LOG_FILTER_LABEL, LOG_FILTER_ORDER } from "@/domain/log-filter";

const FILTER_ICON: Record<LogFilter, ToolbarIconName> = {
	all: "showAll",
	type: "showType",
	day: "showDay",
	week: "showWeek",
	month: "showMonth",
	category: "showCategory",
	recurring: "showRecurring",
	upcoming: "showUpcoming",
};

interface LogToolbarProps {
	period: LogPeriod;
	onPeriod: (period: LogPeriod) => void;
	filter: LogFilter;
	onFilter: (filter: LogFilter) => void;
	onSearch: () => void;
}

/**
 * Rendered from the screen rather than the layout, because both menus read and
 * write screen state.
 */
export function LogToolbar({
	period,
	onPeriod,
	filter,
	onFilter,
	onSearch,
}: LogToolbarProps) {
	return (
		<>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("search")}
					accessibilityLabel="Search"
					onPress={onSearch}
				/>
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Menu
					{...toolbarIcon("period")}
					accessibilityLabel="Period"
				>
					{/* Nested and inline so the options carry a section header. */}
					<Stack.Toolbar.Menu inline title="Period">
						{LOG_PERIOD_ORDER.map((option) => (
							<Stack.Toolbar.MenuAction
								key={option}
								isOn={option === period}
								onPress={() => onPeriod(option)}
							>
								{LOG_PERIOD_PHRASE[option]}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Menu
					{...toolbarIcon(filter === "all" ? "filter" : "filterActive")}
					accessibilityLabel="Filter"
				>
					<Stack.Toolbar.Menu inline title="Show">
						{LOG_FILTER_ORDER.map((option) => (
							<Stack.Toolbar.MenuAction
								key={option}
								{...toolbarIcon(FILTER_ICON[option])}
								isOn={option === filter}
								onPress={() => onFilter(option)}
							>
								{LOG_FILTER_LABEL[option]}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
		</>
	);
}
