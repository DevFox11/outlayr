import { useLocalSearchParams } from "expo-router";

import { AccountDetail } from "@/screens/accounts/detail";

export default function AccountDetailRoute() {
    const { accountId } = useLocalSearchParams<{ accountId: string }>();

    return <AccountDetail id={accountId} />;
}
