import { useLocalSearchParams } from "expo-router";

import { LicenseDetail } from "@/screens/settings/licenses";

export default function LicenseDetailRoute() {
    const { name } = useLocalSearchParams<{ name: string }>();

    return <LicenseDetail name={name} />;
}
