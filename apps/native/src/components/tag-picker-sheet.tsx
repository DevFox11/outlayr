import {
	BottomSheetFlatList,
	BottomSheetModal,
	BottomSheetTextInput,
} from "@expo/ui/community/bottom-sheet";
import { SymbolView } from "expo-symbols";
import { forwardRef, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { TagRow } from "@/data/tags";
import {
	findTagByName,
	isUsableTagName,
	normalizeTagName,
} from "@/domain/tags";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";
import { Text } from "./text";
import { cn } from "./tw";

interface TagPickerSheetProps {
	tags: readonly TagRow[];
	selected: readonly string[];
	onToggle: (tagId: string) => void;
	/** Resolves to the tag's id, existing or newly created. */
	onCreate: (name: string) => Promise<string | null>;
}

/** Present via the forwarded ref: `ref.current?.present()`. */
export const TagPickerSheet = forwardRef<BottomSheetModal, TagPickerSheetProps>(
	function TagPickerSheet({ tags, selected, onToggle, onCreate }, ref) {
		const colors = useColors();
		const t = useTranslation();
		const [query, setQuery] = useState("");

		const trimmed = normalizeTagName(query);
		const results = useMemo(() => {
			if (trimmed === "") {
				return tags;
			}
			const needle = trimmed.toLocaleLowerCase();
			return tags.filter((tag) =>
				tag.name.toLocaleLowerCase().includes(needle),
			);
		}, [tags, trimmed]);

		// Offered only when nothing already answers to the name, so the row cannot
		// mint a near-duplicate of a tag one line below it.
		const canCreate =
			isUsableTagName(query) && findTagByName(tags, trimmed) === null;

		const create = () => {
			onCreate(trimmed).then((id) => {
				if (id) {
					setQuery("");
				}
			});
		};

		return (
			<BottomSheetModal
				enableDynamicSizing={false}
				enablePanDownToClose
				ref={ref}
				snapPoints={["55%", "100%"]}
			>
				<View className="flex-1">
					<View className="items-center px-5 pt-3 pb-3">
						<Text className="font-sans-semibold text-foreground text-headline">
							{t("transaction.tags.title")}
						</Text>
					</View>

					<View className="px-5 pb-2">
						<View className="flex-row items-center gap-2 rounded-full bg-surface px-4 py-3">
							<SymbolView
								name="magnifyingglass"
								size={16}
								tintColor={colors.muted}
								type="monochrome"
								weight="semibold"
							/>
							<BottomSheetTextInput
								autoCapitalize="none"
								autoCorrect={false}
								onChangeText={setQuery}
								placeholder={t("transaction.tags.searchPlaceholder")}
								placeholderTextColor={colors.muted}
								style={{
									flex: 1,
									fontFamily: "SFProRounded-Regular",
									fontSize: 16,
									color: colors.foreground,
									padding: 0,
								}}
								value={query}
							/>
						</View>
					</View>

					{canCreate ? (
						<Pressable
							accessibilityRole="button"
							className="mx-5 mb-2 flex-row items-center gap-2 py-3 active:opacity-60"
							onPress={create}
						>
							<SymbolView
								name="plus.circle.fill"
								size={18}
								tintColor={colors.tint}
								type="monochrome"
							/>
							<Text className="font-sans-medium text-body text-foreground">
								{t("transaction.tags.create", { name: trimmed })}
							</Text>
						</Pressable>
					) : null}

					<BottomSheetFlatList
						contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
						data={results}
						keyboardShouldPersistTaps="handled"
						keyExtractor={(tag: TagRow) => tag.id}
						ListEmptyComponent={
							canCreate ? null : (
								<Text className="py-6 text-center text-muted text-subtitle">
									{t("transaction.tags.empty")}
								</Text>
							)
						}
						renderItem={({ item }: { item: TagRow }) => {
							const on = selected.includes(item.id);
							return (
								<Pressable
									accessibilityRole="checkbox"
									accessibilityState={{ checked: on }}
									className="flex-row items-center gap-3 border-border border-b py-3.5 active:opacity-60"
									onPress={() => onToggle(item.id)}
								>
									<SymbolView
										name={on ? "checkmark.circle.fill" : "circle"}
										size={20}
										tintColor={on ? colors.tint : colors.muted}
										type="monochrome"
									/>
									<Text
										className={cn(
											"flex-1 text-body",
											on ? "text-foreground" : "text-muted",
										)}
									>
										{item.name}
									</Text>
								</Pressable>
							);
						}}
					/>
				</View>
			</BottomSheetModal>
		);
	},
);
