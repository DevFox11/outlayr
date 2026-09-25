import { useLocalSearchParams } from "expo-router";

import { EditTransfer } from "@/screens/transfers/edit";

export default function EditTransferScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <EditTransfer id={id} />;
}
