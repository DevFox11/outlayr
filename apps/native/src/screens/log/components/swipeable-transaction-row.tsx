import { useRef } from "react";
import { Pressable } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";
import { Text } from "@/components/text";
import { TransactionRow } from "@/components/transaction-row";
import type { TransactionWithCategory } from "@/data/transactions";
import type { RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n/context";

interface SwipeableTransactionRowProps {
	currency: string;
	onDelete: (id: string) => void;
	onLongPress: (id: string) => void;
	onPress: (id: string) => void;
	rates?: RateTable;
	transaction: TransactionWithCategory;
}

export function SwipeableTransactionRow({
	transaction,
	currency,
	rates,
	onPress,
	onLongPress,
	onDelete,
}: SwipeableTransactionRowProps) {
	const swipeRef = useRef<SwipeableMethods>(null);
	const t = useTranslation();

	const renderRightActions = () => (
		<Pressable
			accessibilityLabel={t("log.row.deleteAccessibility")}
			accessibilityRole="button"
			className="my-1 ml-3 items-center justify-center rounded-xl bg-danger-fill px-6"
			onPress={() => {
				swipeRef.current?.close();
				onDelete(transaction.id);
			}}
		>
			<Text className="font-sans-semibold text-subtitle text-white">{t("log.row.delete")}</Text>
		</Pressable>
	);

	return (
		<ReanimatedSwipeable
			friction={2}
			overshootRight={false}
			ref={swipeRef}
			renderRightActions={renderRightActions}
			rightThreshold={40}
		>
			<Animated.View className="bg-background">
				<TransactionRow
					currency={currency}
					onDelete={onDelete}
					onLongPress={onLongPress}
					onPress={onPress}
					rates={rates}
					transaction={transaction}
				/>
			</Animated.View>
		</ReanimatedSwipeable>
	);
}
