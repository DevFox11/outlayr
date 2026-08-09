import { Stack, useRouter } from "expo-router";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";
import { AccountReorder } from "@/screens/accounts/reorder";

export default function AccountReorderScreen() {
	const router = useRouter();
	const t = useTranslation();

	return (
		<>
			<Stack.Screen.BackButton displayMode="minimal" />
			<Stack.Header transparent />
			<Stack.Screen.Title>{t("accounts.reorderTitle")}</Stack.Screen.Title>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("done")}
					accessibilityLabel={t("common.done")}
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<AccountReorder />
		</>
	);
}
