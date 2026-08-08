import { HugeiconsIcon } from "@hugeicons/react-native";
import { CheckmarkCircle02Icon as CheckSolid } from "@hugeicons-pro/core-solid-rounded";
import { CircleIcon } from "@hugeicons-pro/core-stroke-rounded";
import { SectionList } from "@legendapp/list/section-list";
import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
	DayTotal,
	MeasureCellAmount,
	RowAmount,
} from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { ImportEntry, SkipReason } from "@/data/transfer-core";
import { formatDayHeader } from "@/domain/dates";
import { FALLBACK_IDENTITY_COLOR } from "@/domain/transaction-identity";
import type {
	ImportReviewResult,
	ReviewCategoryTile,
} from "@/hooks/use-import-review";
import { useReviewEnrichment } from "@/hooks/use-review-enrichment";
import { type TranslationKey, useTranslation } from "@/i18n";
import { LARGE_SHEET_TOP_INSET } from "@/lib/sheet-detents";
import { useColors } from "@/theme/use-colors";
import { MeasureStrip } from "../measure-strip";
import { StepCta } from "../step-cta";

const SKIP_REASON_KEY: Record<SkipReason, TranslationKey> = {
	category: "import.skipReasonCategory",
	date: "import.skipReasonDate",
	amount: "import.skipReasonAmount",
};

/** The Log row's tile: a 20pt glyph in 8pt of padding. */
const TILE_SIZE = 36;
const TILE_RADIUS = 9;
const ESTIMATED_ROW_HEIGHT = 56;
/** Chrome the step stacks around the list (sheet padding, header, measure strip, gaps, CTA), erring high so the capped step never outgrows a fitted sheet. */
const LIST_CHROME_HEIGHT = 224;
const COMMIT_FAILED_NOTICE_HEIGHT = 96;

interface ReviewEntryListRow {
	key: string;
	index: number;
	entry: ImportEntry;
	duplicate: boolean;
}

interface ReviewDaySection {
	key: string;
	day: Date;
	data: ReviewEntryListRow[];
}

function dayKeyOf(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

interface EntryRowProps {
	index: number;
	entry: ImportEntry;
	duplicate: boolean;
	checked: boolean;
	categoryName: string | undefined;
	tile: ReviewCategoryTile | undefined;
	displayName: string;
	logoUri: string | null;
	currency: string;
	onToggle: (index: number) => void;
}

export const EntryRow = memo(function EntryRow({
	index,
	entry,
	duplicate,
	checked,
	categoryName,
	tile,
	displayName,
	logoUri,
	currency,
	onToggle,
}: EntryRowProps) {
	const t = useTranslation();
	const colors = useColors();
	const { showCents } = useDisplaySettings().state;
	const onPress = useCallback(() => onToggle(index), [onToggle, index]);

	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityState={{ checked }}
			className={cn(
				"flex-row items-center gap-3 py-2 active:opacity-70",
				!checked && "opacity-40",
			)}
			onPress={onPress}
			testID={`review-row-${index}`}
		>
			<View testID={`review-row-checkbox-${index}`}>
				<HugeiconsIcon
					color={checked ? colors.foreground : colors.subtle}
					icon={checked ? CheckSolid : CircleIcon}
					size={22}
					strokeWidth={1.6}
				/>
			</View>
			<CategoryIconTile
				color={tile?.color ?? FALLBACK_IDENTITY_COLOR}
				emoji={tile?.emoji}
				icon={tile?.icon}
				imageUri={logoUri}
				radius={TILE_RADIUS}
				size={TILE_SIZE}
				type="solid"
			/>
			<View className="flex-1 gap-0.5">
				<Text
					className={cn(
						"font-sans-medium text-callout text-foreground",
						!checked && "line-through",
					)}
					numberOfLines={1}
				>
					{displayName}
				</Text>
				{duplicate ? (
					<Text className="text-danger text-footnote" numberOfLines={1}>
						{t("import.reviewDuplicateCaption")}
					</Text>
				) : categoryName == null ? null : (
					<Text
						className="font-sans-medium text-muted text-subtitle"
						numberOfLines={1}
					>
						{categoryName}
					</Text>
				)}
			</View>
			<View className="items-end gap-0.5">
				<RowAmount
					amount={entry.amount}
					code={entry.currency ?? currency}
					income={entry.income}
					isFuture={false}
					showCents={showCents}
					struck={!checked}
				/>
				<Text className="text-footnote text-subtle" numberOfLines={1}>
					{entry.date.toLocaleDateString(undefined, {
						day: "numeric",
						month: "short",
					})}
				</Text>
			</View>
		</Pressable>
	);
});

const DayHeader = memo(function DayHeader({
	day,
	total,
	currency,
	first,
}: {
	day: Date;
	total: number;
	currency: string;
	first: boolean;
}) {
	const { showCents } = useDisplaySettings().state;
	return (
		<View className={first ? "gap-1.25 pt-2.5" : "gap-1.25 pt-7"}>
			<View className="flex-row items-baseline justify-between gap-2">
				<MonoLabel>{formatDayHeader(day)}</MonoLabel>
				<DayTotal
					showCents={showCents}
					totals={[
						{ currencyCode: currency, amount: total, transactionCount: 0 },
					]}
				/>
			</View>
			{/* A 1.3 stroke with round caps, matching the Log's day rule. */}
			<View className="bg-border" style={{ height: 1.3, borderRadius: 0.65 }} />
		</View>
	);
});

interface ReviewStepProps {
	review: ImportReviewResult;
}

export function ReviewStep({ review }: ReviewStepProps) {
	const t = useTranslation();
	const { height: windowHeight } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const { showCents } = useDisplaySettings().state;
	const enrichment = useReviewEnrichment(review.plan.entries);
	const [showSkipped, setShowSkipped] = useState(false);
	const onToggleSkipped = useCallback(() => {
		setShowSkipped((current) => !current);
	}, []);

	const entryRows = useMemo(
		() => review.rows.filter((row) => row.kind === "entry"),
		[review.rows],
	);
	const skippedRows = useMemo(
		() => review.rows.filter((row) => row.kind === "skipped"),
		[review.rows],
	);

	const sections = useMemo<ReviewDaySection[]>(() => {
		const sorted = [...entryRows].sort(
			(a, b) => b.entry.date.getTime() - a.entry.date.getTime(),
		);
		const byDay = new Map<string, ReviewDaySection>();
		for (const row of sorted) {
			const key = dayKeyOf(row.entry.date);
			let section = byDay.get(key);
			if (section == null) {
				section = { key: `day-${key}`, day: row.entry.date, data: [] };
				byDay.set(key, section);
			}
			section.data.push({
				key: row.key,
				index: row.index,
				entry: row.entry,
				duplicate: row.duplicate,
			});
		}
		return [...byDay.values()];
	}, [entryRows]);

	const { outMagnitude, dayTotals } = useMemo(() => {
		let out = 0;
		const totals = new Map<string, number>();
		for (const row of entryRows) {
			if (review.excluded.has(row.index)) {
				continue;
			}
			if (!row.entry.income) {
				out += row.entry.amount;
			}
			const key = dayKeyOf(row.entry.date);
			const signed = row.entry.income ? row.entry.amount : -row.entry.amount;
			totals.set(key, (totals.get(key) ?? 0) + signed);
		}
		return { outMagnitude: out, dayTotals: totals };
	}, [entryRows, review.excluded]);

	const renderItem = useCallback(
		({ item }: { item: ReviewEntryListRow }) => (
			<EntryRow
				categoryName={review.categoryName.get(item.entry.categoryId)}
				checked={!review.excluded.has(item.index)}
				currency={review.currency}
				displayName={enrichment.get(item.index)?.displayName ?? item.entry.note}
				duplicate={item.duplicate}
				entry={item.entry}
				index={item.index}
				logoUri={enrichment.get(item.index)?.logoUri ?? null}
				onToggle={review.onToggle}
				tile={review.categoryTile.get(item.entry.categoryId)}
			/>
		),
		[
			review.currency,
			review.categoryName,
			review.categoryTile,
			review.excluded,
			review.onToggle,
			enrichment,
		],
	);

	const renderSectionHeader = useCallback(
		({ section }: { section: ReviewDaySection }) => (
			<DayHeader
				currency={review.currency}
				day={section.day}
				first={sections[0] === section}
				total={dayTotals.get(dayKeyOf(section.day)) ?? 0}
			/>
		),
		[review.currency, sections, dayTotals],
	);

	const skippedFooter =
		skippedRows.length === 0 ? null : (
			<View>
				<Pressable
					accessibilityRole="button"
					className="border-border border-b py-3 active:opacity-60"
					onPress={onToggleSkipped}
					testID="review-skipped-toggle"
				>
					<Text className="text-footnote text-muted">
						{t(
							showSkipped
								? "import.reviewSkippedHide"
								: "import.reviewSkippedShow",
							{ count: skippedRows.length },
						)}
					</Text>
				</Pressable>
				{showSkipped
					? skippedRows.map((row) => (
							<View
								className="flex-row items-center justify-between gap-3 border-border border-b py-2"
								key={row.key}
							>
								<MonoLabel>{String(row.row)}</MonoLabel>
								<Text className="text-footnote text-muted" numberOfLines={1}>
									{t(SKIP_REASON_KEY[row.reason])}
								</Text>
							</View>
						))
					: null}
			</View>
		);

	if (review.rows.length === 0) {
		return (
			<View className="items-center pt-10">
				<Text className="text-muted text-subtitle">
					{t("import.reviewEmptyTitle")}
				</Text>
			</View>
		);
	}

	const writing = review.commit.phase === "writing";
	const failed = review.commit.phase === "failed";

	// The sheet sizes to content (`enableDynamicSizing`), so flex heights are
	// inert here: an unbounded list grows past the sheet's cap and the tail
	// clips. Cap the list to what fits so it scrolls internally instead.
	const listMaxHeight =
		windowHeight -
		LARGE_SHEET_TOP_INSET -
		insets.bottom -
		LIST_CHROME_HEIGHT -
		(failed ? COMMIT_FAILED_NOTICE_HEIGHT : 0);

	return (
		<View className="flex-1 gap-3">
			{failed ? (
				<View
					className="mx-5 gap-1 border-border border-y py-3"
					testID="review-commit-failed"
				>
					<Text className="font-sans-medium text-body text-danger">
						{t("import.reviewCommitFailedTitle")}
					</Text>
					<Text className="text-footnote text-muted">
						{t("import.reviewCommitFailedBody")}
					</Text>
					{review.commit.phase === "failed" && review.commit.detail != null ? (
						<Text className="text-subtitle text-subtle">
							{review.commit.detail}
						</Text>
					) : null}
				</View>
			) : null}

			<MeasureStrip
				cells={[
					{
						key: "toImport",
						label: t("import.reviewToImportLabel"),
						value: t("import.reviewToImportValue", {
							count: review.selectedCount,
							total: entryRows.length,
						}),
					},
					{
						key: "out",
						label: t("log.measure.out"),
						value: (
							<MeasureCellAmount
								code={review.currency}
								income={false}
								magnitude={outMagnitude}
								positive={false}
								showCents={showCents}
							/>
						),
					},
				]}
				className="mx-5"
			/>

			<View style={{ maxHeight: listMaxHeight }} testID="review-list">
				<SectionList
					contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
					estimatedItemSize={ESTIMATED_ROW_HEIGHT}
					extraData={{ excluded: review.excluded, enrichment, showSkipped }}
					keyExtractor={keyOf}
					ListFooterComponent={skippedFooter}
					// Rows hold a toggle state; a recycled container would flash the
					// previous row's checked look before the fresh props land.
					recycleItems={false}
					renderItem={renderItem}
					renderSectionHeader={renderSectionHeader}
					sections={sections}
					stickySectionHeadersEnabled={false}
				/>
			</View>

			<View className="px-5">
				<StepCta
					busy={writing}
					confirmLabel={
						failed
							? undefined
							: t("import.reviewCommitConfirmCta", {
									count: review.selectedCount,
								})
					}
					disabled={review.selectedCount === 0 || writing}
					label={
						failed
							? t("import.tryAgain")
							: t("import.reviewCommitCta", { count: review.selectedCount })
					}
					onPress={review.onCommit}
					testID="review-commit-cta"
				/>
			</View>
		</View>
	);
}

function keyOf(item: ReviewEntryListRow): string {
	return item.key;
}
