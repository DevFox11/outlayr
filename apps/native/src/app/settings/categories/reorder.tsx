import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";
import { CategoryReorder } from "@/screens/categories/reorder";

export default function CategoryReorderScreen() {
	const router = useRouter();
	const t = useTranslation();
	const params = useLocalSearchParams<{ income?: string }>();

	return (
		<>
			<Stack.Screen.BackButton displayMode="minimal" />
			<Stack.Header transparent />
			<Stack.Screen.Title>{t("categories.reorderTitle")}</Stack.Screen.Title>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("done")}
					accessibilityLabel={t("common.done")}
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<CategoryReorder income={params.income === "1"} />
		</>
	);
}
