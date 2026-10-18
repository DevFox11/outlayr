import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { toAccountKind } from "@outlayr/money/account-kind";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import type { Account } from "@/data/accounts-core";
import { paymentRate, planIdForPurchase } from "@/data/installment-reads";
import { installmentsRepo } from "@/data/installments-core";
import type { PaymentSource } from "@/data/installments-core";
import type { Transaction, TransactionInput } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import { draftSchedule, newInstallmentDraft, paidBeforeCount, upfrontOf } from "@/domain/installment-draft";
import type { InstallmentDraft } from "@/domain/installment-draft";
import { paymentSource } from "@/domain/installment-payment";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";

import { InstallmentsSheet } from "./installments-sheet";
import type { SentenceVerb } from "./sentence/fact-glyphs";

interface InstallmentOrderArgs {
    account: Account | null;
    /** The accounts an upfront can come from. */
    banks: readonly Account[];
    currency: string;
    date: Date;
    db: Database;
    income: boolean;
    initial: Transaction | undefined;
    isSubscription: boolean;
    mode: "create" | "edit";
}

/**
 * The entry form's Installments fact: a chip offered on a new expense on a
 * liability account, the sheet it opens, and the save that writes the purchase
 * together with its order. Editing an entry that already has an order shows a
 * chip that opens the order instead: its rows are edited there, never
 * regenerated from here.
 */
export function useInstallmentOrder({
    account,
    banks,
    currency,
    date,
    db,
    income,
    initial,
    isSubscription,
    mode,
}: InstallmentOrderArgs) {
    const router = useRouter();
    const t = useTranslation();
    const { language } = useLanguage();
    const sheetRef = useRef<BottomSheetModal>(null);
    const [draft, setDraft] = useState<InstallmentDraft | null>(null);
    // Presented from an effect: the sheet mounts with the draft, a render after the tap that makes it.
    const [presented, setPresented] = useState(0);
    const [planId] = useState(() => (initial ? planIdForPurchase(db, initial.id) : null));
    const sources = banks.filter((bank) => bank.id !== account?.id && toAccountKind(bank.kind) !== "liability");
    const from = sources.find((bank) => bank.id === draft?.upfrontAccountId) ?? null;
    // Plan amounts are in the account's currency, so the purchase has to be in it too.
    const offered =
        mode === "create" &&
        account !== null &&
        toAccountKind(account.kind) === "liability" &&
        account.currency === currency &&
        !income &&
        !isSubscription;

    useEffect(() => {
        if (presented > 0) {
            sheetRef.current?.present();
        }
    }, [presented]);

    const verbs = (hasPrice: boolean, price: number): SentenceVerb[] => {
        if (planId !== null) {
            return [
                {
                    active: true,
                    key: "installments",
                    label: t("installments.order"),
                    onPress: () => router.push({ params: { planId }, pathname: "/installments/[planId]" }),
                },
            ];
        }
        if (!offered) {
            return [];
        }
        const first =
            draft === null ? null : draftSchedule(draft, price, date, currency)?.find((row) => row.sequence > 0);
        return [
            {
                active: draft !== null,
                disabled: !hasPrice,
                key: "installments",
                label:
                    draft && first
                        ? t("installments.chipSet", {
                              amount: formatAmount(first.amount, currency, true, language),
                              count: draft.count,
                          })
                        : t("installments.chip"),
                onPress: () => {
                    setDraft((current) => current ?? newInstallmentDraft(sources[0]?.id ?? null));
                    setPresented((count) => count + 1);
                },
                onRemove: () => setDraft(null),
                removeAccessibilityLabel: t("installments.chip"),
            },
        ];
    };

    /** The upfront's source: null when it was paid outside Outlayr, undefined while it cannot be converted. */
    const upfrontSource = (price: number): PaymentSource | null | undefined => {
        if (from === null) {
            return null;
        }
        const upfront = draft === null ? 0 : upfrontOf(draft, price, currency);
        return paymentSource(upfront, from, currency, paymentRate(db, from.currency, currency, date)) ?? undefined;
    };

    /** Why the order cannot be saved yet, or null. Opens the sheet on the answer. */
    const problem = (price: number): string | null => {
        if (!offered || draft === null) {
            return null;
        }
        let reason: string | null = null;
        if (draftSchedule(draft, price, date, currency) === null) {
            reason = t("installments.nothingLeft");
        } else if (upfrontOf(draft, price, currency) > 0 && upfrontSource(price) === undefined) {
            reason = t("installments.noRate");
        }
        if (reason !== null) {
            sheetRef.current?.present();
        }
        return reason;
    };

    /** Writes the purchase with its order when installments are on; null when they are off. */
    const save = (
        input: TransactionInput,
        price: number,
        inSameTransaction: (id: string) => Promise<void>
    ): Promise<string> | null => {
        const schedule = offered && draft !== null ? draftSchedule(draft, price, date, currency) : null;
        if (account === null || draft === null || schedule === null) {
            return null;
        }
        const hasUpfront = schedule.some((row) => row.sequence === 0);
        return installmentsRepo
            .createOrder(db, {
                inSameTransaction,
                installmentsPaidOutside: paidBeforeCount(draft, schedule, new Date()),
                purchase: { ...input, accountId: account.id },
                schedule,
                upfront: hasUpfront ? upfrontSource(price) : undefined,
            })
            .then(({ transactionId }) => transactionId);
    };

    const sheet = (price: number) =>
        offered && draft !== null ? (
            <InstallmentsSheet
                accounts={sources}
                currency={currency}
                draft={draft}
                onChange={setDraft}
                price={price}
                purchaseDay={date}
                ref={sheetRef}
                schedule={draftSchedule(draft, price, date, currency)}
            />
        ) : null;

    return { drafting: draft !== null, problem, save, sheet, verbs };
}
