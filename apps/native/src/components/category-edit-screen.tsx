import { and, eq, isNull } from "drizzle-orm";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import CategoryEditor from "@/components/category-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDatabase } from "@/contexts/local-data-context";
import { categoriesRepo, getCategoryById } from "@/data/categories";
import { categories } from "@/db/schema";
import { useTranslation } from "@/i18n";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

/**
 * A component rather than a route so the two routes that reach it — a top-level
 * category and one nested under its parent — differ only in which id they pull
 * out of the path.
 */
export function CategoryEditScreen({ id }: { id: string }) {
	const router = useRouter();
	const db = useDatabase();
	const t = useTranslation();
	const colors = useColors();
	const haptics = useHaptics();

	// Read once on mount, like the editor does — a rename must not retitle the
	// sheet mid-edit.
	const [edited] = useState(() => (id ? getCategoryById(db, id) : null));
	const title = t(
		edited == null
			? "categories.kind.category"
			: edited.parentId != null
				? "categories.kind.subcategory"
				: edited.income
					? "categories.kind.income"
					: "categories.kind.expense",
	);

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
		const message = t(
			children.length > 0
				? "categories.delete.messageWithChildren"
				: "categories.delete.message",
			{ name: category.name },
		);
		Alert.alert(
			t("categories.delete.title", { name: category.name }),
			message,
			[
				{ text: t("common.cancel"), style: "cancel" },
				{
					text: t("common.delete"),
					style: "destructive",
					onPress: async () => {
						haptics("warning");
						await categoriesRepo.remove(db, id);
						router.back();
					},
				},
			],
		);
	};

	return (
		<>
			<Stack.Screen.Title>{title}</Stack.Screen.Title>

			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel={t("common.close")}
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("delete")}
					accessibilityLabel={t("common.delete")}
					onPress={confirmDelete}
					tintColor={colors.danger}
				/>
			</Stack.Toolbar>

			<CategoryEditor id={id} mode="edit" />
		</>
	);
}
