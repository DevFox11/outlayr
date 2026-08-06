import { Stack, useRouter } from "expo-router";
import { useToolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n";
import { Accounts } from "@/screens/accounts";

export default function AccountsScreen() {
	const router = useRouter();
	const t = useTranslation();
	const addIcon = useToolbarIcon("add");

	return (
		<>
			<Stack.Toolbar placement="bottom">
				<Stack.Toolbar.Spacer />
				<Stack.Toolbar.Button
					{...addIcon}
					accessibilityLabel={t("accounts.a11y.new")}
					onPress={() => router.push("/settings/accounts/create")}
				/>
			</Stack.Toolbar>
			<Accounts />
		</>
	);
}
