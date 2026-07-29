import { useRef } from "react";
import { Pressable } from "react-native";
import ReanimatedSwipeable, {
	type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";
import { Text } from "@/components/text";
import { TransactionRow } from "@/components/transaction-row";
import type { TransactionWithCategory } from "@/data/transactions";
import type { RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n";

interface SwipeableTransactionRowProps {
	transaction: TransactionWithCategory;
	currency: string;
	rates?: RateTable;
	onPress: (id: string) => void;
	onLongPress: (id: string) => void;
	onDelete: (id: string) => void;
	showCents?: boolean;
	showSign?: boolean;
	/** The subtitle shows the category name over the time. */
	swapTimeLabel?: boolean;
}

export function SwipeableTransactionRow({
	transaction,
	currency,
	rates,
	onPress,
	onLongPress,
	onDelete,
	showCents = true,
	showSign = true,
	swapTimeLabel = false,
}: SwipeableTransactionRowProps) {
	const swipeRef = useRef<SwipeableMethods>(null);
	const t = useTranslation();

	const renderRightActions = () => (
		<Pressable
			className="my-1 ml-3 items-center justify-center rounded-xl bg-danger px-6"
			onPress={() => {
				swipeRef.current?.close();
				onDelete(transaction.id);
			}}
			accessibilityRole="button"
			accessibilityLabel={t("log.row.deleteAccessibility")}
		>
			<Text className="font-sans-semibold text-subtitle text-white">
				{t("log.row.delete")}
			</Text>
		</Pressable>
	);

	return (
		<ReanimatedSwipeable
			ref={swipeRef}
			friction={2}
			rightThreshold={40}
			overshootRight={false}
			renderRightActions={renderRightActions}
		>
			<Animated.View className="bg-background">
				<TransactionRow
					transaction={transaction}
					currency={currency}
					rates={rates}
					onPress={onPress}
					onLongPress={onLongPress}
					showCents={showCents}
					showSign={showSign}
					swapTimeLabel={swapTimeLabel}
				/>
			</Animated.View>
		</ReanimatedSwipeable>
	);
}
