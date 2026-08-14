import { BottomSheetModal, BottomSheetScrollView } from "@expo/ui/community/bottom-sheet";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Cancel01Icon, PlusSignIcon, Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Button } from "panelui-native";
import { type Ref, useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useCategoriesByNamespace } from "@/data/categories";
import type { Category } from "@/data/categories-core";
import type { Database } from "@/db/client";
import { formatAmount } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { type Allocation, isBalanced, unallocated } from "@/domain/split";
import { addPart, removePart, setPartAmount, setPartCategory } from "@/domain/split-draft";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";
import { AmountEntrySheet } from "./amount-entry-sheet";
import { CategoryIconTile } from "./category-icon-tile";
import { CategoryPickerSheet, type CategoryPickerSheetRef } from "./category-picker-sheet";
import { useNumpadAmountField } from "./form/numpad-amount-field";
import { Text } from "./text";

interface SplitSheetProps {
	allocations: readonly Allocation[];
	code: string;
	db: Database;
	income: boolean;
	minorUnits: number;
	onChange: (next: Allocation[]) => void;
	ref?: Ref<BottomSheetModal>;
	/** The entry's own amount. Every part is measured against this. */
	total: number;
}

export type SplitSheetRef = BottomSheetModal;

/**
 * Editing which categories an entry's amount is attributed to.
 *
 * Presented from the Category row. The remainder is permanent furniture rather
 * than an error that appears once you get it wrong, because `unallocated` is
 * signed and the user needs to be told which way they are out.
 */
export function SplitSheet({ db, income, total, code, minorUnits, allocations, onChange, ref }: SplitSheetProps) {
	const t = useTranslation();
	const { language } = useLanguage();
	const colors = useColors();
	const sheetRef = useRef<BottomSheetModal>(null);
	const categoryRef = useRef<CategoryPickerSheetRef>(null);
	const categories = useCategoriesByNamespace(db, income);
	/** Which part the category picker and the numpad are currently editing. */
	const [editing, setEditing] = useState<number | null>(null);
	const [amountText, setAmountText] = useState("");

	const setRefs = useCallback(
		(node: BottomSheetModal | null) => {
			sheetRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				(ref as { current: BottomSheetModal | null }).current = node;
			}
		},
		[ref]
	);

	const byId = useMemo(() => {
		const map = new Map<string, Category>();
		for (const parent of categories) {
			map.set(parent.id, parent);
			for (const child of parent.children) {
				map.set(child.id, child);
			}
		}
		return map;
	}, [categories]);

	const left = unallocated(total, allocations);
	const balanced = isBalanced(total, allocations);

	const amountField = useNumpadAmountField({
		code,
		minorUnits,
		onChange: (next) => {
			setAmountText(next);
			if (editing != null) {
				onChange(setPartAmount(total, allocations, editing, numpadToNumber(next)));
			}
		},
		value: amountText,
	});

	const editAmount = (index: number) => {
		setEditing(index);
		setAmountText(numberToNumpad(allocations[index].amount, minorUnits));
		amountField.present();
	};

	const pickCategory = (index: number) => {
		setEditing(index);
		categoryRef.current?.present();
	};

	const onPickCategory = (picked: Category) => {
		if (editing == null) {
			return;
		}
		onChange(
			editing >= allocations.length ? addPart(allocations, picked.id) : setPartCategory(allocations, editing, picked.id)
		);
		categoryRef.current?.dismiss();
	};

	return (
		<BottomSheetModal
			backgroundStyle={{ backgroundColor: colors.background }}
			enableDynamicSizing={false}
			enablePanDownToClose
			ref={setRefs}
			snapPoints={["65%", "92%"]}
		>
			<View className="mb-2 justify-center px-5 py-1">
				<Text accessibilityRole="header" className="text-center font-medium text-foreground text-lg">
					{t("transaction.split.title")}
				</Text>
				<View className="absolute top-0 bottom-0 left-5 justify-center">
					<Button
						accessibilityLabel={t("common.close")}
						className="rounded-full"
						onPress={() => sheetRef.current?.dismiss()}
						size="icon"
						variant="secondary"
					>
						<HugeiconsIcon color={colors.foreground} icon={Cancel01Icon} size={22} />
					</Button>
				</View>
			</View>

			<BottomSheetScrollView>
				{allocations.map((part, index) => {
					const category = part.categoryId == null ? null : byId.get(part.categoryId);
					return (
						<View
							className="flex-row items-center gap-3 border-border border-t px-5 py-3"
							// biome-ignore lint/suspicious/noArrayIndexKey: a part's identity IS its position — `setSplit` rewrites rows wholesale for the same reason.
							key={index}
						>
							<Pressable
								accessibilityLabel={t("transaction.split.chooseCategory")}
								accessibilityRole="button"
								className="flex-1 flex-row items-center gap-3"
								onPress={() => pickCategory(index)}
							>
								{category ? (
									<CategoryIconTile
										color={category.income ? colors.income : (category.color ?? "#767676")}
										emoji={category.emoji}
										icon={category.icon}
										radius={999}
										size={28}
										type="solid"
									/>
								) : null}
								<Text className="flex-1 text-body text-foreground">
									{category?.name ?? t("transaction.split.chooseCategory")}
								</Text>
							</Pressable>
							<Pressable
								accessibilityLabel={t("transaction.split.editAmount")}
								accessibilityRole="button"
								onPress={() => editAmount(index)}
							>
								<Text className="font-mono text-body text-foreground tabular-nums">
									{formatAmount(part.amount, code, true, language)}
								</Text>
							</Pressable>
							{allocations.length > 1 ? (
								<Pressable
									accessibilityLabel={t("transaction.split.removePart")}
									accessibilityRole="button"
									onPress={() => onChange(removePart(allocations, index))}
								>
									<HugeiconsIcon color={colors.muted} icon={Cancel01Icon} size={18} />
								</Pressable>
							) : null}
						</View>
					);
				})}

				<View
					className={`flex-row items-center justify-between border-border border-t px-5 py-3 ${balanced ? "" : "bg-surface"}`}
				>
					<Text
						className={`font-mono text-micro uppercase tracking-micro ${balanced ? "text-income" : "text-expense"}`}
					>
						{balanced ? t("transaction.split.balanced") : t("transaction.split.remaining")}
					</Text>
					<Text className={`font-mono text-body tabular-nums ${balanced ? "text-income" : "text-expense"}`}>
						{formatAmount(Math.abs(left), code, true, language)}
					</Text>
				</View>

				<Pressable
					accessibilityLabel={t("transaction.split.addCategory")}
					accessibilityRole="button"
					className="flex-row items-center gap-2 border-border border-t px-5 py-3"
					onPress={() => pickCategory(allocations.length)}
				>
					<HugeiconsIcon color={colors.accent} icon={PlusSignIcon} size={18} />
					<Text className="text-accent text-body">{t("transaction.split.addCategory")}</Text>
				</Pressable>

				{balanced ? null : (
					<Pressable
						accessibilityRole="button"
						className="flex-row items-center gap-2 border-border border-t px-5 py-3"
						onPress={() =>
							onChange(
								setPartAmount(total, allocations, allocations.length - 1, (allocations.at(-1)?.amount ?? 0) + left)
							)
						}
					>
						<HugeiconsIcon color={colors.accent} icon={Tick02Icon} size={18} />
						<Text className="text-accent text-body">{t("transaction.split.fillRest")}</Text>
					</Pressable>
				)}

				<View className="h-10" />
			</BottomSheetScrollView>

			<CategoryPickerSheet
				db={db}
				income={income}
				onSelect={onPickCategory}
				ref={categoryRef}
				selectedId={editing != null && editing < allocations.length ? (allocations[editing].categoryId ?? null) : null}
			/>
			<AmountEntrySheet {...amountField.sheetProps} />
		</BottomSheetModal>
	);
}
