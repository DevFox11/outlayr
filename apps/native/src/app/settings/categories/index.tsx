import { Stack, useRouter } from "expo-router";
import { useState } from "react";

import { CategoryKindToggle } from "@/components/category-kind-toggle";
import { useToolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";
import { Categories } from "@/screens/categories";

export default function CategoriesScreen() {
    const router = useRouter();
    const t = useTranslation();
    const [income, setIncome] = useState(false);
    const addIcon = useToolbarIcon("add");

    const goToNew = () => {
        router.push({
            params: { income: income ? "1" : "0" },
            pathname: "/settings/categories/create",
        });
    };

    return (
        <>
            <Stack.Toolbar placement="bottom">
                {/* The segmented picker draws its own capsule, so `hidesSharedBackground`
				    stops the toolbar wrapping it in a second glass one. */}
                <Stack.Toolbar.View hidesSharedBackground>
                    <CategoryKindToggle income={income} onChange={setIncome} />
                </Stack.Toolbar.View>
                <Stack.Toolbar.Spacer />
                <Stack.Toolbar.Button {...addIcon} accessibilityLabel={t("categories.a11y.new")} onPress={goToNew} />
            </Stack.Toolbar>
            <Categories income={income} />
        </>
    );
}
