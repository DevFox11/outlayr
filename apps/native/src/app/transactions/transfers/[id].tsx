import { useLocalSearchParams } from "expo-router";

import TransferDetail from "@/screens/transfers/detail";

export default function TransferDetailRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <TransferDetail id={id} />;
}
