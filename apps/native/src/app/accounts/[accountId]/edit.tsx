import { useLocalSearchParams } from "expo-router";

import { AccountEdit } from "@/screens/accounts/edit";

export default function AccountEditRoute() {
    const { accountId } = useLocalSearchParams<{ accountId: string }>();

    return <AccountEdit id={accountId} />;
}
