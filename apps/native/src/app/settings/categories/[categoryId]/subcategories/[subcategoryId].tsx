import { useLocalSearchParams } from "expo-router";

import { CategoryEditScreen } from "@/components/category-edit-screen";

export default function SubcategoryEditScreen() {
    const { subcategoryId } = useLocalSearchParams<{ subcategoryId: string }>();

    return <CategoryEditScreen id={subcategoryId} />;
}
