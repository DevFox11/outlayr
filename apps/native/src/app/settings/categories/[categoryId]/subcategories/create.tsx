import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CategoryEditor from "@/components/category-editor";
import { toolbarIcon } from "@/components/toolbar-icons";

export default function SubcategoryCreateScreen() {
	const router = useRouter();
	const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel="Close"
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<CategoryEditor mode="create" parentId={categoryId} />
		</>
	);
}
