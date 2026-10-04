import { Stack } from "expo-router";
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { ComponentProps } from "react";

import { toolbarIcon } from "@/components/toolbar-icons";
import type { ToolbarIconName } from "@/components/toolbar-icons";

import { useKeyboardShown } from "./stage/stage";

export interface KeyboardSave {
    blockedTint?: string;
    busy: boolean;
    label: string;
    onPress: () => void;
    ready: boolean;
}

export interface TransactionFormCtaProps {
    deleteLabel?: string;
    deleteTint?: string;
    /** A lookup is out; the button waits for it rather than asking twice. */
    lookupBusy?: boolean;
    lookupLabel?: string;
    onDelete?: () => void;
    /** Given only while editing: a new entry looks its merchant up as it is typed. */
    onLookup?: () => void;
    save?: KeyboardSave;
}

export interface TransactionFormCtaAction {
    accessibilityLabel: string;
    disabled: boolean;
    icon: ToolbarIconName;
    key: "delete" | "lookup" | "save";
    onPress: () => void;
    tintColor?: string;
    variant?: ComponentProps<typeof Stack.Toolbar.Button>["variant"];
}

export function transactionFormCtaActions({
    deleteLabel,
    deleteTint,
    onDelete,
    lookupBusy,
    lookupLabel,
    onLookup,
    save,
}: TransactionFormCtaProps): TransactionFormCtaAction[] {
    const actions: TransactionFormCtaAction[] = [];
    if (onLookup) {
        actions.push({
            accessibilityLabel: lookupLabel ?? "",
            disabled: lookupBusy === true,
            icon: "search",
            key: "lookup",
            onPress: onLookup,
        });
    }
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
    if (save) {
        actions.push({
            accessibilityLabel: save.label,
            disabled: save.busy,
            icon: "done",
            key: "save",
            onPress: save.onPress,
            tintColor: save.ready ? undefined : save.blockedTint,
            variant: save.ready ? "done" : undefined,
        });
    }
    return actions;
}

function CtaToolbarBody(props: TransactionFormCtaProps) {
    const actions = transactionFormCtaActions(props);
    if (actions.length === 0) {
        return null;
    }
    return (
        <Stack.Toolbar placement="right">
            {actions.map((action) => (
                <Stack.Toolbar.Button
                    {...toolbarIcon(action.icon)}
                    accessibilityLabel={action.accessibilityLabel}
                    disabled={action.disabled}
                    key={action.key}
                    onPress={action.onPress}
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
    const remove = useCallback(() => handlers.current.onDelete?.(), []);
    const lookup = useCallback(() => handlers.current.onLookup?.(), []);
    const press = useCallback(() => handlers.current.save?.onPress(), []);
    const keyboardShown = useKeyboardShown();
    const lookable = props.onLookup !== undefined;
    const { blockedTint, busy, label, ready } = props.save ?? {};
    const save = useMemo(
        () =>
            keyboardShown && label !== undefined
                ? { blockedTint, busy: busy === true, label, onPress: press, ready: ready === true }
                : undefined,
        [blockedTint, busy, keyboardShown, label, press, ready]
    );
    return (
        <CtaToolbar
            deleteLabel={props.deleteLabel}
            deleteTint={props.deleteTint}
            lookupBusy={lookable && props.lookupBusy === true}
            lookupLabel={props.lookupLabel}
            onDelete={props.onDelete === undefined ? undefined : remove}
            onLookup={lookable ? lookup : undefined}
            save={save}
        />
    );
}
