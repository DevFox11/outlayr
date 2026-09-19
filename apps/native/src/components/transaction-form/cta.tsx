import { Stack } from "expo-router";
import type { StackHeaderItemSharedProps } from "expo-router";
import { memo, useCallback, useLayoutEffect, useRef } from "react";

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
    /** A lookup is out; the button waits for it rather than asking twice. */
    lookupBusy?: boolean;
    lookupLabel?: string;
    onDelete?: () => void;
    /** Given only while editing: a new entry looks its merchant up as it is typed. */
    onLookup?: () => void;
    onPress: () => void;
    saveLabel: string;
}

export interface TransactionFormCtaAction {
    accessibilityLabel: string;
    disabled: boolean;
    icon: ToolbarIconName;
    key: "delete" | "lookup" | "save";
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
    lookupBusy,
    lookupLabel,
    onLookup,
}: TransactionFormCtaProps): TransactionFormCtaAction[] {
    const actions: TransactionFormCtaAction[] = [];
    // Furthest from the thumb: asked for once per merchant, not per visit.
    if (onLookup) {
        actions.push({
            accessibilityLabel: lookupLabel ?? "",
            disabled: lookupBusy === true,
            icon: "search",
            key: "lookup",
            onPress: onLookup,
        });
    }
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

function CtaToolbarBody(props: TransactionFormCtaProps) {
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

const CtaToolbar = memo(CtaToolbarBody);

export function TransactionFormCta(props: TransactionFormCtaProps) {
    const handlers = useRef(props);
    useLayoutEffect(() => {
        handlers.current = props;
    });
    const press = useCallback(() => handlers.current.onPress(), []);
    const remove = useCallback(() => handlers.current.onDelete?.(), []);
    const lookup = useCallback(() => handlers.current.onLookup?.(), []);
    const lookable = props.onLookup !== undefined;
    return (
        <CtaToolbar
            blockedTint={props.blockedTint}
            busy={props.busy}
            canSave={props.canSave}
            deleteLabel={props.deleteLabel}
            deleteTint={props.deleteTint}
            lookupBusy={lookable && props.lookupBusy === true}
            lookupLabel={props.lookupLabel}
            onDelete={props.onDelete === undefined ? undefined : remove}
            onLookup={lookable ? lookup : undefined}
            onPress={press}
            saveLabel={props.saveLabel}
        />
    );
}
