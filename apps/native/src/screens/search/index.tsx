import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { SectionList, View } from "react-native";

import { DaySectionHeader } from "@/components/day-section-header";
import { TransactionRow } from "@/components/transaction-row";
import { useDatabase } from "@/contexts/local-data-context";
import { useSearchedTransactions } from "@/data/log-search";
import { useAllSettings } from "@/data/settings";
import { useValuation } from "@/data/use-valuation";
import type { Database } from "@/db/client";
import { groupByDay } from "@/domain/day-sections";
import { useTranslation } from "@/i18n";
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

	const rows = useSearchedTransactions(db, query);
	const sections = useMemo(
		() => groupByDay(rows, currency, rates),
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
					renderSectionHeader={({ section }) => (
						<DaySectionHeader
							section={section}
							showCents={showCents}
							first={sections[0] === section}
						/>
					)}
					renderItem={({ item }) => (
						<TransactionRow
							transaction={item}
							currency={currency}
							rates={rates}
							onPress={(id) => router.push(`/transaction/${id}`)}
							showCents={showCents}
							showSign={showSign}
							swapTimeLabel={swapTimeLabel}
						/>
					)}
				/>
			)}
		</>
	);
}
