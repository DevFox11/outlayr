import { useCallback, useRef, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";

import type { ActionMenuItem } from "@/components/action-menu";
import { ArrivalMark } from "@/components/arrival-mark";
import { Text } from "@/components/text";
import { TransactionRow } from "@/components/transaction-row";
import type { TransactionWithCategory } from "@/data/transactions";
import type { RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n/context";
import { freshEntries } from "@/lib/fresh-entries";

interface SwipeableTransactionRowProps {
    currency: string;
    /** The row's context menu, opened by holding it. */
    menuItems: readonly ActionMenuItem[];
    onDelete: (id: string) => void;
    onPress: (id: string) => void;
    rates?: RateTable;
    transaction: TransactionWithCategory;
}

export function SwipeableTransactionRow({
    transaction,
    currency,
    rates,
    onPress,
    menuItems,
    onDelete,
}: SwipeableTransactionRowProps) {
    const swipeRef = useRef<SwipeableMethods>(null);
    const t = useTranslation();
    const { id } = transaction;
    const fresh = useSyncExternalStore(freshEntries.subscribe, () => freshEntries.has(id));
    const settle = useCallback(() => freshEntries.settle(id), [id]);

    const renderRightActions = () => (
        <Pressable
            accessibilityLabel={t("log.row.deleteAccessibility")}
            accessibilityRole="button"
            className="bg-danger-fill my-1 ml-3 items-center justify-center rounded-xl px-6"
            onPress={() => {
                swipeRef.current?.close();
                onDelete(transaction.id);
            }}
        >
            <Text className="font-sans-semibold text-subtitle text-white">{t("log.row.delete")}</Text>
        </Pressable>
    );

    return (
        <View>
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
                        menuItems={menuItems}
                        onDelete={onDelete}
                        onPress={onPress}
                        rates={rates}
                        transaction={transaction}
                    />
                </Animated.View>
            </ReanimatedSwipeable>
            {fresh ? <ArrivalMark onSettled={settle} /> : null}
        </View>
    );
}
