import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CategoryEditor from "@/components/category-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n";

export default function CategoryCreateScreen() {
	const router = useRouter();
	const t = useTranslation();
	const params = useLocalSearchParams<{ income?: string }>();

	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel={t("common.close")}
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<CategoryEditor income={params.income === "1"} mode="create" parentId={null} />
		</>
	);
}
