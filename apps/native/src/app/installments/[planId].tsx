import { useLocalSearchParams } from "expo-router";

import { InstallmentOrder } from "@/screens/installments/order";

export default function InstallmentOrderRoute() {
    const { planId } = useLocalSearchParams<{ planId: string }>();

    return <InstallmentOrder planId={planId} />;
}
