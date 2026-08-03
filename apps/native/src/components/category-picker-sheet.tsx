import {
	BottomSheetModal,
	BottomSheetScrollView,
} from "@expo/ui/community/bottom-sheet";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowRight01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { type Ref, useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	FadeIn,
	FadeOut,
	LinearTransition,
} from "react-native-reanimated";
import { type Category, useCategoriesByNamespace } from "@/data/categories";
import type { Database } from "@/db/client";
import type { PendingCategory } from "@/hooks/use-transaction-enrichment";
import { useTranslation } from "@/i18n";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { CategoryIconTile } from "./category-icon-tile";
import { Text } from "./text";
import { cn } from "./tw";

const EASE = Easing.inOut(Easing.ease);
const CARD_LAYOUT = LinearTransition.duration(300).easing(EASE);
const CHILD_IN = FadeIn.duration(300).easing(EASE);
const CHILD_OUT = FadeOut.duration(300).easing(EASE);

const PENDING_CATEGORY_ID = "__pending__";

interface CategoryPickerSheetProps {
	db: Database;
	income: boolean;
	selectedId: string | null;
	/** Not yet a real row — shown as the top pick, materialized only on save. */
	pendingCategory?: PendingCategory | null;
	onSelect: (category: Category) => void;
	ref?: Ref<BottomSheetModal>;
}

export type CategoryPickerSheetRef = BottomSheetModal;

/** Present via the forwarded ref: `ref.current?.present()`. */
export function CategoryPickerSheet({
	db,
	income,
	selectedId,
	pendingCategory,
	onSelect,
	ref,
}: CategoryPickerSheetProps) {
	const t = useTranslation();
	const colors = useColors();
	const categories = useCategoriesByNamespace(db, income);
	const sheetRef = useRef<BottomSheetModal>(null);
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const setRefs = useCallback(
		(node: BottomSheetModal | null) => {
			sheetRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		},
		[ref],
	);

	const toggle = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	return (
		<BottomSheetModal
			ref={setRefs}
			snapPoints={["50%", "92%"]}
			enableDynamicSizing={false}
			enablePanDownToClose
			backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
		>
			<View className="h-11 justify-center px-4">
				<Text
					accessibilityRole="header"
					className="text-center font-sans-semibold text-callout text-foreground"
				>
					{t("categories.kind.category")}
				</Text>
				<Pressable
					accessibilityRole="button"
					className="absolute top-0 right-4 bottom-0 justify-center active:opacity-60"
					hitSlop={8}
					onPress={() => sheetRef.current?.dismiss()}
				>
					<Text className="font-sans-semibold text-callout text-tint">
						{t("common.done")}
					</Text>
				</Pressable>
			</View>

			<BottomSheetScrollView
				contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
				showsVerticalScrollIndicator={false}
				style={{ flex: 1 }}
			>
				{pendingCategory ? (
					<Animated.View
						className="overflow-hidden rounded-xl bg-surface"
						layout={CARD_LAYOUT}
					>
						<CategoryRow
							caption={t("transaction.category.willBeCreated")}
							category={{
								id: PENDING_CATEGORY_ID,
								name: pendingCategory.name,
								icon: pendingCategory.icon,
								emoji: null,
								color: pendingCategory.color,
								income,
								sortOrder: -1,
								parentId: null,
								dateCreated: new Date(0),
								updatedAt: new Date(0),
								deletedAt: null,
							}}
							onSelect={() => sheetRef.current?.dismiss()}
							selected={selectedId === null}
						/>
					</Animated.View>
				) : null}
				{categories.map((parent) => {
					const isExpanded = expanded.has(parent.id);
					return (
						<Animated.View
							className="overflow-hidden rounded-xl bg-surface"
							key={parent.id}
							layout={CARD_LAYOUT}
						>
							<CategoryRow
								category={parent}
								expanded={isExpanded}
								hasChildren={parent.children.length > 0}
								onSelect={onSelect}
								onToggle={() => toggle(parent.id)}
								selected={parent.id === selectedId}
							/>
							{isExpanded
								? parent.children.map((child) => (
										<Animated.View
											entering={CHILD_IN}
											exiting={CHILD_OUT}
											key={child.id}
										>
											<View
												className="ml-[58px]"
												style={{
													height: StyleSheet.hairlineWidth,
													backgroundColor: withAlpha(colors.foreground, 0.07),
												}}
											/>
											<CategoryRow
												category={child}
												indented
												onSelect={onSelect}
												selected={child.id === selectedId}
											/>
										</Animated.View>
									))
								: null}
						</Animated.View>
					);
				})}
			</BottomSheetScrollView>
		</BottomSheetModal>
	);
}

function CategoryRow({
	category,
	selected,
	indented = false,
	hasChildren = false,
	expanded = false,
	caption,
	onSelect,
	onToggle,
}: {
	category: Category;
	selected: boolean;
	indented?: boolean;
	hasChildren?: boolean;
	expanded?: boolean;
	caption?: string;
	onSelect: (category: Category) => void;
	onToggle?: () => void;
}) {
	const colors = useColors();
	const tint = category.income ? colors.income : (category.color ?? "#767676");

	return (
		<View
			className={cn(
				"flex-row items-center gap-3 pr-3.5",
				indented ? "py-[9px] pl-[30px]" : "py-[11px] pl-3.5",
			)}
		>
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ selected }}
				className="flex-1 flex-row items-center gap-3 active:opacity-60"
				onPress={() => onSelect(category)}
			>
				<CategoryIconTile
					type={selected ? "solid" : "stroke"}
					color={tint}
					emoji={category.emoji}
					icon={category.icon}
					size={28}
				/>
				<View className="flex-1">
					<Text
						className={cn(
							"font-sans-medium text-foreground",
							indented ? "text-subtitle" : "text-callout",
						)}
						numberOfLines={1}
					>
						{category.name}
					</Text>
					{caption ? (
						<Text className="text-footnote text-muted" numberOfLines={1}>
							{caption}
						</Text>
					) : null}
				</View>
				{selected ? (
					<Text className="font-sans-bold text-income text-subtitle">
						{"✓"}
					</Text>
				) : null}
			</Pressable>
			{hasChildren && onToggle ? (
				<Pressable
					accessibilityRole="button"
					className="size-9 items-center justify-center active:opacity-60"
					hitSlop={6}
					onPress={onToggle}
				>
					<View className={expanded ? "rotate-90" : "rotate-0"}>
						<HugeiconsIcon
							color={colors.muted}
							icon={ArrowRight01Icon}
							size={16}
							strokeWidth={2}
						/>
					</View>
				</Pressable>
			) : null}
		</View>
	);
}
