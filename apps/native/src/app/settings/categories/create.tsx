import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CategoryEditor from "@/components/category-editor";
import { toolbarIcon } from "@/components/toolbar-icons";

export default function CategoryCreateScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ income?: string }>();

	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel="Close"
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<CategoryEditor
				income={params.income === "1"}
				mode="create"
				parentId={null}
			/>
		</>
	);
}
