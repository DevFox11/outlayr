import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CategoryEditor from "@/components/category-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n";

export default function SubcategoryCreateScreen() {
	const router = useRouter();
	const t = useTranslation();
	const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel={t("common.close")}
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<CategoryEditor mode="create" parentId={categoryId} />
		</>
	);
}
