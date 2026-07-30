import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { SectionList, View } from "react-native";

import { MeasureCellAmount } from "@/components/amount-text";
import { DaySectionHeader } from "@/components/day-section-header";
import { MonoLabel } from "@/components/mono-label";
import { TransactionRow } from "@/components/transaction-row";
import { useDatabase } from "@/contexts/local-data-context";
import { useSearchedTransactions } from "@/data/log-search";
import { useAllSettings } from "@/data/settings";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import { useValuation } from "@/data/use-valuation";
import type { Database } from "@/db/client";
import {
	type CurrencyFigures,
	cellFigures,
	toCells,
} from "@/domain/currency-totals";
import { groupByDay } from "@/domain/day-sections";
import { useTranslation } from "@/i18n";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";
import { UndoToast } from "@/screens/log/components/undo-toast";
import { SearchEmptyState } from "./components/search-empty-state";

export default function SearchScreen() {
	const db = useDatabase();
	return <SearchContent db={db} />;
}

/**
 * A modal rather than a field on the Log: pinning the field open there forces the
 * title inline and costs the large title.
 */
function SearchContent({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const { displayCurrency: currency, rates } = useValuation(db);
	const settings = useAllSettings(db);
	const showCents = settings.bool("showCents");
	const showSign = settings.bool("showExpenseOrIncomeSign");
	const swapTimeLabel = settings.bool("swapTimeLabel");
	const [query, setQuery] = useState("");
	const nowMs = useNow();
	const { pendingId, requestDelete, undo } = useDeferredDelete(db);
	const openRowActions = useTransactionRowActions(db, nowMs, requestDelete);

	const found = useSearchedTransactions(db, query, nowMs);
	const rows = useMemo(
		() => found.filter((row) => row.id !== pendingId),
		[found, pendingId],
	);
	const sections = useMemo(
		() => groupByDay(rows, currency, rates),
		[rows, currency, rates],
	);
	const figures = useMemo(
		() => cellFigures(toCells(rows), currency, rates),
		[rows, currency, rates],
	);

	const empty =
		query.trim() === "" ? (
			<SearchEmptyState kind="idle" />
		) : rows.length === 0 ? (
			<SearchEmptyState kind="noResults" query={query} />
		) : null;

	return (
		<>
			<Stack.SearchBar
				autoFocus
				placeholder={t("search.placeholder")}
				hideWhenScrolling={false}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				// The field's Cancel closes the whole task, not just the field.
				onCancelButtonPress={() => router.back()}
			/>
			{empty ? (
				<View className="flex-1 bg-background">{empty}</View>
			) : (
				<SectionList
					className="bg-background"
					contentInsetAdjustmentBehavior="automatic"
					sections={sections}
					keyExtractor={(item) => item.id}
					stickySectionHeadersEnabled={false}
					keyboardDismissMode="on-drag"
					contentContainerStyle={{
						paddingHorizontal: 20,
						paddingBottom: 40,
					}}
					ListHeaderComponent={
						<SearchResultsTotal
							count={rows.length}
							figures={figures}
							showCents={showCents}
						/>
					}
					renderSectionHeader={({ section }) => (
						<DaySectionHeader section={section} showCents={showCents} />
					)}
					renderItem={({ item }) => (
						<TransactionRow
							transaction={item}
							currency={currency}
							rates={rates}
							onPress={(id) => router.push(`/transaction/${id}`)}
							onLongPress={(id) => openRowActions(id, false)}
							showCents={showCents}
							showSign={showSign}
							swapTimeLabel={swapTimeLabel}
						/>
					)}
				/>
			)}
			<UndoToast onUndo={undo} visible={pendingId != null} />
		</>
	);
}

interface SearchResultsTotalProps {
	/** One block per currency the results ended up expressed in, dominant first. */
	figures: readonly CurrencyFigures[];
	/** Rows matched, across every currency. */
	count: number;
	showCents: boolean;
}

/**
 * "How much have I spent on this" is the question the day groups cannot answer,
 * so the header totals the whole result set rather than any window of it. A
 * mixed-currency result gets a block each: nothing here holds a rate across them,
 * and one combined figure would be an invention.
 */
function SearchResultsTotal({
	figures,
	count,
	showCents,
}: SearchResultsTotalProps) {
	const t = useTranslation();
	const named = figures.length > 1;

	return (
		<View className="gap-2.5 pt-3.5 pb-1.5">
			<MonoLabel>{t("search.results.count", { count })}</MonoLabel>
			{figures.map((entry) => {
				const net = entry.income - entry.expense;
				const cells = [
					{
						key: "in",
						label: t("search.results.in"),
						magnitude: entry.income,
						positive: true,
						// Only money actually coming in earns the income colour; a positive
						// net is still just a net.
						income: true,
					},
					{
						key: "out",
						label: t("search.results.out"),
						magnitude: entry.expense,
						positive: false,
						income: false,
					},
					{
						key: "net",
						label: t("search.results.net"),
						magnitude: Math.abs(net),
						positive: net >= 0,
						income: false,
					},
				];

				return (
					<View className="gap-1.25" key={entry.currencyCode}>
						{named ? <MonoLabel>{entry.currencyCode}</MonoLabel> : null}
						<View className="h-px w-full bg-border" />
						<View className="flex-row">
							{cells.map((cell) => (
								<View className="flex-1 gap-0.75 py-2.5" key={cell.key}>
									<MonoLabel>{cell.label}</MonoLabel>
									<MeasureCellAmount
										code={entry.currencyCode}
										income={cell.income}
										magnitude={cell.magnitude}
										positive={cell.positive}
										showCents={showCents}
									/>
								</View>
							))}
						</View>
					</View>
				);
			})}
		</View>
	);
}
