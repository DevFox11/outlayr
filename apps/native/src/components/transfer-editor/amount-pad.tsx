import { BottomSheet } from "panelui-native";

import { AmountNumpad } from "@/components/amount-numpad";
import type { NumpadMode } from "@/domain/numpad";

interface TransferEditorAmountPadProps {
    code: string;
    minorUnits: number;
    /** Passed straight through — see `AmountNumpad`'s own `mode`. */
    mode?: NumpadMode;
    onChange: (next: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    value: string;
}

/**
 * PanelUI's sheet, not `AmountEntrySheet`: an `@expo/ui` `BottomSheetModal`
 * presented from this screen takes the whole formSheet down with it, leaving
 * the numpad floating over the tab behind.
 */
export function TransferEditorAmountPad({
    open,
    value,
    minorUnits,
    code,
    mode,
    onChange,
    onOpenChange,
}: TransferEditorAmountPadProps) {
    return (
        <BottomSheet native onOpenChange={onOpenChange} open={open}>
            <BottomSheet.Content size="auto">
                <AmountNumpad
                    code={code}
                    minorUnits={minorUnits}
                    mode={mode}
                    onChange={onChange}
                    showDisplay={false}
                    value={value}
                />
            </BottomSheet.Content>
        </BottomSheet>
    );
}
