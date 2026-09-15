import { useLocalSearchParams } from "expo-router";

import CategoryEditor from "@/components/category-editor";
import { CloseToolbar } from "@/components/close-toolbar";

export default function CategoryCreateScreen() {
    const params = useLocalSearchParams<{ income?: string }>();

    return (
        <>
            <CloseToolbar placement="right" />

            <CategoryEditor income={params.income === "1"} mode="create" parentId={null} />
        </>
    );
}
