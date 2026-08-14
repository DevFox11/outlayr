import { useLocalSearchParams } from "expo-router";

import { CategoryEditScreen } from "@/components/category-edit-screen";

export default function CategoryEditRoute() {
    const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

    return <CategoryEditScreen id={categoryId} />;
}
