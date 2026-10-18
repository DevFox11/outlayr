import type { InstallmentRow, PurchaseRow } from "@/data/installments-core";
import { daysBetween, startOfLocalDay } from "@/domain/local-day";
import type { TranslateFn } from "@/i18n/context";

/** "Upfront", or "Installment 2 of 3" / "Cuota 2 de 3". */
export function installmentTitle(t: TranslateFn, row: InstallmentRow, count: number): string {
    return row.sequence === 0 ? t("installments.upfront") : t("installments.cuota", { count, index: row.sequence });
}

/** What an order is called: its purchase's merchant, else plain "Order". */
export function orderName(t: TranslateFn, purchase: PurchaseRow | null): string {
    return purchase?.note.trim() || t("installments.order");
}

/** "today", "in 6 days"; null once the day has passed, which the row says as Overdue. */
export function dueIn(t: TranslateFn, dueDate: Date, nowMs: number): string | null {
    const days = daysBetween(startOfLocalDay(nowMs), dueDate.getTime());
    if (days < 0) {
        return null;
    }
    return days === 0 ? t("common.today").toLowerCase() : t("installments.inDays", { count: days });
}
