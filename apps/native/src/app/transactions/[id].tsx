import { useLocalSearchParams } from "expo-router";

import { EditTransaction } from "@/screens/transaction/edit";

export default function EditTransactionScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    return <EditTransaction id={id} />;
}
