import type { InstallmentRow } from "@/data/installments-core";
import { formatSentenceDate } from "@/domain/dates";
import type { InstallmentStanding } from "@/domain/installments";
import { daysBetween, startOfLocalDay } from "@/domain/local-day";
import type { TranslateFn } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

/** "Upfront", or "Installment 2 of 3" / "Cuota 2 de 3". */
export function installmentTitle(t: TranslateFn, row: InstallmentRow, count: number): string {
    return row.sequence === 0 ? t("installments.upfront") : t("installments.cuota", { count, index: row.sequence });
}

/** "today", "in 6 days"; null once the day has passed, which the row says as Overdue. */
export function dueIn(t: TranslateFn, dueDate: Date, nowMs: number): string | null {
    const days = daysBetween(startOfLocalDay(nowMs), dueDate.getTime());
    if (days < 0) {
        return null;
    }
    return days === 0 ? t("common.today").toLowerCase() : t("installments.inDays", { count: days });
}

/**
 * A schedule row's date line ("1 Nov · in 14 days" on the next one) and the
 * status beside its amount: paid, overdue or how much is in; null while
 * nothing is paid and it is not due yet.
 */
export function scheduleRowWording(
    t: TranslateFn,
    language: Language,
    row: InstallmentStanding<InstallmentRow>,
    { isNext, money, nowMs }: { isNext: boolean; money: (value: number) => string; nowMs: number }
) {
    const due = isNext ? dueIn(t, row.row.dueDate, nowMs) : null;
    const when = [formatSentenceDate(row.row.dueDate, language), due].filter(Boolean).join(" · ");
    let status: { text: string; tone: "overdue" | "paid" | "partial" } | null = null;
    if (row.status === "paid") {
        status = { text: t("installments.paid"), tone: "paid" };
    } else if (row.overdue) {
        status = { text: t("installments.overdue"), tone: "overdue" };
    } else if (row.status === "partial") {
        status = { text: t("installments.partly", { amount: money(row.covered) }), tone: "partial" };
    }
    return { status, when };
}
