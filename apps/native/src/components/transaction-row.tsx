import { HugeiconsIcon } from "@hugeicons/react-native";
import { RefreshIcon } from "@hugeicons-pro/core-stroke-rounded";
import { utcDateString } from "@outlayr/money/dates";
import { type AccessibilityActionEvent, Pressable, View } from "react-native";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { TransactionWithCategory } from "@/data/transactions";
import { formatTime, formatUpcomingDate, isFuture } from "@/domain/dates";
import { resolveTransactionIdentity } from "@/domain/transaction-identity";
import { isExact, type RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";
import { RowAmount } from "./amount-text";
import { CategoryIconTile } from "./category-icon-tile";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";
import { cn } from "./tw";

/** A 20pt glyph in 8pt of padding. */
const TILE_SIZE = 36;
const TILE_RADIUS = 9;

/** Custom, so it surfaces in the rotor's Actions rather than replacing a tap. */
const DELETE_ACTION = "delete";

interface TransactionRowProps {
	/** Global display currency, used when the row's own currency is null. */
	currency: string;
	/**
	 * Forces the upcoming variant. A scheduled entry whose stored date is already
	 * past is still upcoming — what is upcoming is its next occurrence — so the
	 * Upcoming section states it rather than letting the date decide.
	 */
	future?: boolean;
	/** When the row lands, for the upcoming variant's subtitle. */
	landsOn?: Date;
	/**
	 * Same deletion the swipe performs. Pass it on a surface whose rows swipe: a
	 * pan is the one gesture assistive technology cannot make, so the action has to
	 * also exist as an accessibility action.
	 */
	onDelete?: (id: string) => void;
	/** Opens the row's action menu. Omit on a surface that offers none. */
	onLongPress?: (id: string) => void;
	onPress: (id: string) => void;
	/** Rates for `currency`. Without it no row is marked unplaced. */
	rates?: RateTable;
	/**
	 * `details` is optional because most surfaces read a projection that leaves the
	 * free text out (`LOG_COLUMNS`); only the search read carries it, and only a
	 * row that has it prints the excerpt.
	 */
	transaction: TransactionWithCategory & { details?: string | null };
}

export function TransactionRow({
	transaction,
	currency,
	rates,
	onPress,
	onLongPress,
	onDelete,
	future: forcedFuture,
	landsOn,
}: TransactionRowProps) {
	const { showCents, swapTimeLabel, use24Hour } = useDisplaySettings().state;
	const colors = useColors();
	const t = useTranslation();
	const date = new Date(transaction.date);
	const future = forcedFuture ?? isFuture(date);
	const code = transaction.currency ?? currency;
	const isTransfer = "transferId" in transaction && Boolean(transaction.transferId);
	const identity = resolveTransactionIdentity(transaction);
	const recurring = transaction.recurringType > 0;
	const foreignCode = transaction.currency && transaction.currency !== currency ? transaction.currency : null;
	// A row that stated no currency is printed under the global code. That is a
	// fact only while something can place it; once nothing can, the code is an
	// assumption and the mark says so.
	const unplaced =
		transaction.currency === null &&
		rates !== undefined &&
		!isExact(
			{
				amount: transaction.amount,
				amountUsd: transaction.amountUsd,
				currency: null,
				dateKey: utcDateString(date.getTime()),
			},
			currency,
			rates
		);

	const timeLabel = swapTimeLabel ? (transaction.categoryName ?? "") : formatTime(date, use24Hour);
	const subtitle = future ? formatUpcomingDate(landsOn ?? date) : timeLabel;

	return (
		<Pressable
			// The hold is the only route to the action menu, and nothing on screen says
			// so; the rotor entry is the only route to Delete, which otherwise lives
			// behind a swipe no assistive gesture can perform.
			accessibilityActions={onDelete ? [{ label: t("log.row.deleteAccessibility"), name: DELETE_ACTION }] : undefined}
			accessibilityHint={onLongPress ? t("log.row.actionsHint") : undefined}
			accessibilityRole="button"
			className="flex-row items-center gap-3 py-2 active:opacity-70"
			onAccessibilityAction={
				onDelete
					? (event: AccessibilityActionEvent) => {
							if (event.nativeEvent.actionName === DELETE_ACTION) {
								onDelete(transaction.id);
							}
						}
					: undefined
			}
			onLongPress={onLongPress ? () => onLongPress(transaction.id) : undefined}
			onPress={() => onPress(transaction.id)}
		>
			<View>
				<CategoryIconTile
					color={isTransfer ? colors.transfer : identity.color}
					emoji={identity.emoji}
					future={future}
					icon={identity.icon}
					imageUri={transaction.imageUri}
					radius={TILE_RADIUS}
					size={TILE_SIZE}
					type="solid"
				/>
				{recurring ? (
					<View className="absolute rounded-md bg-surface-secondary" style={{ bottom: -5, padding: 3, right: -5 }}>
						<HugeiconsIcon color={colors.foreground} icon={RefreshIcon} size={12} strokeWidth={2} />
					</View>
				) : null}
			</View>
			<View className="flex-1 gap-0.5">
				<Text
					className={cn("font-sans-medium text-callout", future ? "text-future" : "text-foreground")}
					numberOfLines={1}
				>
					{transaction.note}
				</Text>
				<View className="flex-row items-center gap-1.25">
					<Text
						className={cn("font-sans-medium text-subtitle", future ? "text-subtle" : "text-muted")}
						numberOfLines={1}
					>
						{subtitle}
					</Text>
					{foreignCode ? (
						<View className="rounded-[3px] border border-border px-[3px]">
							<MonoLabel>{foreignCode}</MonoLabel>
						</View>
					) : null}
					{unplaced ? (
						<View
							accessibilityLabel={t("log.row.unplaced", { code: currency })}
							className="rounded-[3px] border border-border px-[3px]"
						>
							<MonoLabel className="text-subtle">{`${currency}?`}</MonoLabel>
						</View>
					) : null}
				</View>
				{transaction.details ? (
					<Text className={cn("text-footnote", future ? "text-subtle" : "text-muted")} numberOfLines={1}>
						{transaction.details}
					</Text>
				) : null}
			</View>
			<RowAmount
				amount={transaction.amount}
				code={code}
				income={transaction.income}
				isFuture={future}
				showCents={showCents}
				transfer={isTransfer}
			/>
		</Pressable>
	);
}
