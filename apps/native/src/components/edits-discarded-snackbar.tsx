import { toast } from "panelui-native";
import { AccessibilityInfo, Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { translateNow } from "@/i18n/runtime";
import { notifyWarning } from "@/lib/notify";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

/** Long enough to read two words and reach for Undo, short enough to stay a snackbar. */
const SNACKBAR_MS = 5000;

/**
 * The M3 navigation bar the snackbar sits above. Bottom toasts already clear
 * the gesture bar, and the tabs' bar is drawn natively under the toast layer.
 */
const NAV_BAR_HEIGHT = 80;

/**
 * The Log's FAB, 56dp on a 16dp margin: M3 puts a snackbar above a FAB, and
 * the edit sheets are mostly opened from the Log, so it clears it everywhere.
 */
const FAB_CLEARANCE = 72;

/** M3 elevation level 3. */
const ELEVATION = 6;

const PRESSED_ALPHA = 0.1;

/**
 * "Edits discarded", with an Undo, as an M3 snackbar above the navigation bar.
 * Android only: the discard guard raises it when a sheet with unsaved edits was
 * swiped away, which Android cannot refuse. Undo closes it and calls `onUndo`;
 * letting it time out or swiping it away leaves the edits discarded.
 *
 * Platform-neutral on purpose, like `navigation/material-chrome.ts`: only the
 * Android guard raises it.
 */
export function notifyEditsDiscarded(onUndo: () => void): void {
    const message = translateNow("common.discard.discarded");
    AccessibilityInfo.announceForAccessibility(message);
    toast.show({
        component: (handle) => (
            <EditsDiscardedSnackbar
                message={message}
                onUndo={() => {
                    handle.hide();
                    onUndo();
                }}
            />
        ),
        duration: SNACKBAR_MS,
        placement: "bottom",
    });
}

/**
 * The Undo found the entry changed or deleted since its edits were taken, so
 * they stay discarded: put back, they would overwrite what changed.
 */
export function notifyEditsNotRestored(): void {
    notifyWarning({
        body: translateNow("common.discard.restoreFailedBody"),
        title: translateNow("common.discard.restoreFailed"),
    });
}

function EditsDiscardedSnackbar({ message, onUndo }: { message: string; onUndo: () => void }) {
    const m3 = useMaterialColors();
    return (
        <View
            className="mx-4 min-h-12 flex-row items-center rounded py-1 pr-2 pl-4"
            style={{
                backgroundColor: m3.inverseSurface,
                elevation: ELEVATION,
                marginBottom: NAV_BAR_HEIGHT + FAB_CLEARANCE,
            }}
        >
            <Text className="text-caption flex-1" style={{ color: m3.inverseOnSurface }}>
                {message}
            </Text>
            <Pressable
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(m3.inverseOnSurface, PRESSED_ALPHA) }}
                className="h-10 justify-center overflow-hidden rounded-full px-3"
                onPress={onUndo}
            >
                {/* M3 draws the action in inverse-primary, which the role tokens leave
                    to Compose; primary-container is its neighbour tone on the same
                    inverse surface. */}
                <Text className="font-sans-medium text-caption" style={{ color: m3.primaryContainer }}>
                    {translateNow("common.undo")}
                </Text>
            </Pressable>
        </View>
    );
}
