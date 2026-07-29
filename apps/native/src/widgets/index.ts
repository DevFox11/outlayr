import { Platform } from "react-native";
import type { SpendDb } from "@/data/budget-spent";
import { publishIntentSnapshot } from "@/lib/widget-bridge";
import BudgetWidget from "./budget";
import InsightsWidget from "./insights";
import LedgerWidget from "./ledger";
import LogWidget from "./log";
import { buildWidgetProps } from "./props";

export type { WidgetProps } from "./props";
export { buildWidgetProps } from "./props";

/**
 * Reloading is not free — the system grants a widget only a few dozen timeline
 * reloads a day — so this is called on the events that actually change what a
 * widget shows (a write settling, the app backgrounding), never on a timer. See
 * `use-widget-sync.ts` for the triggers.
 *
 * The budget widget gets a two-entry *timeline* rather than a snapshot: its
 * figures go wrong the instant the period rolls over, so the second entry is
 * scheduled at the window's end and the rollover costs one planned reload
 * instead of a stale tile. The other two only change when the user does
 * something, which already triggers a publish.
 *
 * Failures are swallowed: a widget that did not refresh is a stale tile, while a
 * throw here would take down whatever app-side action triggered it.
 */
export async function publishWidgets(db: SpendDb): Promise<void> {
	if (Platform.OS !== "ios") {
		return;
	}
	try {
		const now = new Date();
		const props = await buildWidgetProps(db, now);

		// An entry dated in the past is dropped, so the rollover is only scheduled
		// while it is genuinely ahead of us. Any of the published views can be the
		// one a tile is configured to, so the earliest end wins — a later one would
		// leave a differently-configured tile stale for a whole period.
		const rollover = Object.values(props.Budget.views)
			.filter((view) => view.present && view.endsAt > now.getTime())
			.reduce(
				(soonest, view) => Math.min(soonest, view.endsAt),
				Number.POSITIVE_INFINITY,
			);
		BudgetWidget.updateTimeline([
			{ date: now, props: props.Budget },
			...(Number.isFinite(rollover)
				? [{ date: new Date(rollover), props: props.Budget }]
				: []),
		]);
		LedgerWidget.updateSnapshot(props.Ledger);
		InsightsWidget.updateSnapshot(props.Insights);
		LogWidget.updateSnapshot(props.Log);

		// Siri reads from the App Group, not from WidgetKit, but off the same
		// derivation — see `publishIntentSnapshot`. It has no configuration of its
		// own, so it gets what an unconfigured tile shows.
		const budget = props.Budget.views.auto;
		const insights = props.Insights.windows[props.Insights.defaultPeriod];
		publishIntentSnapshot({
			budget: {
				present: budget.present,
				name: budget.name,
				periodLabel: budget.periodLabel,
				remaining: budget.remaining,
				remainingCaption: budget.remainingCaption,
				spent: budget.spent,
				limit: budget.limit,
				percent: budget.percent,
			},
			budgets: props.intentBudgets,
			insights: {
				periodLabel: insights.periodLabel,
				rangeLabel: insights.rangeLabel,
				net: insights.net,
				netPositive: insights.netPositive,
				spent: insights.spent,
				income: insights.income,
			},
		});
	} catch (error) {
		console.warn("[outlayr] widget publish failed", error);
	}
}
