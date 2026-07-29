import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { toolbarIcon } from "@/components/toolbar-icons";
import CategoryReorder from "@/screens/categories/components/category-reorder";

export default function CategoryReorderScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ income?: string }>();

	return (
		<>
			<Stack.Screen.BackButton displayMode="minimal" />
			<Stack.Header transparent />
			<Stack.Screen.Title>Reorder Categories</Stack.Screen.Title>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("done")}
					accessibilityLabel="Done"
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<CategoryReorder income={params.income === "1"} />
		</>
	);
}
