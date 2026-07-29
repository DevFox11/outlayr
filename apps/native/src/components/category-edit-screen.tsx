import { and, eq, isNull } from "drizzle-orm";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import CategoryEditor from "@/components/category-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDatabase } from "@/contexts/local-data-context";
import { categoriesRepo, getCategoryById } from "@/data/categories";
import { categories } from "@/db/schema";
import { useColors } from "@/theme/use-colors";

/**
 * A component rather than a route so the two routes that reach it — a top-level
 * category and one nested under its parent — differ only in which id they pull
 * out of the path.
 */
export function CategoryEditScreen({ id }: { id: string }) {
	const router = useRouter();
	const db = useDatabase();
	const colors = useColors();

	// Read once on mount, like the editor does — a rename must not retitle the
	// sheet mid-edit.
	const [edited] = useState(() => (id ? getCategoryById(db, id) : null));
	const title =
		edited == null
			? "Category"
			: edited.parentId != null
				? "Subcategory"
				: edited.income
					? "Income Category"
					: "Expense Category";

	const confirmDelete = async () => {
		if (!id) {
			return;
		}
		const category = await getCategoryById(db, id);
		if (category == null) {
			return;
		}
		const children = await db
			.select({ id: categories.id })
			.from(categories)
			.where(and(eq(categories.parentId, id), isNull(categories.deletedAt)));
		const message =
			children.length > 0
				? `This can't be undone. ${category.name} transactions will be deleted; its subcategories will be moved to the top level.`
				: `This can't be undone. All ${category.name} transactions will be deleted too.`;
		Alert.alert(`Delete '${category.name}'?`, message, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
					await categoriesRepo.remove(db, id);
					router.back();
				},
			},
		]);
	};

	return (
		<>
			<Stack.Screen.Title>{title}</Stack.Screen.Title>

			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel="Close"
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("delete")}
					accessibilityLabel="Delete"
					onPress={confirmDelete}
					tintColor={colors.danger}
				/>
			</Stack.Toolbar>

			<CategoryEditor id={id} mode="edit" />
		</>
	);
}
