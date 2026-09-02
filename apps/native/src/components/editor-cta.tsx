import { Button } from "panelui-native";
import { View } from "react-native";

import { CTA_HEIGHT } from "@/components/editor-style";

/**
 * ⚠️ Measured 2026-08-22: panelui's own disabled dim (`opacity-[0.64]` on the
 * button root) never lands. Its `AnimatedPressable` writes `opacity` from a
 * Reanimated press style every frame, and that beats any static class — a
 * `bg-red-500` passed the same way DOES apply, so this is specific to opacity.
 *
 * The dim therefore goes on this wrapper, which nothing animates. Without it a
 * disabled CTA renders at full ink and reads as tappable, which is what the
 * SwiftUI button it replaced got right for free.
 */
const DISABLED_OPACITY = 0.4;

interface EditorCtaProps {
    /** A save is in flight: the button shows a spinner and stops taking presses. */
    busy?: boolean;
    canSave: boolean;
    label: string;
    onPress: () => void;
}

/**
 * The pinned primary action shared by the account and category editors — the
 * same `panelui` button the transfer editor and the import sheet already use.
 *
 * Not a SwiftUI `Host`: one fewer native island beside the form's, and it is
 * what gives the save a real `loading` state instead of a frozen button.
 */
export function EditorCta({ label, canSave, busy = false, onPress }: EditorCtaProps) {
    return (
        <View style={{ height: CTA_HEIGHT, opacity: canSave || busy ? 1 : DISABLED_OPACITY }} testID="editor-cta">
            <Button
                className="rounded-full"
                disabled={!canSave}
                fullWidth
                loading={busy}
                onPress={onPress}
                size="md"
                variant="primary"
            >
                {label}
            </Button>
        </View>
    );
}
