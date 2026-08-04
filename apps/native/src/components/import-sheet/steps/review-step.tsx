import { HugeiconsIcon } from "@hugeicons/react-native";
import { CheckmarkCircle02Icon as CheckSolid } from "@hugeicons-pro/core-solid-rounded";
import { CheckmarkCircle02Icon as CheckOutline } from "@hugeicons-pro/core-stroke-rounded";
import { LegendList } from "@legendapp/list/react-native";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import type { ImportEntry, SkipReason } from "@/data/transfer-core";
import type { ImportReviewResult, ReviewRow } from "@/hooks/use-import-review";
import { type TranslationKey, useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

const SKIP_REASON_KEY: Record<SkipReason, TranslationKey> = {
	category: "import.skipReasonCategory",
	date: "import.skipReasonDate",
	amount: "import.skipReasonAmount",
};

interface EntryRowProps {
	index: number;
	entry: ImportEntry;
	duplicate: boolean;
	checked: boolean;
	categoryName: string | undefined;
	onToggle: (index: number) => void;
	onRender?: (index: number) => void;
}

export const EntryRow = memo(function EntryRow({
	index,
	entry,
	duplicate,
	checked,
	categoryName,
	onToggle,
	onRender,
}: EntryRowProps) {
	const t = useTranslation();
	const colors = useColors();
	onRender?.(index);

	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityState={{ checked }}
			className="flex-row items-center gap-3 border-border border-b py-3"
			onPress={() => onToggle(index)}
			testID={`review-row-${index}`}
		>
			<View testID={`review-row-checkbox-${index}`}>
				<HugeiconsIcon
					color={checked ? colors.foreground : colors.subtle}
					icon={checked ? CheckSolid : CheckOutline}
					size={22}
					strokeWidth={2}
				/>
			</View>
			<View className="flex-1">
				<Text className="text-body text-foreground" numberOfLines={1}>
					{entry.note || categoryName}
				</Text>
				{categoryName == null ? null : (
					<Text className="text-footnote text-muted" numberOfLines={1}>
						{categoryName}
					</Text>
				)}
				{duplicate ? (
					<Text className="text-danger text-footnote">
						{t("import.reviewDuplicateCaption")}
					</Text>
				) : null}
			</View>
			<View className="items-end">
				<Text
					className={cn(
						"font-sans-medium text-body tabular-nums",
						entry.income ? "text-income" : "text-foreground",
					)}
				>
					{entry.income ? "+" : ""}
					{entry.amount.toFixed(2)}
				</Text>
				<Text className="text-footnote text-subtle tabular-nums">
					{entry.date.toLocaleDateString()}
				</Text>
			</View>
		</Pressable>
	);
});

function SkippedHeaderRow({ count }: { count: number }) {
	const t = useTranslation();
	return (
		<Text className="pt-4 pb-2 font-sans-medium text-footnote text-muted">
			{t("import.reviewSkippedHeader", { count })}
		</Text>
	);
}

function SkippedEntryRow({ row, reason }: { row: number; reason: SkipReason }) {
	const t = useTranslation();
	return (
		<View className="flex-row items-center justify-between border-border border-b py-2">
			<Text className="text-footnote text-subtle tabular-nums">{row}</Text>
			<Text className="text-footnote text-muted">
				{t(SKIP_REASON_KEY[reason])}
			</Text>
		</View>
	);
}

export function renderReviewRow(
	item: ReviewRow,
	review: ImportReviewResult,
	onRowRender?: (index: number) => void,
) {
	if (item.kind === "entry") {
		return (
			<EntryRow
				categoryName={review.categoryName.get(item.entry.categoryId)}
				checked={!review.excluded.has(item.index)}
				duplicate={item.duplicate}
				entry={item.entry}
				index={item.index}
				onRender={onRowRender}
				onToggle={review.onToggle}
			/>
		);
	}
	if (item.kind === "header") {
		return <SkippedHeaderRow count={item.count} />;
	}
	return <SkippedEntryRow reason={item.reason} row={item.row} />;
}

interface ReviewStepProps {
	review: ImportReviewResult;
	onRowRender?: (index: number) => void;
}

export function ReviewStep({ review, onRowRender }: ReviewStepProps) {
	const t = useTranslation();

	if (review.rows.length === 0) {
		return (
			<View className="items-center pt-10">
				<Text className="text-muted text-subtitle">
					{t("import.reviewEmptyTitle")}
				</Text>
			</View>
		);
	}

	return (
		<View className="flex-1 gap-3 pt-2">
			{review.commit.phase === "failed" ? (
				<View className="gap-1 rounded-xl border border-danger/30 p-4">
					<Text className="font-sans-medium text-body text-danger">
						{t("import.reviewCommitFailedTitle")}
					</Text>
					<Text className="text-footnote text-muted">
						{t("import.reviewCommitFailedBody")}
					</Text>
					{review.commit.detail == null ? null : (
						<Text className="text-subtitle text-subtle">
							{review.commit.detail}
						</Text>
					)}
				</View>
			) : null}
			<LegendList
				data={review.rows}
				estimatedItemSize={64}
				extraData={review.excluded}
				getItemType={(row: ReviewRow) => row.kind}
				keyExtractor={(row: ReviewRow) => row.key}
				recycleItems={false}
				renderItem={({ item }: { item: ReviewRow }) =>
					renderReviewRow(item, review, onRowRender)
				}
				testID="review-list"
			/>
		</View>
	);
}
