import { useLocalSearchParams } from "expo-router";

import { CategorySymbol } from "@/screens/settings/category-symbol";

export default function CategorySymbolScreen() {
    const params = useLocalSearchParams<{
        income?: string;
        subcategory?: string;
        editId?: string;
    }>();

    return (
        <CategorySymbol
            editId={params.editId && params.editId !== "" ? params.editId : null}
            income={params.income === "1"}
            isSubcategory={params.subcategory === "1"}
        />
    );
}
