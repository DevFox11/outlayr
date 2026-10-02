import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { requireNativeView } from "expo";
import type { ComponentType } from "react";

export interface TintedLabelProps extends CommonViewModifierProps {
    color: string;
    title: string;
}

type NativeTintedLabel = ComponentType<TintedLabelProps>;

let Native: NativeTintedLabel | null = null;
try {
    Native = requireNativeView<TintedLabelProps>("Glow", "TintedLabelView");
} catch {
    Native = null;
}

export function TintedLabel(props: TintedLabelProps) {
    if (!Native) {
        return null;
    }
    return <Native {...props} />;
}

export const tintedLabelAvailable = Native != null;
