import { HugeiconsIcon } from "@hugeicons/react-native";
import { RefreshIcon } from "@hugeicons-pro/core-stroke-rounded";
import { Pressable, View } from "react-native";
import type { TransactionWithCategory } from "@/data/transactions";
import { formatTime, formatUpcomingDate, isFuture } from "@/domain/dates";
import { resolveTransactionIdentity } from "@/domain/transaction-identity";
import { useColors } from "@/theme/use-colors";
import { RowAmount } from "./amount-text";
import { CategoryIconTile } from "./category-icon-tile";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";
import { cn } from "./tw";

/** A 20pt glyph in 8pt of padding. */
const TILE_SIZE = 36;
const TILE_RADIUS = 9;

interface TransactionRowProps {
	transaction: TransactionWithCategory;
	/** Global display currency, used when the row's own currency is null. */
	currency: string;
	onPress: (id: string) => void;
	/** Opens the row's action menu. Omit on a surface that offers none. */
	onLongPress?: (id: string) => void;
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
	/** Mirrors "Display +/- Symbol"; false drops the row's sign prefix. */
	showSign?: boolean;
	/** Mirrors "Swap Time Label": the subtitle shows the category name over the time. */
	swapTimeLabel?: boolean;
	/**
	 * Forces the upcoming variant. A scheduled entry whose stored date is already
	 * past is still upcoming — what is upcoming is its next occurrence — so the
	 * Upcoming section states it rather than letting the date decide.
	 */
	future?: boolean;
	/** When the row lands, for the upcoming variant's subtitle. */
	landsOn?: Date;
}

export function TransactionRow({
	transaction,
	currency,
	onPress,
	onLongPress,
	showCents = true,
	showSign = true,
	swapTimeLabel = false,
	future: forcedFuture,
	landsOn,
}: TransactionRowProps) {
	const colors = useColors();
	const date = new Date(transaction.date);
	const future = forcedFuture ?? isFuture(date);
	const code = transaction.currency ?? currency;
	const identity = resolveTransactionIdentity(transaction);
	const recurring = transaction.recurringType > 0;
	const foreignCode =
		transaction.currency && transaction.currency !== currency
			? transaction.currency
			: null;

	const subtitle = future
		? formatUpcomingDate(landsOn ?? date)
		: swapTimeLabel
			? (transaction.categoryName ?? "")
			: formatTime(date);

	return (
		<Pressable
			className="flex-row items-center gap-3 py-2 active:opacity-70"
			onPress={() => onPress(transaction.id)}
			onLongPress={onLongPress ? () => onLongPress(transaction.id) : undefined}
			accessibilityRole="button"
		>
			<View>
				<CategoryIconTile
					color={identity.color}
					emoji={identity.emoji}
					icon={identity.icon}
					size={TILE_SIZE}
					radius={TILE_RADIUS}
					type="solid"
					future={future}
					imageUri={transaction.imageUri}
				/>
				{recurring ? (
					<View
						className="absolute rounded-md bg-surface-secondary"
						style={{ right: -5, bottom: -5, padding: 3 }}
					>
						<HugeiconsIcon
							icon={RefreshIcon}
							size={12}
							color={colors.foreground}
							strokeWidth={2}
						/>
					</View>
				) : null}
			</View>
			<View className="flex-1 gap-0.5">
				<Text
					className={cn(
						"font-sans-medium text-callout",
						future ? "text-future" : "text-foreground",
					)}
					numberOfLines={1}
				>
					{transaction.note}
				</Text>
				<View className="flex-row items-center gap-1.25">
					<Text
						className={cn(
							"font-sans-medium text-subtitle",
							future ? "text-subtle" : "text-muted",
						)}
						numberOfLines={1}
					>
						{subtitle}
					</Text>
					{foreignCode ? (
						<View className="rounded-[3px] border border-border px-[3px]">
							<MonoLabel>{foreignCode}</MonoLabel>
						</View>
					) : null}
				</View>
			</View>
			<RowAmount
				amount={transaction.amount}
				income={transaction.income}
				isFuture={future}
				code={code}
				showCents={showCents}
				showSign={showSign}
			/>
		</Pressable>
	);
}
