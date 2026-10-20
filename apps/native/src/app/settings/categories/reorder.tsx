import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";
import { CategoryReorder } from "@/screens/categories/reorder";

export default function CategoryReorderScreen() {
    const router = useRouter();
    const t = useTranslation();
    const params = useLocalSearchParams<{ income?: string }>();

    return (
        <>
            <Stack.Screen.BackButton displayMode="minimal" />
            <ScreenHeader title={t("categories.reorderTitle")} />
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button accessibilityLabel={t("common.done")} onPress={() => router.back()}>
                    <Stack.Toolbar.Icon {...toolbarIcon("done")} />
                </Stack.Toolbar.Button>
            </Stack.Toolbar>

            <CategoryReorder income={params.income === "1"} />
        </>
    );
}
