import { useRouter } from "expo-router";
import { View } from "react-native";

import { MaterialFab } from "@/components/material-fab";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";
import { useTranslation } from "@/i18n/context";
import { Accounts } from "@/screens/accounts";

/**
 * Android's accounts route: "New account" is the FAB over the list, where iOS
 * has a bottom-toolbar button.
 */
export default function AccountsScreen() {
    const router = useRouter();
    const t = useTranslation();
    const createRoute = useAccountCreateRoute();

    return (
        <View className="bg-m3-surface flex-1">
            <Accounts />
            <MaterialFab label={t("accounts.a11y.new")} onPress={() => router.push(createRoute)} />
        </View>
    );
}
