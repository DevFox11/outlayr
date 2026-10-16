import CategoryEditor from "@/components/category-editor";

/**
 * On Android a form sheet has no app bar, so the title, close and Delete live
 * in the editor's own `SheetHeader`, next to the Save they share a row with.
 */
export function CategoryEditScreen({ id }: { id: string }) {
    return <CategoryEditor id={id} mode="edit" />;
}
