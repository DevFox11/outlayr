import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { toAccountKind } from "@outlayr/money/account-kind";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountTile } from "@/components/account-tile";
import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { HeroNumber } from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { EditorCta } from "@/components/editor-cta";
import { InlineFailure } from "@/components/form/inline-failure";
import { ChoiceRow } from "@/components/list/list-row";
import { MonoLabel } from "@/components/mono-label";
import { ScreenHeader } from "@/components/screen-header";
import { revealEntering } from "@/components/sentence/sentence-motion";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountBalance, useAccounts, useBankAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { getLastUsedAccount } from "@/data/accounts-core";
import { usePaymentRate } from "@/data/installment-reads";
import { useInstallmentPlans } from "@/data/installments";
import { installmentsRepo } from "@/data/installments-core";
import type { PlanWithStanding } from "@/data/installments-core";
import { useNow } from "@/data/use-now";
import { formatTargetDate } from "@/domain/dates";
import { paymentSource } from "@/domain/installment-payment";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { formatRateFigure, pairQuotedInverse, quotePairRate } from "@/domain/transaction-entry-rate";
import { quotedByBcv } from "@/domain/transaction-form-labels";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";
import { CompactDatePicker } from "@/screens/budgets/components/compact-date-picker";
import { EditorRow } from "@/screens/budgets/components/editor-row";
import { useColors } from "@/theme/use-colors";

import { orderName } from "./labels";

/**
 * Paying an order, confirmed by hand: installments never post themselves. The
 * amount is the next cuota's (or everything left, from "Pay all") and can be
 * lowered into a partial payment; a payment from another currency is converted
 * at the day's official rate, as the transfer editor converts one.
 */
export function PayInstallment({ all, planId }: { all: boolean; planId: string }) {
    const db = useDatabase();
    const router = useRouter();
    const nowMs = useNow();
    const entry = useInstallmentPlans(db, nowMs).find(({ plan }) => plan.id === planId) ?? null;
    const accounts = useAccounts(db);
    const sources = useBankAccounts(db).filter(
        (account) => account.id !== entry?.plan.accountId && toAccountKind(account.kind) !== "liability"
    );

    useEffect(() => {
        if (entry == null) {
            router.back();
        }
    }, [entry, router]);

    const owed = entry?.standing.next;
    if (entry == null || owed == null) {
        return null;
    }
    return (
        <PayForm
            account={accounts.find((account) => account.id === entry.plan.accountId) ?? null}
            amount={all ? entry.standing.remaining : owed.remaining}
            entry={entry}
            forNext={!all}
            sources={sources}
        />
    );
}

interface PayFormProps {
    account: Account | null;
    amount: number;
    entry: PlanWithStanding;
    /** Names the cuota being paid; "Pay all" names only the order. */
    forNext: boolean;
    sources: readonly Account[];
}

function PayForm({ account, amount: owed, entry, forNext, sources }: PayFormProps) {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const haptics = useHaptics();
    const insets = useSafeAreaInsets();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const { plan, purchase, standing } = entry;
    const minorUnits = minorUnitsFor(plan.currency);
    const padRef = useRef<BottomSheetModal>(null);
    const [padText, setPadText] = useState(() => numberToNumpad(owed, minorUnits));
    const [date, setDate] = useState(() => new Date());
    const [pickingDate, setPickingDate] = useState(false);
    const [pickingFrom, setPickingFrom] = useState(false);
    // Null is None: paid outside Outlayr.
    const [fromId, setFromId] = useState<string | null>(() => {
        const last = getLastUsedAccount(db);
        return sources.find((source) => source.id === last?.id)?.id ?? sources[0]?.id ?? null;
    });
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const from = sources.find((source) => source.id === fromId) ?? null;
    const amount = numpadToNumber(padText);
    const rate = usePaymentRate(db, from?.currency ?? plan.currency, plan.currency, date);
    const source = from === null ? null : paymentSource(amount, from, plan.currency, rate);
    const canPay = amount > 0 && (from === null || source !== null);
    const money = (value: number, code = plan.currency) => formatAmount(value, code, showCents, language);
    const converted = from ? convertedLine(t, language, amount, from.currency, plan.currency, rate) : null;
    const accountName = account?.name ?? "";

    const name = orderName(t, purchase);
    const { next } = standing;
    const forLabel =
        forNext && next
            ? t("installments.forOrder", {
                  count: standing.installmentsTotal,
                  index: next.row.sequence,
                  order: name,
              })
            : name;

    const confirm = async () => {
        if (busy || !canPay) {
            return;
        }
        setBusy(true);
        setFailure(null);
        try {
            await installmentsRepo.recordPayment(db, { amount, date, planId: plan.id, source });
            haptics("success");
            router.back();
        } catch (error) {
            console.error("Failed to record the installment payment", error);
            haptics("error");
            setFailure(t("installments.failedBody"));
            setBusy(false);
        }
    };

    return (
        <View className="bg-background flex-1" collapsable={false}>
            <ScreenHeader title={account ? t("installments.pay.to", { account: account.name }) : undefined} />
            {/* react-native-screens resizes a ScrollView on a formSheet's first-child chain to the whole sheet. */}
            <View collapsable={false} />
            <View className="flex-1">
                <ScrollView
                    contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20 }}
                    contentInsetAdjustmentBehavior="automatic"
                >
                    {pickingFrom ? (
                        <Animated.View entering={revealEntering()}>
                            <MonoLabel accessibilityRole="header" className="pt-2 pb-1.5">
                                {t("installments.from")}
                            </MonoLabel>
                            <View className="border-border border-t">
                                <ChoiceRow
                                    detail={t("installments.from.outside", { account: accountName })}
                                    label={t("installments.from.none")}
                                    leading={<SourceTile account={null} />}
                                    onPress={() => {
                                        setFromId(null);
                                        setPickingFrom(false);
                                    }}
                                    selected={from === null}
                                />
                                {sources.map((option) => (
                                    <SourceChoice
                                        account={option}
                                        amount={amount}
                                        date={date}
                                        key={option.id}
                                        onPress={() => {
                                            setFromId(option.id);
                                            setPickingFrom(false);
                                        }}
                                        selected={option.id === from?.id}
                                        toCurrency={plan.currency}
                                    />
                                ))}
                            </View>
                        </Animated.View>
                    ) : (
                        <>
                            <Pressable
                                accessibilityLabel={t("installments.cuota.amount")}
                                accessibilityRole="button"
                                className="items-center gap-1 pt-4 pb-6"
                                onPress={() => padRef.current?.present()}
                            >
                                <HeroNumber amount={amount} code={plan.currency} showCents sign="" />
                                {converted ? (
                                    <Text className="text-muted text-subtitle tabular-nums">{converted}</Text>
                                ) : null}
                            </Pressable>

                            <View className="border-border border-t">
                                <View className="border-border flex-row items-center gap-3 border-b py-3.5">
                                    <Text className="text-body text-foreground flex-1">
                                        {t("installments.pay.for")}
                                    </Text>
                                    <Text className="text-body text-muted" numberOfLines={1}>
                                        {forLabel}
                                    </Text>
                                </View>
                                <EditorRow
                                    label={t("installments.from")}
                                    onPress={() => setPickingFrom(true)}
                                    value={
                                        from
                                            ? from.name
                                            : `${t("installments.from.none")} · ${t("installments.notFromAccount")}`
                                    }
                                />
                                <EditorRow
                                    label={t("installments.pay.date")}
                                    onPress={() => setPickingDate((open) => !open)}
                                    value={formatTargetDate(date, language)}
                                />
                                {pickingDate ? (
                                    <Animated.View className="border-border border-b py-2" entering={revealEntering()}>
                                        <CompactDatePicker
                                            label={t("installments.pay.date")}
                                            onChange={(picked) => {
                                                setPickingDate(false);
                                                setDate(picked);
                                            }}
                                            onDismiss={() => setPickingDate(false)}
                                            range={{ end: new Date() }}
                                            value={date}
                                        />
                                    </Animated.View>
                                ) : null}
                            </View>
                        </>
                    )}
                </ScrollView>
            </View>

            {pickingFrom ? null : (
                <View className="px-5" style={{ paddingBottom: insets.bottom + 8 }}>
                    <InlineFailure message={failure} />
                    <EditorCta
                        busy={busy}
                        canSave={canPay}
                        label={t("installments.pay", { amount: money(amount) })}
                        onPress={confirm}
                    />
                </View>
            )}

            <AmountEntrySheet
                code={plan.currency}
                minorUnits={minorUnits}
                onChange={setPadText}
                onDone={() => padRef.current?.dismiss()}
                ref={padRef}
                value={padText}
            />
        </View>
    );
}

type Translate = ReturnType<typeof useTranslation>;
type Language = ReturnType<typeof useLanguage>["language"];

/** "Bs 4,370.60 at BCV 218.53" for a payment from another currency, null in the same one. */
function convertedLine(
    t: Translate,
    language: Language,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rate: number | null
): string | null {
    if (fromCurrency === toCurrency) {
        return null;
    }
    const source = paymentSource(amount, { currency: fromCurrency, id: "" }, toCurrency, rate);
    if (source === null || rate === null) {
        return t("installments.noRate");
    }
    return t("installments.pay.converted", {
        amount: formatAmount(source.fromAmount, fromCurrency, true, language),
        rate: `${quotedByBcv(fromCurrency, toCurrency) ? "BCV " : ""}${formatRateFigure(
            quotePairRate(pairQuotedInverse(fromCurrency, toCurrency), rate),
            language
        )}`,
    });
}

const TILE = 28;

function SourceTile({ account }: { account: Account | null }) {
    const colors = useColors();
    return account ? (
        <AccountTile account={account} size={TILE} />
    ) : (
        <CategoryIconTile color={colors.muted} icon={null} size={TILE} type="solid" />
    );
}

interface SourceChoiceProps {
    account: Account;
    amount: number;
    date: Date;
    onPress: () => void;
    selected: boolean;
    toCurrency: string;
}

/** One account the payment can come from: its balance, and what the payment costs it in its own currency. */
function SourceChoice({ account, amount, date, onPress, selected, toCurrency }: SourceChoiceProps) {
    const db = useDatabase();
    const t = useTranslation();
    const nowMs = useNow();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const balance = useAccountBalance(db, account, nowMs);
    const rate = usePaymentRate(db, account.currency, toCurrency, date);
    return (
        <ChoiceRow
            detail={convertedLine(t, language, amount, account.currency, toCurrency, rate) ?? undefined}
            label={account.name}
            leading={<SourceTile account={account} />}
            onPress={onPress}
            selected={selected}
            value={formatAmount(balance.total, account.currency, showCents, language)}
        />
    );
}
