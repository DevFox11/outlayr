import type { DebtsScreenOverview } from "@/data/debts";
import { DUE_WINDOW_DAYS } from "@/data/debts-due";
import { formatSentenceDate } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import type { TranslateFn } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

type DebtListRow = DebtsScreenOverview["youOwe"][number];

interface Wording {
    /** The display currency the totals are in. */
    currency: string;
    language: Language;
    showCents: boolean;
    t: TranslateFn;
}

export interface DebtSubtitle {
    text: string | null;
    tone: "due" | "muted" | "overdue";
}

/**
 * What a Debts row says under its name, and how it is tinted: a liability with
 * orders says its next cuota, in its own currency, flagged when overdue;
 * otherwise only what the figure does not already say: the account keeps
 * another currency. An overdue cuota reads as an expense; otherwise the account
 * the due strip names is tinted.
 */
export function debtSubtitle(
    item: DebtListRow,
    debts: DebtsScreenOverview,
    { currency, language, showCents, t }: Wording
): DebtSubtitle {
    const tone = item.id === debts.due?.next.accountId ? "due" : "muted";
    const orders = debts.installments.get(item.id);
    if (orders === undefined) {
        return { text: item.account.currency === currency ? null : item.account.currency, tone };
    }
    const [only, ...others] = orders.open;
    const { overdue } = orders.next;
    const date = formatSentenceDate(orders.next.row.dueDate, language);
    const next = {
        amount: formatAmount(orders.next.remaining, item.account.currency, showCents, language),
        date: overdue ? `${date} · ${t("installments.overdue")}` : date,
    };
    const text =
        only && others.length === 0
            ? t(overdue ? "debts.overdue.of" : "debts.next.of", {
                  ...next,
                  paid: only.standing.installmentsPaid,
                  total: only.standing.installmentsTotal,
              })
            : t(overdue ? "debts.overdue.orders" : "debts.next.orders", { ...next, count: orders.open.length });
    return { text, tone: overdue ? "overdue" : tone };
}

/**
 * The due strip's "Due in the next 14 days" and its summary: how many cuotas
 * and the soonest, or since when when that one is overdue.
 */
export function dueStripWording(
    due: NonNullable<DebtsScreenOverview["due"]>,
    debts: DebtsScreenOverview,
    { language, t }: Pick<Wording, "language" | "t">
) {
    const { overdue } = due.next.standing;
    const name = debts.youOwe.find((item) => item.id === due.next.accountId)?.account.name;
    return {
        overdue,
        summary: t(overdue ? "debts.due.overdue" : "debts.due.summary", {
            count: due.count,
            date: formatSentenceDate(due.next.standing.row.dueDate, language),
            name: name ?? t("installments.order"),
        }),
        title: t("debts.due.title", { days: DUE_WINDOW_DAYS }),
    };
}
