import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDatabase } from "@/contexts/local-data-context";
import { getBudgetById } from "@/data/budgets";
import { BudgetForm } from "@/screens/budgets/components/budget-form";

export default function EditBudgetScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const db = useDatabase();
	// Read once while mounting: the driver runs on the JS thread, so the form
	// opens on the stored row rather than flashing an empty one.
	const [initial] = useState(() => (id ? getBudgetById(db, id) : null));

	useEffect(() => {
		if (initial == null) {
			router.back();
		}
	}, [initial, router]);

	if (initial == null) {
		return null;
	}

	return (
		<>
			<BudgetForm db={db} initial={initial} onDone={() => router.back()} />
			<Stack.Screen.Title>Edit Budget</Stack.Screen.Title>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel="Close"
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>
		</>
	);
}
