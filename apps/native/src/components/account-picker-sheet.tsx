import { BottomSheetModal, BottomSheetScrollView } from "@expo/ui/community/bottom-sheet";
import { type Ref, useCallback, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import type { Database } from "@/db/client";
import { useTranslation } from "@/i18n/context";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { CategoryIconTile } from "./category-icon-tile";
import { Text } from "./text";

interface AccountPickerSheetProps {
	db: Database;
	onCreate: () => void;
	onSelect: (account: Account | null) => void;
	ref?: Ref<BottomSheetModal>;
	selectedId: string | null;
}

export type AccountPickerSheetRef = BottomSheetModal;

/** Present via the forwarded ref: `ref.current?.present()`. */
export function AccountPickerSheet({ db, selectedId, onSelect, onCreate, ref }: AccountPickerSheetProps) {
	const t = useTranslation();
	const colors = useColors();
	const accounts = useAccounts(db);
	const sheetRef = useRef<BottomSheetModal>(null);

	const setRefs = useCallback(
		(node: BottomSheetModal | null) => {
			sheetRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		},
		[ref]
	);

	const pick = useCallback(
		(account: Account | null) => {
			onSelect(account);
			sheetRef.current?.dismiss();
		},
		[onSelect]
	);

	return (
		<BottomSheetModal
			backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
			enableDynamicSizing={false}
			enablePanDownToClose
			ref={setRefs}
			snapPoints={["50%"]}
		>
			<View className="h-11 justify-center px-4">
				<Text accessibilityRole="header" className="text-center font-sans-semibold text-callout text-foreground">
					{t("transaction.account.title")}
				</Text>
				<Pressable
					accessibilityRole="button"
					className="absolute top-0 right-4 bottom-0 justify-center active:opacity-60"
					hitSlop={8}
					onPress={() => sheetRef.current?.dismiss()}
				>
					<Text className="font-sans-semibold text-callout text-tint">{t("common.done")}</Text>
				</Pressable>
			</View>

			{accounts.length === 0 ? (
				<View className="flex-1 items-center justify-center gap-4 px-8 pb-16">
					<Text className="text-center text-callout text-muted">{t("transaction.account.empty")}</Text>
					<Pressable accessibilityRole="button" className="active:opacity-60" hitSlop={8} onPress={onCreate}>
						<Text className="font-sans-semibold text-callout text-tint">{t("transaction.account.create")}</Text>
					</Pressable>
				</View>
			) : (
				<BottomSheetScrollView
					contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
					style={{ flex: 1 }}
				>
					<View className="overflow-hidden rounded-xl bg-surface">
						<AccountRow
							account={null}
							noneLabel={t("transaction.account.none")}
							onPick={pick}
							selected={selectedId === null}
						/>
						{accounts.map((account) => (
							<View key={account.id}>
								<View
									className="ml-[58px]"
									style={{
										backgroundColor: withAlpha(colors.foreground, 0.07),
										height: StyleSheet.hairlineWidth,
									}}
								/>
								<AccountRow account={account} noneLabel="" onPick={pick} selected={account.id === selectedId} />
							</View>
						))}
					</View>
				</BottomSheetScrollView>
			)}
		</BottomSheetModal>
	);
}

function AccountRow({
	account,
	noneLabel,
	selected,
	onPick,
}: {
	account: Account | null;
	noneLabel: string;
	selected: boolean;
	onPick: (account: Account | null) => void;
}) {
	const colors = useColors();
	const tint = account == null ? colors.muted : (account.imageColor ?? account.customColor ?? colors.foreground);

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			className="flex-row items-center gap-3 py-[11px] pr-3.5 pl-3.5 active:opacity-60"
			onPress={() => onPick(account)}
		>
			<CategoryIconTile
				color={tint}
				emoji={account?.emoji ?? null}
				icon={account?.icon ?? null}
				imageUri={account?.imageUri ?? null}
				size={28}
				type={selected ? "solid" : "stroke"}
			/>
			<View className="flex-1">
				<Text className="font-sans-medium text-callout text-foreground" numberOfLines={1}>
					{account?.name ?? noneLabel}
				</Text>
				{account ? (
					<Text className="text-footnote text-muted" numberOfLines={1}>
						{account.currency}
					</Text>
				) : null}
			</View>
			{selected ? <Text className="font-sans-bold text-income text-subtitle">{"✓"}</Text> : null}
		</Pressable>
	);
}
