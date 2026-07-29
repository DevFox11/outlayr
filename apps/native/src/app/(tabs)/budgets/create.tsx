import { Stack, useRouter } from "expo-router";
import { useDatabase } from "@/contexts/local-data-context";
import { BudgetForm } from "@/screens/budgets/components/budget-form";

export default function CreateBudgetScreen() {
	const router = useRouter();
	const db = useDatabase();

	return (
		<>
			<BudgetForm db={db} onDone={() => router.back()} />
			<Stack.Screen.Title>New Budget</Stack.Screen.Title>
			{/* A modal has no back button, so swipe-down would be the only way out. */}
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button onPress={() => router.back()}>
					Cancel
				</Stack.Toolbar.Button>
			</Stack.Toolbar>
		</>
	);
}
