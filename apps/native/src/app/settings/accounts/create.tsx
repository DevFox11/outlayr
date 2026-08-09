import { Stack, useRouter } from "expo-router";
import AccountEditor from "@/components/account-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";

export default function AccountCreateScreen() {
	const router = useRouter();
	const t = useTranslation();

	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel={t("common.close")}
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<AccountEditor mode="create" />
		</>
	);
}
