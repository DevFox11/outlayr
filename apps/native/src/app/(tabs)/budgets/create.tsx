import { Stack, useRouter } from "expo-router";
import { useDatabase } from "@/contexts/local-data-context";
import { useTranslation } from "@/i18n/context";
import { BudgetForm } from "@/screens/budgets/components/budget-form";

export default function CreateBudgetScreen() {
	const router = useRouter();
	const t = useTranslation();
	const db = useDatabase();

	return (
		<>
			<BudgetForm db={db} onDone={() => router.back()} />
			<Stack.Screen.Title>{t("budgets.new.title")}</Stack.Screen.Title>
			{/* A modal has no back button, so swipe-down would be the only way out. */}
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button onPress={() => router.back()}>{t("budgets.action.cancel")}</Stack.Toolbar.Button>
			</Stack.Toolbar>
		</>
	);
}
