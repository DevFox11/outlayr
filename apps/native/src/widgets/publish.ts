import { Platform } from "react-native";

import { appliedWriteIds } from "@/data/pending-writes-core";
import { buildWalletPush } from "@/data/wallet-push";
import type { Database } from "@/db/client";
import { formatUpcomingDate } from "@/domain/dates";
import { amountParts } from "@/domain/money";
import { translateNow } from "@/i18n/runtime";
import { publishWatchSnapshot } from "@/lib/watch-link";
import { publishIntentSnapshot, publishWalletPush } from "@/lib/widget-bridge";

import BudgetWidget from "./budget";
import InsightsWidget from "./insights";
import LedgerWidget from "./ledger";
import LogWidget from "./log";
import { buildWidgetProps } from "./props";

const APPLIED_WINDOW_MS = 86_400_000;

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
 * The watch gets the same derivation as application context (latest wins), plus
 * a complication push when one is on the face.
 *
 * Failures are swallowed: a widget that did not refresh is a stale tile, while a
 * throw here would take down whatever app-side action triggered it.
 */
export async function publishWidgets(db: Database): Promise<void> {
    if (Platform.OS !== "ios") {
        return;
    }
    try {
        const now = new Date();
        const appliedSince = now.getTime() - APPLIED_WINDOW_MS;
        const applied = await appliedWriteIds(db, appliedSince);
        const props = await buildWidgetProps(db, now);

        // An entry dated in the past is dropped, so the rollover is only scheduled
        // while it is genuinely ahead of us. Any of the published views can be the
        // one a tile is configured to, so the earliest end wins — a later one would
        // leave a differently-configured tile stale for a whole period.
        const rollover = Object.values(props.Budget.views)
            .filter((view) => view.present && view.endsAt > now.getTime())
            .reduce((soonest, view) => Math.min(soonest, view.endsAt), Number.POSITIVE_INFINITY);
        BudgetWidget.updateTimeline([
            { date: now, props: props.Budget },
            ...(Number.isFinite(rollover) ? [{ date: new Date(rollover), props: props.Budget }] : []),
        ]);
        LedgerWidget.updateSnapshot(props.Ledger);
        InsightsWidget.updateSnapshot(props.Insights);
        LogWidget.updateSnapshot(props.Log);

        // Siri reads from the App Group, not from WidgetKit, but off the same
        // derivation — see `publishIntentSnapshot`. It has no configuration of its
        // own, so it gets what an unconfigured tile shows.
        const budget = props.Budget.views.auto;
        const money = amountParts(0, props.currency);
        const insights = props.Insights.windows[props.Insights.defaultPeriod];
        publishIntentSnapshot({
            budget: {
                limit: budget.limit,
                name: budget.name,
                percent: budget.percent,
                periodLabel: budget.periodLabel,
                present: budget.present,
                remaining: budget.remaining,
                remainingCaption: budget.remainingCaption,
                spent: budget.spent,
            },
            budgets: props.intentBudgets,
            insights: {
                income: insights.income,
                net: insights.net,
                netPositive: insights.netPositive,
                periodLabel: insights.periodLabel,
                rangeLabel: insights.rangeLabel,
                spent: insights.spent,
            },
        });
        publishWatchSnapshot({
            applied: { ids: applied, since: appliedSince },
            budget: {
                elapsedFraction: budget.elapsedFraction,
                endsAt: budget.endsAt,
                isOverall: budget.isOverall,
                name: budget.name,
                over: budget.over,
                percent: budget.percent,
                periodLabel: budget.periodLabel,
                present: budget.present,
                remaining: budget.remaining,
                remainingCaption: budget.remainingCaption,
                spentFraction: budget.spentFraction,
            },
            categories: props.categories,
            currency: props.currency,
            dateLabel: formatUpcomingDate(now).toUpperCase(),
            entries: props.watchEntries,
            money: {
                cents: props.showCents,
                decimal: money.locale.decimal,
                group: money.locale.group,
                minorUnits: money.minorUnits,
                symbol: money.symbol,
            },
            labels: {
                all: translateNow("watch.all"),
                average: translateNow("watch.average"),
                empty: translateNow("watch.empty"),
                income: translateNow("common.income"),
                recent: translateNow("watch.recent"),
                spent: translateNow("watch.spent"),
                week: translateNow("watch.week"),
                yesterday: translateNow("common.yesterday").toUpperCase(),
            },
            publishedAt: now.getTime(),
            todayLabel: props.Log.todayLabel,
            todaySpent: props.Log.todaySpent,
            week: props.week,
            zeroSpent: props.zeroSpent,
        });
    } catch (error) {
        console.warn("[outlayr] widget publish failed", error);
    }
    try {
        publishWalletPush(await buildWalletPush(db));
    } catch (error) {
        console.warn("[outlayr] wallet push build failed", error);
    }
}
