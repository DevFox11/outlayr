import { useLocalSearchParams } from "expo-router";

import { PayInstallment } from "@/screens/installments/pay";

export default function PayInstallmentRoute() {
    const { all, planId } = useLocalSearchParams<{ all?: string; planId: string }>();

    return <PayInstallment all={all === "1"} planId={planId} />;
}
