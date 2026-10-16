import { usePreventRemove, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";

import { useTranslation } from "@/i18n/context";

/**
 * Lets a sheet that was swiped away with unsaved edits offer them back. Only
 * Android needs it: there a sheet cannot refuse the swipe, so the guard lets it
 * go and shows "Edits discarded" with an Undo. iOS refuses the swipe and asks
 * instead, so it never calls these.
 */
export interface SwipeDiscardRecovery<Draft> {
    /**
     * Reads the unsaved edits, or null when there are none to offer back. Called
     * when a dirty sheet reports itself swiped away, before its screen unmounts.
     */
    snapshot: () => Draft | null;
    /** The Undo: puts the edits back, after the sheet has gone. */
    restore: (draft: Draft) => void;
}

/**
 * Asks before a screen with unsaved edits is left, and stands aside once the
 * screen leaves on purpose (`leave`, after a save or delete). `leave` goes once:
 * it returns false to a second call, which would otherwise go back again, from
 * the screen underneath. `recovery` is Android's way back from a swipe it could
 * not stop; iOS ignores it.
 */
export function useDiscardGuard<Draft>(_recovery?: SwipeDiscardRecovery<Draft>) {
    const router = useRouter();
    const t = useTranslation();
    const [dirty, setDirty] = useState(false);
    const leaving = useRef(false);

    const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
        Alert.alert(t("common.discard.title"), undefined, [
            { style: "cancel", text: t("common.discard.keep") },
            {
                onPress: () => {
                    setDirty(false);
                    repeat();
                },
                style: "destructive",
                text: t("common.discard.confirm"),
            },
        ]);
    });

    const leave = () => {
        if (leaving.current) {
            return false;
        }
        leaving.current = true;
        setDirty(false);
        disablePrevention();
        router.back();
        return true;
    };

    return { leave, setDirty };
}
