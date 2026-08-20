import { Stack } from "expo-router";
import type { StackHeaderItemSharedProps } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import type { ToolbarIconName } from "@/components/toolbar-icons";

export interface TransactionFormCtaProps {
    /** Drawn on Save while the entry cannot be saved. */
    blockedTint?: string;
    /**
     * A submit is in flight. This is the ONE state that disables Save: an
     * incomplete entry keeps its press so the form can answer what is missing,
     * but a second press mid-flight would re-enter the submit.
     */
    busy?: boolean;
    canSave: boolean;
    deleteLabel?: string;
    deleteTint?: string;
    onDelete?: () => void;
    onPress: () => void;
    saveLabel: string;
}

export interface TransactionFormCtaAction {
    accessibilityLabel: string;
    disabled: boolean;
    icon: ToolbarIconName;
    key: "delete" | "save";
    onPress: () => void;
    separateBackground?: boolean;
    tintColor?: string;
    variant?: StackHeaderItemSharedProps["variant"];
}

export function transactionFormCtaActions({
    saveLabel,
    canSave,
    onPress,
    deleteLabel,
    deleteTint,
    onDelete,
    blockedTint,
    busy,
}: TransactionFormCtaProps): TransactionFormCtaAction[] {
    const actions: TransactionFormCtaAction[] = [];
    // Destructive first, so the outermost item under the thumb is Save.
    if (onDelete) {
        actions.push({
            accessibilityLabel: deleteLabel ?? "",
            disabled: false,
            icon: "delete",
            key: "delete",
            onPress: onDelete,
            tintColor: deleteTint,
        });
    }

    // Disabled only while a submit is in flight. An entry that merely cannot save
    // yet keeps its press, because a disabled button swallows the tap that would
    // ask what is missing — the form answers that with its flag-and-shake, and
    // blocked is carried by losing the prominent `done` variant instead.
    actions.push({
        accessibilityLabel: saveLabel,
        disabled: busy === true,
        icon: "done",
        key: "save",
        onPress,
        tintColor: canSave ? undefined : blockedTint,
        variant: canSave ? "done" : undefined,
    });
    return actions;
}

export function TransactionFormCta(props: TransactionFormCtaProps) {
    return (
        <Stack.Toolbar placement="right">
            {transactionFormCtaActions(props).map((action) => (
                <Stack.Toolbar.Button
                    {...toolbarIcon(action.icon)}
                    accessibilityLabel={action.accessibilityLabel}
                    disabled={action.disabled}
                    key={action.key}
                    onPress={action.onPress}
                    separateBackground={action.separateBackground}
                    tintColor={action.tintColor}
                    variant={action.variant}
                />
            ))}
        </Stack.Toolbar>
    );
}
