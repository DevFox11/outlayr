import { SectionList } from "@legendapp/list/section-list";
import { isPerson, toAccountKind } from "@outlayr/money/account-kind";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo } from "react";
import { View } from "react-native";

import { HeroNumber } from "@/components/amount-text";
import { DaySectionHeader } from "@/components/day-section-header";
import { EmptyState } from "@/components/empty-state";
import { Tile } from "@/components/empty-state-parts";
import { MonoLabel } from "@/components/mono-label";
import { ScreenHeader } from "@/components/screen-header";
import { Text } from "@/components/text";
import { toolbarIcon } from "@/components/toolbar-icons";
import { TransactionRow } from "@/components/transaction-row";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountTransfers } from "@/data/account-transfers";
import { useAccountBalanceDetails, useAccounts, useAccountTransactions } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { useOutsidePaymentRows } from "@/data/installment-reads";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { formatSignedAmount } from "@/domain/account-display";
import { monthAbbrevTitle } from "@/domain/dates";
import { groupByDay } from "@/domain/day-sections";
import { mergeByRecency } from "@/domain/transfer-log-rows";
import { useLanguage, useTranslation } from "@/i18n/context";
import { PersonHero, PersonToolbar } from "@/screens/debts/person-header";

import { AccountBalanceChart } from "./components/account-balance-chart";
import { InstallmentSections } from "./components/installment-sections";

export function AccountDetail({ id }: { id: string }) {
    const db = useDatabase();
    const router = useRouter();
    const accounts = useAccounts(db);
    // A delete from the edit sheet holds its write for the undo window, so the row
    // is still readable here. Pending counts as gone, or this screen sits on a
    // doomed account and then pops on its own ten seconds later.
    const { pendingId } = useDeferredDelete("account");
    const account = accounts.find((row) => row.id === id && row.id !== pendingId) ?? null;

    useEffect(() => {
        if (account == null) {
            router.back();
        }
    }, [account, router]);

    if (account == null) {
        return null;
    }
    return <AccountDetailLoaded account={account} db={db} />;
}

function AccountDetailLoaded({ account, db }: { account: Account; db: Database }) {
    const router = useRouter();
    const t = useTranslation();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const nowMs = useNow();
    const { balance, cells, rates } = useAccountBalanceDetails(db, account, nowMs);
    const transactionRows = useAccountTransactions(db, account.id);
    const transferRows = useAccountTransfers(db, account.id);
    const outsideRows = useOutsidePaymentRows(
        db,
        toAccountKind(account.kind) === "liability" ? account : null,
        t("installments.paidOutside")
    );
    const rows = useMemo(
        () => mergeByRecency(mergeByRecency(transactionRows, transferRows), outsideRows),
        [transactionRows, transferRows, outsideRows]
    );
    const sections = useMemo(() => groupByDay(rows, account.currency, rates), [rows, account.currency, rates]);
    const transferIds = useMemo(() => new Set(transferRows.map((transfer) => transfer.id)), [transferRows]);
    // A transfer id is not a transaction id: `/transactions/[id]` finds nothing behind it.
    const outsidePlans = useMemo(() => new Map(outsideRows.map((row) => [row.id, row.planId])), [outsideRows]);
    const openRow = useCallback(
        (rowId: string) => {
            const planId = outsidePlans.get(rowId);
            if (planId === undefined) {
                router.push(transferIds.has(rowId) ? `/transactions/transfers/${rowId}` : `/transactions/${rowId}`);
            } else {
                router.push({ params: { planId }, pathname: "/installments/[planId]" });
            }
        },
        [router, transferIds, outsidePlans]
    );

    // A person shares the history, but reads as a debt and keeps out of the account editor.
    const person = isPerson(account);
    const startedAt = t("accounts.detail.startedAt", {
        amount: formatSignedAmount(account.initialBalance, account.currency, showCents, language),
        month: `${monthAbbrevTitle(account.initialBalanceDate, language)} ${account.initialBalanceDate.getFullYear()}`,
    });

    return (
        <>
            <ScreenHeader title={account.name} />
            <Stack.Screen.BackButton displayMode="minimal" />
            {person ? (
                <PersonToolbar account={account} db={db} />
            ) : (
                <Stack.Toolbar placement="right">
                    <Stack.Toolbar.Button
                        {...toolbarIcon("more")}
                        accessibilityLabel={t("accounts.a11y.edit")}
                        onPress={() =>
                            router.push({
                                params: { accountId: account.id },
                                pathname: "/accounts/[accountId]/edit",
                            })
                        }
                    />
                </Stack.Toolbar>
            )}
            <SectionList
                className="bg-background"
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingBottom: 40,
                    paddingHorizontal: 20,
                }}
                contentInsetAdjustmentBehavior="automatic"
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <EmptyState
                        body={t(person ? "debts.person.empty" : "accounts.detail.empty")}
                        className="pt-4"
                        mark={<DetailMark />}
                        tier="inFlow"
                    />
                }
                ListHeaderComponent={
                    person ? (
                        <PersonHero account={account} balance={balance.total} showCents={showCents} />
                    ) : (
                        <View className="items-center gap-1 pt-6 pb-4">
                            <View className="flex-row items-center gap-2">
                                <HeroNumber
                                    amount={balance.total}
                                    code={account.currency}
                                    showCents={showCents}
                                    sign={balance.total < 0 ? "-" : ""}
                                />
                                {balance.exact ? null : (
                                    <View className="border-border rounded-[3px] border px-[3px]">
                                        <MonoLabel className="text-subtle">{`${account.currency}?`}</MonoLabel>
                                    </View>
                                )}
                            </View>
                            <Text className="font-sans-medium text-muted text-subtitle">{startedAt}</Text>
                            <AccountBalanceChart account={account} cells={cells} rates={rates} showCents={showCents} />
                            {toAccountKind(account.kind) === "liability" ? (
                                <InstallmentSections accountId={account.id} db={db} nowMs={nowMs} />
                            ) : null}
                        </View>
                    )
                }
                recycleItems={false}
                renderItem={({ item }) => (
                    <AccountTransactionRow
                        currency={account.currency}
                        onPress={openRow}
                        rates={rates}
                        transaction={item}
                    />
                )}
                renderSectionHeader={({ section }) => (
                    <DaySectionHeader first={sections[0] === section} section={section} />
                )}
                sections={sections}
                stickySectionHeadersEnabled={false}
            />
        </>
    );
}

const MARK_TILE = 26;

function DetailMark() {
    return (
        <View className="flex-row items-center" style={{ gap: 9 }}>
            <Tile opacity={1} size={MARK_TILE} />
            <Tile opacity={0.5} size={MARK_TILE} />
        </View>
    );
}

const AccountTransactionRow = memo(TransactionRow);
