import AccountEditor from "@/components/account-editor";

/**
 * On Android a form sheet has no app bar, so the title, close and Delete live
 * in the editor's own `SheetHeader`, next to the Save they share a row with.
 */
export function AccountEdit({ id }: { id: string }) {
    return <AccountEditor id={id} mode="edit" />;
}
