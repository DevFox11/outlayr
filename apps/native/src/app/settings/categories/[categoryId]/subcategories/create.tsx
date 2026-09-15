import { useLocalSearchParams } from "expo-router";

import CategoryEditor from "@/components/category-editor";
import { CloseToolbar } from "@/components/close-toolbar";

export default function SubcategoryCreateScreen() {
    const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

    return (
        <>
            <CloseToolbar placement="right" />

            <CategoryEditor mode="create" parentId={categoryId} />
        </>
    );
}
